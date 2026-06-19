import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useStudents, usePayments, useFeeStructures } from "@/store/useStore";
import { useAuth } from "@/hooks/useAuth";
import { formatPKR } from "@/lib/currency";
import { format, subMonths } from "date-fns";
import { AlertCircle, ChevronDown, CreditCard, Download, Search } from "lucide-react";
import { downloadCSV } from "@/lib/exportCsv";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { Student } from "@/types";
import { getStudentFeeStartDate, getStudentMonthlyDue, getStudentTotalDueThroughMonth, isJoiningMonth, isLeavingMonth } from "@/lib/proration";
import { getStudentMonthlyFee } from "@/lib/studentFees";
import { getStudentPendingFeeBalance } from "@/lib/studentPendingFees";

export default function PendingFees() {
  const { students } = useStudents();
  const { payments, addPayment } = usePayments();
  const { fees } = useFeeStructures();
  const { user, permissions } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Payment dialog state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<{ student: Student; monthlyPendingAmount: number; pendingFeeBalance: number; feeMonth: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [pendingFeePaymentAmount, setPendingFeePaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openPaymentDialog = (student: Student, monthlyPendingAmount: number, pendingFeeBalance: number, feeMonth: string) => {
    setPaymentStudent({ student, monthlyPendingAmount, pendingFeeBalance, feeMonth });
    setPaymentAmount(String(monthlyPendingAmount));
    setPendingFeePaymentAmount("");
    setPaymentMode("cash");
    setPaymentNotes("");
    setPaymentOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentStudent) return;
    const amount = Number(paymentAmount);
    const pendingFeeAmount = Number(pendingFeePaymentAmount || 0);
    if (isNaN(amount) || amount < 0 || isNaN(pendingFeeAmount) || pendingFeeAmount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (paymentStudent.monthlyPendingAmount > 0 && amount !== paymentStudent.monthlyPendingAmount) {
      toast.error(`Monthly fee must be paid in full: ${formatPKR(paymentStudent.monthlyPendingAmount)}`);
      return;
    }
    if (pendingFeeAmount > paymentStudent.pendingFeeBalance) {
      toast.error(`Pending fee payment cannot exceed ${formatPKR(paymentStudent.pendingFeeBalance)}`);
      return;
    }
    if (amount + pendingFeeAmount <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    setSubmitting(true);
    try {
      await addPayment({
        studentId: paymentStudent.student.id,
        feeType: "tuition",
        amountPaid: amount,
        pendingFeePaid: pendingFeeAmount,
        date: format(new Date(), "yyyy-MM-dd"),
        feeMonth: paymentStudent.feeMonth,
        notes: paymentNotes,
        collectedBy: user?.id ?? null,
        paymentMode,
      });
      toast.success(`Payment of ${formatPKR(amount + pendingFeeAmount)} recorded for ${paymentStudent.student.name}`);
      setPaymentOpen(false);
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, i);
      return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
    });
  }, []);

  const classOptions = useMemo(() => {
    const classes = [...new Set(students.map((s) => s.classGrade))].sort();
    return classes;
  }, [students]);

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

  const eligibleStudents = useMemo(() => {
    let filtered = students;
    if (selectedClasses.length > 0) {
      filtered = filtered.filter((s) => selectedClasses.includes(s.classGrade));
    }
    return filtered;
  }, [students, selectedClasses]);

  const pendingData = useMemo(() => {
    const paidStudents = new Map<string, number>();
    payments
      .filter((p) => p.feeType === "tuition" && p.feeMonth <= selectedMonth)
      .forEach((p) => {
        paidStudents.set(p.studentId, (paidStudents.get(p.studentId) ?? 0) + p.amountPaid);
      });

    const getNextPendingFee = (student: Student) => {
      const monthlyFee = getStudentMonthlyFee(student, fees);
      const feeStartDate = getStudentFeeStartDate(student.enrollmentDate);
      if (!feeStartDate) return null;

      const cursor = new Date(feeStartDate.getFullYear(), feeStartDate.getMonth(), 1);
      const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
      const end = new Date(selectedYear, selectedMonthNumber - 1, 1);

      while (cursor <= end) {
        const month = format(cursor, "yyyy-MM");
        const expected = getStudentMonthlyDue(monthlyFee, student.enrollmentDate, month, student.leavingDate);
        const paid = payments
          .filter((payment) => payment.studentId === student.id && payment.feeType === "tuition" && payment.feeMonth === month)
          .reduce((sum, payment) => sum + payment.amountPaid, 0);
        const pending = Math.max(0, expected - paid);
        if (pending > 0) return { month, pending };
        cursor.setMonth(cursor.getMonth() + 1);
      }

      return null;
    };

    return eligibleStudents.map((student) => {
      const expectedFee = getStudentTotalDueThroughMonth(
        getStudentMonthlyFee(student, fees),
        student.enrollmentDate,
        selectedMonth,
        student.leavingDate,
        0
      );
      const paidAmount = paidStudents.get(student.id) ?? 0;
      const monthlyPendingAmount = Math.max(0, expectedFee - paidAmount);
      const pendingFeeBalance = getStudentPendingFeeBalance(student, payments);
      const pendingAmount = monthlyPendingAmount + pendingFeeBalance;
      const status: "paid" | "partial" | "unpaid" =
        pendingAmount <= 0 ? "paid" : paidAmount > 0 || pendingFeeBalance < (student.openingDueAmount ?? 0) ? "partial" : "unpaid";

      return {
        student,
        expectedFee,
        paidAmount,
        monthlyPendingAmount,
        pendingFeeBalance,
        pendingAmount,
        status,
        nextPendingFee: getNextPendingFee(student),
        prorated:
          isJoiningMonth(student.enrollmentDate, selectedMonth) ||
          isLeavingMonth(student.leavingDate, selectedMonth),
      };
    }).filter((d) => (d.expectedFee > 0 || d.pendingFeeBalance > 0) && d.status !== "paid")
      .filter((details) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const student = details.student;
        return (
          student.name.toLowerCase().includes(query) ||
          student.studentCode.toLowerCase().includes(query) ||
          student.classGrade.toLowerCase().includes(query) ||
          student.guardianName.toLowerCase().includes(query) ||
          student.contact.toLowerCase().includes(query)
        );
      });
  }, [eligibleStudents, payments, fees, selectedMonth, searchQuery]);

  const totalPending = pendingData.reduce((s, d) => s + d.pendingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pending Fees</h1>
          <p className="text-sm text-muted-foreground">Students with unpaid or partially paid fees</p>
        </div>
        {pendingData.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => {
            const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth;
            downloadCSV(
              `pending-fees-${selectedMonth}.csv`,
              ["S.No", "Student", "Code", "Class", "Guardian", "Contact", "Joining Date", "Leaving Date", "Monthly Expected", "Monthly Paid", "Standalone Pending", "Total Pending", "Status"],
              pendingData.map(({ student, expectedFee, paidAmount, pendingFeeBalance, pendingAmount, status }, index) => [
                String(index + 1), student.name, student.studentCode, student.classGrade, student.guardianName, student.contact,
                student.enrollmentDate, student.leavingDate ?? "", String(expectedFee), String(paidAmount), String(pendingFeeBalance), String(pendingAmount), status === "partial" ? "Partial" : "Unpaid",
              ])
            );
            toast.success(`Exported ${pendingData.length} records for ${monthLabel}`);
          }}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Class</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[220px] justify-between">
                <span className="truncate">{classFilterLabel}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[260px] p-3">
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
                  {classOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No classes found.</p>
                  ) : (
                    classOptions.map((className) => (
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
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search student, code or guardian"
              className="w-[280px] pl-8"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Students</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{pendingData.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pending</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{formatPKR(totalPending)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{students.filter((s) => s.status === "active").length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Fee Details</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">All students have paid for this month! 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">S.No</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Student</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Class</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Guardian</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Joining Date</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Monthly Expected</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Monthly Paid</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Pending Fee</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Pending</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                    {permissions.canCollectFees && <th className="text-center py-3 px-2 font-medium text-muted-foreground">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {pendingData.map(({ student, expectedFee, paidAmount, monthlyPendingAmount, pendingFeeBalance, pendingAmount, status, prorated, nextPendingFee }, index) => (
                    <tr key={student.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2 text-xs text-muted-foreground font-mono">{index + 1}</td>
                      <td className="py-3 px-2">
                        <Link to={`/students/${student.id}`} className="font-medium text-primary hover:underline">
                          {student.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{student.studentCode}</p>
                        {student.leavingDate && (
                          <p className="text-xs text-muted-foreground">Left {student.leavingDate}</p>
                        )}
                      </td>
                      <td className="py-3 px-2">{student.classGrade}</td>
                      <td className="py-3 px-2">{student.guardianName}</td>
                      <td className="py-3 px-2">{student.contact}</td>
                      <td className="py-3 px-2">{student.enrollmentDate}</td>
                      <td className="py-3 px-2 text-right">
                        {formatPKR(expectedFee)}
                        {prorated && <p className="text-xs text-muted-foreground">Prorated</p>}
                      </td>
                      <td className="py-3 px-2 text-right">{formatPKR(paidAmount)}</td>
                      <td className="py-3 px-2 text-right">{formatPKR(pendingFeeBalance)}</td>
                      <td className="py-3 px-2 text-right font-semibold text-destructive">{formatPKR(pendingAmount)}</td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant={status === "partial" ? "secondary" : "destructive"}>
                          {status === "partial" ? "Partial" : "Unpaid"}
                        </Badge>
                      </td>
                      {permissions.canCollectFees && (
                        <td className="py-3 px-2 text-center">
                          <Button size="sm" variant="outline" onClick={() => openPaymentDialog(student, nextPendingFee?.pending ?? monthlyPendingAmount, pendingFeeBalance, nextPendingFee?.month ?? selectedMonth)}>
                            <CreditCard className="h-3 w-3 mr-1" /> Collect
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentStudent && `Collecting fee from ${paymentStudent.student.name} (${paymentStudent.student.classGrade})`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Fee Amount (PKR)</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
              />
              {paymentStudent && (
                <p className="text-xs text-muted-foreground">Monthly fee must be paid in full: {formatPKR(paymentStudent.monthlyPendingAmount)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Pending Fee Payment (PKR)</Label>
              <Input
                type="number"
                min={0}
                max={paymentStudent?.pendingFeeBalance ?? 0}
                value={pendingFeePaymentAmount}
                onChange={(e) => setPendingFeePaymentAmount(e.target.value)}
                placeholder="0"
              />
              {paymentStudent && (
                <p className="text-xs text-muted-foreground">Standalone pending balance: {formatPKR(paymentStudent.pendingFeeBalance)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Any notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={submitting}>
              {submitting ? "Saving..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
