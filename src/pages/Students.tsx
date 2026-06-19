import { useMemo, useState } from "react";
import { useStudents, usePayments } from "@/store/useStore";
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
import { formatPKR } from "@/lib/currency";
import { format } from "date-fns";
import StudentCsvImport from "@/components/StudentCsvImport";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { getStudentPendingFeeBalance } from "@/lib/studentPendingFees";

type StudentForm = {
  name: string;
  guardianName: string;
  contact: string;
  classGrade: string;
  enrollmentDate: string;
  leavingDate: string;
  status: "active" | "inactive";
  studentCode: string;
  monthlyFee: string;
  openingDueAmount: string;
};

const emptyForm: StudentForm = {
  name: "",
  guardianName: "",
  contact: "",
  classGrade: "",
  enrollmentDate: format(new Date(), "yyyy-MM-dd"),
  leavingDate: "",
  status: "active",
  studentCode: "",
  monthlyFee: "",
  openingDueAmount: "0",
};

export default function Students() {
  const { students, addStudent, bulkAddStudents, updateStudent, deleteStudent, bulkDeleteStudents } = useStudents();
  const { payments } = usePayments();
  const { classNames } = useClasses();
  const { permissions, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
  const [classSearch, setClassSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const canBulkDeleteStudents = isAdmin;

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

  const filteredClassNames = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    if (!query) return classNames;
    return classNames.filter((className) => className.toLowerCase().includes(query));
  }, [classNames, classSearch]);

  const filteredIds = filtered.map((student) => student.id);
  const selectedFilteredIds = selectedStudentIds.filter((id) => filteredIds.includes(id));
  const allFilteredSelected = filteredIds.length > 0 && selectedFilteredIds.length === filteredIds.length;
  const someFilteredSelected = selectedFilteredIds.length > 0 && !allFilteredSelected;

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]
    );
  };

  const toggleAllFilteredStudents = () => {
    setSelectedStudentIds((current) => {
      if (allFilteredSelected) {
        return current.filter((id) => !filteredIds.includes(id));
      }
      return Array.from(new Set([...current, ...filteredIds]));
    });
  };

  const handleSubmit = async () => {
    if (!form.name || !form.classGrade) return;
    const monthlyFee = parseFloat(form.monthlyFee) || 0;
    if (monthlyFee <= 0) {
      toast.error("Monthly fee is required for each student");
      return;
    }
    const openingDueAmount = form.openingDueAmount === "" ? 0 : Number(form.openingDueAmount);
    if (!Number.isFinite(openingDueAmount) || openingDueAmount < 0) {
      toast.error("Pending fees must be a valid amount");
      return;
    }
    if (editingId) {
      updateStudent(editingId, { ...form, monthlyFee, openingDueAmount });
    } else {
      await addStudent({ ...form, monthlyFee, openingDueAmount });
    }
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleEdit = (student: Student) => {
    setEditingId(student.id);
    setForm({
      name: student.name,
      guardianName: student.guardianName,
      contact: student.contact,
      classGrade: student.classGrade,
      enrollmentDate: student.enrollmentDate,
      leavingDate: student.leavingDate ?? "",
      status: student.status,
      studentCode: student.studentCode,
      monthlyFee: student.monthlyFee ? String(student.monthlyFee) : "",
      openingDueAmount: String(student.openingDueAmount ?? 0),
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this student?")) {
      deleteStudent(id);
      setSelectedStudentIds((current) => current.filter((selectedId) => selectedId !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (!canBulkDeleteStudents) {
      toast.error("Only admins can bulk delete students");
      return;
    }
    if (selectedStudentIds.length === 0) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedStudentIds.length} selected student${selectedStudentIds.length === 1 ? "" : "s"}? This action cannot be undone.`
    );
    if (!confirmed) return;

    const error = await bulkDeleteStudents(selectedStudentIds);
    if (error) {
      toast.error("Failed to delete selected students");
      return;
    }
    toast.success(`Deleted ${selectedStudentIds.length} student${selectedStudentIds.length === 1 ? "" : "s"}`);
    setSelectedStudentIds([]);
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
          {canBulkDeleteStudents && selectedStudentIds.length > 0 && (
            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete Selected ({selectedStudentIds.length})
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const headers = ["S.No", "Code", "Name", "Guardian", "Class", "Monthly Fee", "Pending Fees", "Contact", "Joining Date", "Leaving Date", "Status"];
              const rows = filtered.map((s, index) => [String(index + 1), s.studentCode, s.name, s.guardianName, s.classGrade, String(s.monthlyFee), String(getStudentPendingFeeBalance(s, payments)), s.contact, s.enrollmentDate, s.leavingDate ?? "", s.status]);
              downloadCSV("students.csv", headers, rows, {
                delimiter: "\t",
                encoding: "utf-16le",
              });
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
                setClassSearch("");
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
            <DialogContent className="max-h-[90vh] overflow-y-auto">
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
                  onValueChange={(v) => {
                    setForm({ ...form, classGrade: v });
                    setClassSearch("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 bg-popover p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={classSearch}
                          onChange={(e) => setClassSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Search class..."
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                    {classNames.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2 text-center">No classes found.</p>
                    )}
                    {classNames.length > 0 && filteredClassNames.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2 text-center">No classes found.</p>
                    )}
                    {filteredClassNames.map((g) => (
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
                <Label>Monthly Tuition Fee (PKR) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.monthlyFee}
                  onChange={(e) => setForm({ ...form, monthlyFee: e.target.value })}
                  placeholder="e.g. 2000"
                />
              </div>
              <div>
                <Label>Pending Fees (PKR)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.openingDueAmount}
                  onChange={(e) => setForm({ ...form, openingDueAmount: e.target.value })}
                  placeholder="e.g. 16000"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive", leavingDate: v === "active" ? "" : form.leavingDate })}
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
              {form.status === "inactive" && (
                <div>
                  <Label>Leaving Date</Label>
                  <Input
                    type="date"
                    value={form.leavingDate}
                    min={form.enrollmentDate}
                    onChange={(e) => setForm({ ...form, leavingDate: e.target.value })}
                  />
                </div>
              )}
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
                {canBulkDeleteStudents && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAllFilteredStudents}
                      aria-label="Select all students"
                    />
                  </TableHead>
                )}
                <TableHead>S.No</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Guardian</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Monthly Fee</TableHead>
                <TableHead>Pending Fees</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead>Leaving Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canBulkDeleteStudents ? 13 : 12} className="text-center py-8 text-muted-foreground">
                    No students found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s, index) => (
                  <TableRow key={s.id}>
                    {canBulkDeleteStudents && (
                      <TableCell>
                        <Checkbox
                          checked={selectedStudentIds.includes(s.id)}
                          onCheckedChange={() => toggleStudentSelection(s.id)}
                          aria-label={`Select ${s.name}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground font-mono">{index + 1}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{s.studentCode}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.guardianName}</TableCell>
                    <TableCell>{s.classGrade}</TableCell>
                    <TableCell>{s.monthlyFee ? formatPKR(s.monthlyFee) : "-"}</TableCell>
                      <TableCell>{getStudentPendingFeeBalance(s, payments) > 0 ? formatPKR(getStudentPendingFeeBalance(s, payments)) : "-"}</TableCell>
                    <TableCell>{s.contact}</TableCell>
                    <TableCell>{s.enrollmentDate}</TableCell>
                    <TableCell>{s.leavingDate ?? "-"}</TableCell>
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
