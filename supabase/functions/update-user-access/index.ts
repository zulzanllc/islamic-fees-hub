import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AccessLevel = "admin" | "both_edit" | "both_view" | "students_only" | "teachers_only";

function isAccessLevel(value: unknown): value is AccessLevel {
  return value === "admin" || value === "both_edit" || value === "both_view" || value === "students_only" || value === "teachers_only";
}

function getAccessPermissions(accessLevel: AccessLevel) {
  switch (accessLevel) {
    case "admin":
      return {
        can_view_students: true,
        can_edit_students: true,
        can_edit_fees: true,
        can_view_teachers: true,
        can_edit_teachers: true,
        can_edit_salaries: true,
      };
    case "both_edit":
      return {
        can_view_students: true,
        can_edit_students: true,
        can_edit_fees: true,
        can_view_teachers: true,
        can_edit_teachers: true,
        can_edit_salaries: true,
      };
    case "both_view":
      return {
        can_view_students: true,
        can_edit_students: false,
        can_edit_fees: false,
        can_view_teachers: true,
        can_edit_teachers: false,
        can_edit_salaries: false,
      };
    case "teachers_only":
      return {
        can_view_students: false,
        can_edit_students: false,
        can_edit_fees: false,
        can_view_teachers: true,
        can_edit_teachers: true,
        can_edit_salaries: false,
      };
    default:
      return {
        can_view_students: true,
        can_edit_students: true,
        can_edit_fees: false,
        can_view_teachers: false,
        can_edit_teachers: false,
        can_edit_salaries: false,
      };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service credentials are not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user: caller },
      error: callerError,
    } = await adminClient.auth.getUser(token);

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, accessLevel } = await req.json();
    if (!userId || typeof userId !== "string") {
      return new Response(JSON.stringify({ error: "User id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAccessLevel(accessLevel)) {
      return new Response(JSON.stringify({ error: "Invalid access level" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nextRole = accessLevel === "admin" ? "admin" : "user";
    const { data: existingRoles, error: fetchRoleError } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", userId);

    if (fetchRoleError) {
      return new Response(JSON.stringify({ error: fetchRoleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingRoles && existingRoles.length > 0) {
      const { error: roleError } = await adminClient
        .from("user_roles")
        .update({ role: nextRole })
        .eq("user_id", userId);

      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: nextRole });

      if (roleError) {
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: permissionError } = await adminClient
      .from("user_permissions")
      .upsert({
        user_id: userId,
        ...getAccessPermissions(accessLevel),
        can_manage_roles: accessLevel === "admin",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (permissionError) {
      return new Response(JSON.stringify({ error: permissionError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update access";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
