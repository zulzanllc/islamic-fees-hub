import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { formatPKR } from "@/lib/currency";

export interface CsvTeacher {
  name: string;
  contact: string;
  cnic: string;
  joiningDate: string;
  status: "active" | "inactive";
  monthlySalary: number;
}

interface Props {
  onImport: (teachers: CsvTeacher[]) => Promise<any>;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

function downloadTemplate() {
  const headers = ["Name", "Contact", "CNIC", "Monthly Salary", "Joining Date", "Status"];
  const sample = ["Ahmed Khan", "03001234567", "12345-1234567-1", "25000", "2025-01-15", "active"];
  const csv = [headers.join(","), sample.join(",")].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "teacher_import_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function TeacherCsvImport({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<CsvTeacher[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setParsed([]); setErrors([]); setDone(false); if (fileRef.current) fileRef.current.value = ""; };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsed([]); setErrors([]); setDone(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setErrors(["CSV must have a header row and at least one data row."]); return; }

      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const nameIdx = header.findIndex((h) => h.includes("name"));
      const contactIdx = header.findIndex((h) => h.includes("contact") || h.includes("phone") || h.includes("mobile"));
      const cnicIdx = header.findIndex((h) => h.includes("cnic") || h.includes("nic") || h.includes("identity"));
      const salaryIdx = header.findIndex((h) => h.includes("salary") || h.includes("amount") || h.includes("pay"));
      const dateIdx = header.findIndex((h) => h.includes("joining") || h.includes("date"));
      const statusIdx = header.findIndex((h) => h.includes("status"));

      if (nameIdx === -1) { setErrors(["Could not find a 'Name' column in the CSV header."]); return; }

      const teachers: CsvTeacher[] = [];
      const rowErrors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = cols[nameIdx]?.trim() || "";
        if (!name) { rowErrors.push(`Row ${i + 1}: Missing name, skipped.`); continue; }

        let joiningDate = new Date().toISOString().slice(0, 10);
        if (dateIdx !== -1 && cols[dateIdx]?.trim()) {
          const d = new Date(cols[dateIdx].trim());
          if (!isNaN(d.getTime())) joiningDate = d.toISOString().slice(0, 10);
        }

        const salaryRaw = salaryIdx !== -1 ? cols[salaryIdx]?.trim() || "0" : "0";
        const monthlySalary = Number(salaryRaw);
        if (isNaN(monthlySalary) || monthlySalary < 0) { rowErrors.push(`Row ${i + 1}: Invalid salary "${salaryRaw}", skipped.`); continue; }

        const status = statusIdx !== -1 && cols[statusIdx]?.trim().toLowerCase() === "inactive" ? "inactive" : "active";

        teachers.push({
          name,
          contact: contactIdx !== -1 ? cols[contactIdx]?.trim() || "" : "",
          cnic: cnicIdx !== -1 ? cols[cnicIdx]?.trim() || "" : "",
          joiningDate,
          status,
          monthlySalary,
        });
      }
      setErrors(rowErrors);
      setParsed(teachers);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    const err = await onImport(parsed);
    setImporting(false);
    if (!err) { setDone(true); setParsed([]); }
    else { setErrors((prev) => [...prev, `Import error: ${err.message}`]); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import Teachers from CSV</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Required: <strong>Name</strong>. Optional: Contact, CNIC, Monthly Salary, Joining Date, Status.
              Duplicate CNICs are automatically skipped.
            </p>
            <Button size="sm" variant="ghost" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" /> Template
            </Button>
          </div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90" />

          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded p-3 space-y-1">
              {errors.map((e, i) => (
                <p key={i} className="text-sm text-destructive flex items-start gap-1">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}

          {done && (
            <div className="bg-accent/50 border border-accent rounded p-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <p className="text-sm text-foreground">Teachers imported successfully!</p>
            </div>
          )}

          {parsed.length > 0 && (
            <>
              <p className="text-sm font-medium">{parsed.length} teachers ready to import:</p>
              <div className="border rounded max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>CNIC</TableHead><TableHead>Salary</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {parsed.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.contact || "-"}</TableCell>
                        <TableCell>{t.cnic || "-"}</TableCell>
                        <TableCell>{formatPKR(t.monthlySalary)}</TableCell>
                        <TableCell>{t.status}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={handleImport} disabled={importing} className="w-full">
                {importing ? "Importing..." : `Import ${parsed.length} Teachers`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
