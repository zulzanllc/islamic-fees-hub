import { useMemo, useState } from "react";
import { format, parseISO, eachMonthOfInterval, startOfMonth } from "date-fns";
import { UserMinus, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStudents, usePayments, useFeeStructures } from "@/store/useStore";
import { formatPKR } from "@/lib/currency";
import { formatFeeMonth } from "@/lib/formatMonth";
import { getStudentFeeStartDate, getStudentMonthlyDue, isJoiningMonth, isLeavingMonth } from "@/lib/proration";
import { getStudentMonthlyFee } from "@/lib/studentFees";
import { toast } from "sonner";

type PreviewMonth = {
  month: string;
  due: number;
  paid: number;
  balance: number;
  prorated: boolean;
};

export default function StudentLeaving() {
  const { students, updateStudent } = useStudents();
  const { payments } = usePayments();
  const { fees } = useFeeStructures();
  const [studentId, setStudentId] = useState("");
  const [leavingDate, setLeavingDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [studentSearch, setStudentSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeStudents = useMemo(
    () => students.filter((student) => student.status === "active").sort((a, b) => a.name.localeCompare(b.name)),
    [students]
  );
  const leftStudents = useMemo(
    () => students
      .filter((student) => student.status === "inactive" && student.leavingDate)
      .sort((a, b) => (b.leavingDate ?? "").localeCompare(a.leavingDate ?? "")),
    [students]
  );
  const filteredActiveStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return activeStudents;

    return activeStudents.filter((student) =>
      student.name.toLowerCase().includes(query) ||
      student.classGrade.toLowerCase().includes(query) ||
      student.studentCode.toLowerCase().includes(query) ||
      student.guardianName.toLowerCase().includes(query) ||
      student.contact.toLowerCase().includes(query)
    );
  }, [activeStudents, studentSearch]);

  const selectedStudent = students.find((student) => student.id === studentId);
  const monthlyFee = getStudentMonthlyFee(selectedStudent, fees);

  const preview = useMemo(() => {
    if (!selectedStudent || !leavingDate) {
      return { valid: false, months: [] as PreviewMonth[], message: "Select a student and leaving date." };
    }

    const enrollment = parseISO(selectedStudent.enrollmentDate);
    const leaving = parseISO(leavingDate);
    const feeStartDate = getStudentFeeStartDate(selectedStudent.enrollmentDate);
    if (Number.isNaN(enrollment.getTime()) || Number.isNaN(leaving.getTime()) || !feeStartDate) {
      return { valid: false, months: [] as PreviewMonth[], message: "Enter a valid leaving date." };
    }
    if (leaving < enrollment) {
      return { valid: false, months: [] as PreviewMonth[], message: "Leaving date cannot be before joining date." };
    }

    const months = eachMonthOfInterval({
      start: startOfMonth(feeStartDate),
      end: startOfMonth(leaving),
    }).map((monthDate) => {
      const month = format(monthDate, "yyyy-MM");
      const due = getStudentMonthlyDue(monthlyFee, selectedStudent.enrollmentDate, month, leavingDate);
      const paid = payments
        .filter((payment) => (
          payment.studentId === selectedStudent.id &&
          payment.feeType === "tuition" &&
          payment.feeMonth === month
        ))
        .reduce((sum, payment) => sum + payment.amountPaid, 0);

      return {
        month,
        due,
        paid,
        balance: Math.max(0, due - paid),
        prorated:
          isJoiningMonth(selectedStudent.enrollmentDate, month) ||
          isLeavingMonth(leavingDate, month),
      };
    });

    return { valid: true, months, message: "" };
  }, [selectedStudent, leavingDate, monthlyFee, payments]);

  const totalDue = preview.months.reduce((sum, month) => sum + month.due, 0);
  const totalPaid = preview.months.reduce((sum, month) => sum + month.paid, 0);
  const totalPending = preview.months.reduce((sum, month) => sum + month.balance, 0);
  const pendingMonths = preview.months.filter((month) => month.balance > 0);

  const handleMarkLeft = async () => {
    if (!selectedStudent || !preview.valid) {
      toast.error(preview.message || "Select a valid student and leaving date");
      return;
    }

    setSubmitting(true);
    try {
      await updateStudent(selectedStudent.id, {
        status: "inactive",
        leavingDate,
      });
      toast.success(`${selectedStudent.name} marked as left`);
      setStudentId("");
      setStudentSearch("");
      setLeavingDate(format(new Date(), "yyyy-MM-dd"));
    } catch {
      toast.error("Failed to update student");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Student Leaving</h1>
        <p className="text-sm text-muted-foreground">Mark students as left and preview their final tuition balance.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserMinus className="h-5 w-5" /> Leaving Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select
                value={studentId}
                onValueChange={(value) => {
                  setStudentId(value);
                  setStudentSearch("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select active student" />
                </SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 bg-popover p-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={studentSearch}
                        onChange={(event) => setStudentSearch(event.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        placeholder="Search student..."
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                  {activeStudents.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">No active students found.</div>
                  ) : filteredActiveStudents.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground">No matching students found.</div>
                  ) : (
                    filteredActiveStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} ({student.classGrade}){student.studentCode ? ` - ${student.studentCode}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Leaving Date</Label>
              <Input
                type="date"
                value={leavingDate}
                min={selectedStudent?.enrollmentDate}
                onChange={(event) => setLeavingDate(event.target.value)}
              />
            </div>

            {selectedStudent && (
              <div className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Class</span>
                  <span className="font-medium">{selectedStudent.classGrade}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Joining Date</span>
                  <span className="font-medium">{selectedStudent.enrollmentDate}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Monthly Fee</span>
                  <span className="font-medium">{monthlyFee > 0 ? formatPKR(monthlyFee) : "Not set"}</span>
                </div>
              </div>
            )}

            {monthlyFee <= 0 && selectedStudent && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>No monthly fee is set for this student, so the final balance preview will show zero due.</span>
              </div>
            )}

            <Button className="w-full" onClick={handleMarkLeft} disabled={!selectedStudent || !preview.valid || submitting}>
              {submitting ? "Updating..." : "Mark Student as Left"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Final Due</p>
                <p className="text-2xl font-bold">{formatPKR(totalDue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold text-primary">{formatPKR(totalPaid)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className={`text-2xl font-bold ${totalPending > 0 ? "text-destructive" : ""}`}>
                  {formatPKR(totalPending)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Final Tuition Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!preview.valid ? (
                <div className="p-8 text-center text-sm text-muted-foreground">{preview.message}</div>
              ) : pendingMonths.length === 0 ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  No pending tuition balance for the selected leaving date.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingMonths.map((month) => (
                      <TableRow key={month.month}>
                        <TableCell className="font-medium">{formatFeeMonth(month.month)}</TableCell>
                        <TableCell>
                          {formatPKR(month.due)}
                          {month.prorated && <p className="text-xs text-muted-foreground">Prorated</p>}
                        </TableCell>
                        <TableCell>{formatPKR(month.paid)}</TableCell>
                        <TableCell className="font-semibold text-destructive">{formatPKR(month.balance)}</TableCell>
                        <TableCell>
                          <Badge variant={month.paid > 0 ? "secondary" : "destructive"}>
                            {month.paid > 0 ? "Partial" : "Unpaid"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recently Left Students</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Joining Date</TableHead>
                <TableHead>Leaving Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leftStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No left students recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                leftStudents.slice(0, 10).map((student, index) => (
                  <TableRow key={student.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{index + 1}</TableCell>
                    <TableCell>
                      <span className="font-medium">{student.name}</span>
                      <p className="text-xs text-muted-foreground">{student.studentCode}</p>
                    </TableCell>
                    <TableCell>{student.classGrade}</TableCell>
                    <TableCell>{student.enrollmentDate}</TableCell>
                    <TableCell>{student.leavingDate}</TableCell>
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
