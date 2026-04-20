import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  let cleaned = serviceAccountKey.trim();
  
  // Try base64 decode first
  try {
    const decoded = atob(cleaned);
    if (decoded.startsWith("{")) {
      cleaned = decoded;
    }
  } catch { /* not base64 */ }
  
  // If wrapped in outer quotes, unwrap
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Replace literal newlines (not \n sequences) with \\n so JSON.parse works
  // This handles the case where the secret storage converts \n to actual newlines
  cleaned = cleaned.replace(/\r?\n/g, '\\n');
  
  const sa = JSON.parse(cleaned);
  const now = Math.floor(Date.now() / 1000);

  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  );
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
      })
    )
  );

  const signingInput = `${header}.${payload}`;

  // Parse PEM private key
  const pemContent = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Google token error: ${err}`);
  }

  const tokenData: GoogleTokenResponse = await tokenRes.json();
  return tokenData.access_token;
}

async function clearAndWriteSheet(
  accessToken: string,
  sheetId: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | null)[][]
) {
  const sheetsApi = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;

  // Ensure the sheet tab exists
  const spreadsheetRes = await fetch(sheetsApi, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const spreadsheetData = await spreadsheetRes.json();
  const existingSheets = spreadsheetData.sheets?.map(
    (s: any) => s.properties?.title
  ) || [];

  if (!existingSheets.includes(sheetName)) {
    await fetch(`${sheetsApi}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
  }

  // Clear existing data
  await fetch(
    `${sheetsApi}/values/${encodeURIComponent(sheetName)}!A:ZZ?`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // Write new data (clear first via update with empty then append)
  const range = `${sheetName}!A1`;
  const values = [headers, ...rows];

  await fetch(
    `${sheetsApi}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ range, values }),
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");

    const sheetId = Deno.env.get("GOOGLE_SHEET_ID");
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const accessToken = await getAccessToken(serviceAccountKey);

    // 1. Students
    const { data: students } = await supabase.from("students").select("*").order("created_at");
    await clearAndWriteSheet(accessToken, sheetId, "Students", 
      ["ID", "Student Code", "Name", "Guardian", "Contact", "Class", "Joining Date", "Status"],
      (students || []).map((s: any) => [s.id, s.student_code, s.name, s.guardian_name, s.contact, s.class_grade, s.enrollment_date, s.status])
    );

    // 2. Payments
    const { data: payments } = await supabase.from("payments").select("*").order("created_at");
    await clearAndWriteSheet(accessToken, sheetId, "Payments",
      ["ID", "Student ID", "Fee Type", "Amount Paid", "Date", "Fee Month", "Receipt #", "Notes", "Payment Mode", "Collected By"],
      (payments || []).map((p: any) => [p.id, p.student_id, p.fee_type, p.amount_paid, p.date, p.fee_month, p.receipt_number, p.notes, p.payment_mode, p.collected_by || ""])
    );

    // 3. Teachers
    const { data: teachers } = await supabase.from("teachers").select("*").order("created_at");
    await clearAndWriteSheet(accessToken, sheetId, "Teachers",
      ["ID", "Name", "Contact", "CNIC", "Joining Date", "Status", "Monthly Salary"],
      (teachers || []).map((t: any) => [t.id, t.name, t.contact, t.cnic, t.joining_date, t.status, t.monthly_salary])
    );

    // 4. Teacher Salaries
    const { data: salaries } = await supabase.from("teacher_salaries").select("*").order("created_at");
    await clearAndWriteSheet(accessToken, sheetId, "Teacher Salaries",
      ["ID", "Teacher ID", "Month", "Base Salary", "Loan Deduction", "Other Deduction", "Net Paid", "Date Paid", "Payment Mode", "Notes"],
      (salaries || []).map((s: any) => [s.id, s.teacher_id, s.month, s.base_salary, s.loan_deduction, s.other_deduction, s.net_paid, s.date_paid, s.payment_mode, s.notes])
    );

    // 5. Teacher Loans
    const { data: loans } = await supabase.from("teacher_loans").select("*").order("created_at");
    await clearAndWriteSheet(accessToken, sheetId, "Teacher Loans",
      ["ID", "Teacher ID", "Amount", "Remaining", "Date Issued", "Status", "Repayment Type", "Notes"],
      (loans || []).map((l: any) => [l.id, l.teacher_id, l.amount, l.remaining, l.date_issued, l.status, l.repayment_type, l.notes])
    );

    // 6. Teacher Attendance
    const { data: attendance } = await supabase.from("teacher_attendance").select("*").order("created_at");
    await clearAndWriteSheet(accessToken, sheetId, "Teacher Attendance",
      ["ID", "Teacher ID", "Date", "Time In", "Time Out", "Notes"],
      (attendance || []).map((a: any) => [a.id, a.teacher_id, a.date, a.time_in || "", a.time_out || "", a.notes])
    );

    // 7. Fee Structures
    const { data: feeStructures } = await supabase.from("fee_structures").select("*").order("created_at");
    await clearAndWriteSheet(accessToken, sheetId, "Fee Structures",
      ["ID", "Class Grade", "Fee Type", "Amount"],
      (feeStructures || []).map((f: any) => [f.id, f.class_grade, f.fee_type, f.amount])
    );

    const timestamp = new Date().toISOString();
    console.log(`Backup completed at ${timestamp}`);

    return new Response(
      JSON.stringify({ success: true, timestamp, tables: 7 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Backup error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
