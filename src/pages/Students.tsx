import { useState } from "react";
import { useStudents, useFeeStructures } from "@/store/useStore";
import { Student } from "@/types";
import { useClasses } from "@/hooks/useClasses";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus, Search, Pencil, Trash2, Download, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { downloadCSV } from "@/lib/exportCsv";
import { format } from "date-fns";
import StudentCsvImport from "@/components/StudentCsvImport";
import { useAuth } from "@/hooks/useAuth";

type StudentForm = {
  name: string;
  guardianName: string;
  contact: string;
  classGrade: string;
  enrollmentDate: string;
  status: "active" | "inactive";
  studentCode: string;
  monthlyFee: string;
};

const emptyForm: StudentForm = {
  name: "",
  guardianName: "",
  contact: "",
  classGrade: "",
  enrollmentDate: format(new Date(), "yyyy-MM-dd"),
  status: "active",
  studentCode: "",
  monthlyFee: "",
};

export default function Students() {
  const { students, addStudent, bulkAddStudents, updateStudent, deleteStudent } = useStudents();
  const { fees, addFee } = useFeeStructures();
  const { classNames } = useClasses();
  const { permissions } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const navigate = useNavigate();

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      s.name.toLowerCase().includes(q) ||
      s.guardianName.toLowerCase().includes(q) ||
      s.contact.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q);
    const matchClass = selectedClasses.length === 0 || selectedClasses.includes(s.classGrade);
    return matchSearch && matchClass;
  });

  const toggleClassFilter = (className: string) => {
    setSelectedClasses((current) =>
      current.includes(className)
        ? current.filter((selected) => selected !== className)
        : [...current, className]
    );
  };

  const classFilterLabel =
    selectedClasses.length === 0
      ? "All Classes"
      : selectedClasses.length === 1
        ? selectedClasses[0]
        : `${selectedClasses.length} classes selected`;

  const handleSubmit = async () => {
    if (!form.name || !form.classGrade) return;
    if (editingId) {
      updateStudent(editingId, form);
    } else {
      const result = await addStudent(form);
      // If a monthly fee was provided, add it to fee_structures if not already set
      if (form.monthlyFee && parseFloat(form.monthlyFee) > 0) {
        const existingTuition = fees.find(
          (f) => f.classGrade === form.classGrade && f.feeType === "tuition"
        );
        if (!existingTuition) {
          await addFee({
            classGrade: form.classGrade,
            feeType: "tuition",
            amount: parseFloat(form.monthlyFee),
          });
        }
      }
    }
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleEdit = (student: Student) => {
    setEditingId(student.id);
    const existingFee = fees.find(
      (f) => f.classGrade === student.classGrade && f.feeType === "tuition"
    );
    setForm({
      name: student.name,
      guardianName: student.guardianName,
      contact: student.contact,
      classGrade: student.classGrade,
      enrollmentDate: student.enrollmentDate,
      status: student.status,
      studentCode: student.studentCode,
      monthlyFee: existingFee ? String(existingFee.amount) : "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this student?")) {
      deleteStudent(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground">
            Manage student enrollment
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const headers = ["Code", "Name", "Guardian", "Class", "Contact", "Joining Date", "Status"];
              const rows = filtered.map((s) => [s.studentCode, s.name, s.guardianName, s.classGrade, s.contact, s.enrollmentDate, s.status]);
              downloadCSV("students.csv", headers, rows);
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          {permissions.canEditStudents && <StudentCsvImport onImport={bulkAddStudents} />}
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingId(null);
                setForm(emptyForm);
              }
            }}
          >
            {permissions.canEditStudents && (
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Student
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Student" : "Add Student"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Student Code <span className="text-xs text-muted-foreground">(leave blank to auto-generate)</span></Label>
                <Input
                  value={form.studentCode}
                  onChange={(e) => setForm({ ...form, studentCode: e.target.value })}
                  placeholder="e.g. STU-001"
                />
              </div>
              <div>
                <Label>Full Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Student name"
                />
              </div>
              <div>
                <Label>Guardian Name</Label>
                <Input
                  value={form.guardianName}
                  onChange={(e) =>
                    setForm({ ...form, guardianName: e.target.value })
                  }
                  placeholder="Father/Guardian name"
                />
              </div>
              <div>
                <Label>Contact</Label>
                <Input
                  value={form.contact}
                  onChange={(e) =>
                    setForm({ ...form, contact: e.target.value })
                  }
                  placeholder="Phone number"
                />
              </div>
              <div>
                <Label>Class/Grade *</Label>
                <Select
                  value={form.classGrade}
                  onValueChange={(v) => setForm({ ...form, classGrade: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classNames.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input
                  type="date"
                  value={form.enrollmentDate}
                  onChange={(e) =>
                    setForm({ ...form, enrollmentDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Monthly Tuition Fee (PKR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.monthlyFee}
                  onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })}
                  placeholder="e.g. 2000"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive (Left)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingId ? "Update" : "Add"} Student
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, code, guardian or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[220px] justify-between">
              <span className="truncate">{classFilterLabel}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[260px] p-3">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Filter by class</p>
                {selectedClasses.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelectedClasses([])}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {classNames.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No classes found.</p>
                ) : (
                  classNames.map((className) => (
                    <label
                      key={className}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedClasses.includes(className)}
                        onCheckedChange={() => toggleClassFilter(className)}
                      />
                      <span>{className}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Guardian</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No students found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{s.studentCode}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.guardianName}</TableCell>
                    <TableCell>{s.classGrade}</TableCell>
                    <TableCell>{s.contact}</TableCell>
                    <TableCell>{s.enrollmentDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant={s.status === "active" ? "default" : "secondary"}
                      >
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => navigate(`/students/${s.id}`)}
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {permissions.canEditStudents && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEdit(s)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(s.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
