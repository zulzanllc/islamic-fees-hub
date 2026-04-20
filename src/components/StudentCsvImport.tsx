import { useState, useRef } from "react";
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
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

interface CsvStudent {
  name: string;
  guardianName: string;
  contact: string;
  classGrade: string;
  enrollmentDate: string;
  status: "active" | "inactive";
  studentCode?: string;
}

interface Props {
  onImport: (students: CsvStudent[]) => Promise<any>;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
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

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    reset();
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setErrors(["CSV must have a header row and at least one data row."]);
        return;
      }

      const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const nameIdx = header.findIndex((h) => h.includes("name") && !h.includes("guardian"));
      const guardianIdx = header.findIndex((h) => h.includes("guardian") || h.includes("father") || h.includes("parent"));
      const contactIdx = header.findIndex((h) => h.includes("contact") || h.includes("phone") || h.includes("mobile"));
      const classIdx = header.findIndex((h) => h.includes("class") || h.includes("grade"));
      const dateIdx = header.findIndex((h) => h.includes("joining") || h.includes("enrollment") || h.includes("date") || h.includes("admission"));
      const statusIdx = header.findIndex((h) => h.includes("status"));
      const codeIdx = header.findIndex((h) => h.includes("code") || h.includes("id") || h.includes("roll"));

      if (nameIdx === -1) {
        setErrors(["Could not find a 'Name' column in the CSV header."]);
        return;
      }
      if (classIdx === -1) {
        setErrors(["Could not find a 'Class/Grade' column in the CSV header."]);
        return;
      }

      const students: CsvStudent[] = [];
      const rowErrors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const name = cols[nameIdx]?.trim() || "";
        const classGrade = cols[classIdx]?.trim() || "";

        if (!name) {
          rowErrors.push(`Row ${i + 1}: Missing name, skipped.`);
          continue;
        }
        if (!classGrade) {
          rowErrors.push(`Row ${i + 1}: Missing class/grade, skipped.`);
          continue;
        }

        // Validate class grade - try to match
        const matchedGrade = classNames.find(
          (g) => g.toLowerCase() === classGrade.toLowerCase() || g.toLowerCase().replace(/\s/g, "") === classGrade.toLowerCase().replace(/\s/g, "")
        );
        if (!matchedGrade) {
          rowErrors.push(`Row ${i + 1}: Unknown class "${classGrade}", skipped.`);
          continue;
        }

        let enrollmentDate = format(new Date(), "yyyy-MM-dd");
        if (dateIdx !== -1 && cols[dateIdx]?.trim()) {
          const d = cols[dateIdx].trim();
          // Try parsing common date formats
          const parsed = new Date(d);
          if (!isNaN(parsed.getTime())) {
            enrollmentDate = format(parsed, "yyyy-MM-dd");
          }
        }

        const status = statusIdx !== -1 && cols[statusIdx]?.trim().toLowerCase() === "inactive" ? "inactive" : "active";
        const studentCode = codeIdx !== -1 ? cols[codeIdx]?.trim() || "" : "";

        students.push({
          name,
          guardianName: guardianIdx !== -1 ? cols[guardianIdx]?.trim() || "" : "",
          contact: contactIdx !== -1 ? cols[contactIdx]?.trim() || "" : "",
          classGrade: matchedGrade,
          enrollmentDate,
          status,
          ...(studentCode ? { studentCode } : {}),
        });
      }

      setErrors(rowErrors);
      setParsed(students);
    };
    reader.readAsText(file);
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
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
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
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with columns: <strong>Name</strong> (required), <strong>Class/Grade</strong> (required), Guardian Name, Contact, Joining Date, Status, Student Code.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
          />

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
                      <TableHead>Contact</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{s.studentCode || "Auto"}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{s.guardianName}</TableCell>
                        <TableCell>{s.classGrade}</TableCell>
                        <TableCell>{s.contact}</TableCell>
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
