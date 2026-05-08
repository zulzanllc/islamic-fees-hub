import { useRef, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, CheckCircle2, Download, Upload } from "lucide-react";
import { useClasses } from "@/hooks/useClasses";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CsvStudent {
  name: string;
  guardianName: string;
  contact: string;
  classGrade: string;
  enrollmentDate: string;
  status: "active" | "inactive";
  monthlyFee: number;
  openingDueAmount?: number;
  studentCode?: string;
}

interface Props {
  onImport: (students: CsvStudent[]) => Promise<any>;
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current.trim());
  return result;
}

function detectDelimiter(line: string) {
  const candidates = [",", "\t", ";"];
  let bestDelimiter = ",";
  let bestCount = -1;

  for (const candidate of candidates) {
    const count = parseDelimitedLine(line, candidate).length;
    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = candidate;
    }
  }

  return bestDelimiter;
}

function scoreDecodedText(text: string) {
  const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
  const mojibakeCount = (text.match(/[ØÙÃÂ]/g) ?? []).length;
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) ?? []).length;

  return arabicCount * 2 - replacementCount * 20 - mojibakeCount * 5;
}

function decodeCsvFile(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }

  const encodings: Array<"utf-8" | "utf-16le" | "windows-1256"> = ["utf-8", "utf-16le", "windows-1256"];
  let bestText = "";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const encoding of encodings) {
    try {
      const decoded = new TextDecoder(encoding).decode(bytes);
      const score = scoreDecodedText(decoded);
      if (score > bestScore) {
        bestScore = score;
        bestText = decoded;
      }
    } catch {
      // Ignore unsupported decoding attempts and keep trying fallbacks.
    }
  }

  return bestText;
}

function encodeUtf16Le(value: string) {
  const bytes = new Uint8Array(value.length * 2);

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = code >> 8;
  }

  return bytes;
}

function downloadTemplate() {
  const headers = ["Name", "Fees", "Pending Fees", "Guardian Name", "Contact", "Class", "Joining Date", "Status", "Student Code"];
  const sampleRows = [
    ["\u0627\u062d\u0645\u062f", "2000", "4000", "\u0645\u062d\u0645\u062f \u0627\u0634\u0631\u0641", "03001234567", "Nazra", "2026-04-01", "active", "STU-001"],
    ["\u0639\u0644\u06cc", "2500", "0", "\u0639\u0628\u062f\u0627\u0644\u0644\u06c1", "03111222333", "Hifz", "2026-04-03", "active", "STU-002"],
    ["\u0641\u0627\u0637\u0645\u06c1", "1800", "1800", "\u0645\u062d\u0645\u062f \u0627\u0633\u0644\u0645", "03219876543", "", "2026-04-05", "active", "STU-003"],
  ];
  const rows = [
    headers.join("\t"),
    ...sampleRows.map((row) => row.map((cell) => `"${cell}"`).join("\t")),
  ];
  const tsv = rows.join("\r\n");
  const utf16Bom = new Uint8Array([0xff, 0xfe]);
  const blob = new Blob([utf16Bom, encodeUtf16Le(tsv)], { type: "text/csv;charset=utf-16le;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student_import_template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function StudentCsvImport({ onImport }: Props) {
  const { classNames } = useClasses();
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<CsvStudent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setParsed([]);
    setErrors([]);
    setDone(false);
  };

  const clearSelectedFile = () => {
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result;
      if (!(buffer instanceof ArrayBuffer)) {
        setErrors(["Unable to read the selected file."]);
        return;
      }

      const text = decodeCsvFile(buffer);
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        setErrors(["CSV must have a header row and at least one data row."]);
        return;
      }

      const delimiter = detectDelimiter(lines[0]);
      const header = parseDelimitedLine(lines[0], delimiter).map((value) =>
        value.toLowerCase().replace(/[^a-z0-9]/g, "")
      );

      const nameIdx = header.findIndex((value) => value.includes("name") && !value.includes("guardian"));
      const guardianIdx = header.findIndex((value) => value.includes("guardian") || value.includes("father") || value.includes("parent"));
      const contactIdx = header.findIndex((value) => value.includes("contact") || value.includes("phone") || value.includes("mobile"));
      const classIdx = header.findIndex((value) => value.includes("class") || value.includes("grade"));
      const dateIdx = header.findIndex((value) => value.includes("joining") || value.includes("enrollment") || value.includes("date") || value.includes("admission"));
      const statusIdx = header.findIndex((value) => value.includes("status"));
      const codeIdx = header.findIndex((value) => value.includes("code") || value.includes("id") || value.includes("roll"));
      const monthlyFeeIdx = header.findIndex((value) => value.includes("monthlyfee") || value.includes("tuitionfee") || value === "fee" || value === "fees");
      const pendingFeesIdx = header.findIndex((value) => value.includes("pendingfees") || value.includes("pendingfee") || value.includes("dueamount") || value.includes("openingdueamount") || value.includes("openingbalance"));

      if (nameIdx === -1) {
        setErrors(["Could not find a 'Name' column in the CSV header."]);
        return;
      }
      if (monthlyFeeIdx === -1) {
        setErrors(["Could not find a 'Fees' or 'Monthly Fee' column in the CSV header."]);
        return;
      }

      const students: CsvStudent[] = [];
      const rowErrors: string[] = [];

      for (let i = 1; i < lines.length; i += 1) {
        const cols = parseDelimitedLine(lines[i], delimiter);
        const name = cols[nameIdx]?.trim() || "";
        const rawClassGrade = classIdx !== -1 ? cols[classIdx]?.trim() || "" : "";
        const monthlyFeeRaw = cols[monthlyFeeIdx]?.replace(/,/g, "").trim() || "";
        const pendingFeesRaw = pendingFeesIdx !== -1 ? cols[pendingFeesIdx]?.replace(/,/g, "").trim() || "" : "";

        if (!name) {
          rowErrors.push(`Row ${i + 1}: Missing name, skipped.`);
          continue;
        }
        if (!monthlyFeeRaw) {
          rowErrors.push(`Row ${i + 1}: Missing fees, skipped.`);
          continue;
        }

        const monthlyFee = Number(monthlyFeeRaw);
        if (!Number.isFinite(monthlyFee) || monthlyFee <= 0) {
          rowErrors.push(`Row ${i + 1}: Invalid fees "${monthlyFeeRaw}", skipped.`);
          continue;
        }
        const openingDueAmount = pendingFeesRaw ? Number(pendingFeesRaw) : 0;
        if (!Number.isFinite(openingDueAmount) || openingDueAmount < 0) {
          rowErrors.push(`Row ${i + 1}: Invalid pending fees "${pendingFeesRaw}", skipped.`);
          continue;
        }

        const matchedGrade = classNames.find(
          (grade) =>
            grade.toLowerCase() === rawClassGrade.toLowerCase() ||
            grade.toLowerCase().replace(/\s/g, "") === rawClassGrade.toLowerCase().replace(/\s/g, "")
        );

        let enrollmentDate = format(new Date(), "yyyy-MM-dd");
        if (dateIdx !== -1 && cols[dateIdx]?.trim()) {
          const parsedDate = new Date(cols[dateIdx].trim());
          if (!Number.isNaN(parsedDate.getTime())) {
            enrollmentDate = format(parsedDate, "yyyy-MM-dd");
          }
        }

        const status =
          statusIdx !== -1 && cols[statusIdx]?.trim().toLowerCase() === "inactive" ? "inactive" : "active";
        const studentCode = codeIdx !== -1 ? cols[codeIdx]?.trim() || "" : "";

        students.push({
          name,
          guardianName: guardianIdx !== -1 ? cols[guardianIdx]?.trim() || "" : "",
          contact: contactIdx !== -1 ? cols[contactIdx]?.trim() || "" : "",
          classGrade: matchedGrade ?? rawClassGrade,
          enrollmentDate,
          status,
          monthlyFee,
          openingDueAmount,
          ...(studentCode ? { studentCode } : {}),
        });
      }

      setErrors(rowErrors);
      setParsed(students);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleImport = async () => {
    setImporting(true);
    const err = await onImport(parsed);
    setImporting(false);
    if (!err) {
      setDone(true);
      setParsed([]);
    } else {
      setErrors((prev) => [...prev, `Import error: ${err.message}`]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) { reset(); clearSelectedFile(); } }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 mr-1" /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Students from CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Required: <strong>Name</strong>, <strong>Fees</strong>. Optional: Class/Grade, Guardian Name, Contact, Joining Date, Status, Student Code.
            </p>
            <Button size="sm" variant="ghost" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Template
            </Button>
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
            <p>Use a CSV file with a header row. Accepted fee headers include <strong>Fees</strong>, <strong>Monthly Fee</strong>, or <strong>Tuition Fee</strong>.</p>
            <p>To import old dues, add an optional <strong>Pending Fees</strong> column with the actual amount, like <strong>0</strong>, <strong>8000</strong>, or <strong>17000</strong>.</p>
            <p>For Urdu names, the safest option is the provided template or a file saved as <strong>CSV UTF-8</strong>. The importer also tries Unicode and Urdu-friendly decoding automatically.</p>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
          />

          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded p-3 space-y-1">
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-destructive flex items-start gap-1">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
                </p>
              ))}
            </div>
          )}

          {done && (
            <div className="bg-accent/50 border border-accent rounded p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-sm text-foreground">Students imported successfully!</p>
            </div>
          )}

          {parsed.length > 0 && (
            <>
              <p className="text-sm font-medium">{parsed.length} students ready to import:</p>
              <div className="border rounded max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Guardian</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Fees</TableHead>
                      <TableHead>Pending Fees</TableHead>
                      <TableHead>Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((student, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-xs text-muted-foreground">{student.studentCode || "Auto"}</TableCell>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.guardianName}</TableCell>
                        <TableCell>{student.classGrade || "-"}</TableCell>
                        <TableCell>{student.monthlyFee || "-"}</TableCell>
                        <TableCell>{student.openingDueAmount ?? 0}</TableCell>
                        <TableCell>{student.contact}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={handleImport} disabled={importing} className="w-full">
                {importing ? "Importing..." : `Import ${parsed.length} Students`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
