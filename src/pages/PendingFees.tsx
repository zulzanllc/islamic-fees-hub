import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useStudents, usePayments, useFeeStructures } from "@/store/useStore";
import { useAuth } from "@/hooks/useAuth";
import { formatPKR } from "@/lib/currency";
import { format, subMonths } from "date-fns";
import { AlertCircle, CreditCard, Download } from "lucide-react";
import { downloadCSV } from "@/lib/exportCsv";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { Student } from "@/types";
import { getProratedMonthlyAmount, isJoiningMonth } from "@/lib/proration";

export default function PendingFees() {
  const { students } = useStudents();
  const { payments, addPayment } = usePayments();
  const { fees } = useFeeStructures();
  const { user, permissions } = useAuth();

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedClass, setSelectedClass] = useState("all");

  // Payment dialog state
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentStudent, setPaymentStudent] = useState<{ student: Student; pendingAmount: number } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openPaymentDialog = (student: Student, pendingAmount: number) => {
    setPaymentStudent({ student, pendingAmount });
    setPaymentAmount(String(pendingAmount));
    setPaymentMode("cash");
    setPaymentNotes("");
    setPaymentOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentStudent || !paymentAmount) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setSubmitting(true);
    try {
      await addPayment({
        studentId: paymentStudent.student.id,
        feeType: "tuition",
        amountPaid: amount,
        date: format(new Date(), "yyyy-MM-dd"),
        feeMonth: selectedMonth,
        notes: paymentNotes,
        collectedBy: user?.id ?? null,
        paymentMode,
      });
      toast.success(`Payment of ${formatPKR(amount)} recorded for ${paymentStudent.student.name}`);
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

  const activeStudents = useMemo(() => {
    let filtered = students.filter((s) => s.status === "active");
    if (selectedClass !== "all") {
      filtered = filtered.filter((s) => s.classGrade === selectedClass);
    }
    return filtered;
  }, [students, selectedClass]);

  const pendingData = useMemo(() => {
    const paidStudents = new Map<string, number>();
    payments
      .filter((p) => p.feeMonth === selectedMonth)
      .forEach((p) => {
        paidStudents.set(p.studentId, (paidStudents.get(p.studentId) ?? 0) + p.amountPaid);
      });

    return activeStudents.map((student) => {
      const feeStructure = fees.find(
        (f) => f.classGrade === student.classGrade && f.feeType === "tuition"
      );
      const expectedFee = getProratedMonthlyAmount(
        feeStructure?.amount ?? 0,
        student.enrollmentDate,
        selectedMonth
      );
      const paidAmount = paidStudents.get(student.id) ?? 0;
      const pendingAmount = Math.max(0, expectedFee - paidAmount);
      const status: "paid" | "partial" | "unpaid" =
        paidAmount >= expectedFee ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

      return {
        student,
        expectedFee,
        paidAmount,
        pendingAmount,
        status,
        prorated: isJoiningMonth(student.enrollmentDate, selectedMonth),
      };
    }).filter((d) => d.status !== "paid");
  }, [activeStudents, payments, fees, selectedMonth]);

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
              ["Student", "Code", "Class", "Guardian", "Contact", "Joining Date", "Expected", "Paid", "Pending", "Status"],
              pendingData.map(({ student, expectedFee, paidAmount, pendingAmount, status }) => [
                student.name, student.studentCode, student.classGrade, student.guardianName, student.contact,
                student.enrollmentDate, String(expectedFee), String(paidAmount), String(pendingAmount), status === "partial" ? "Partial" : "Unpaid",
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
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classOptions.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <CardContent><div className="text-2xl font-bold">{activeStudents.length}</div></CardContent>
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
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Student</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Class</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Guardian</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Joining Date</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Expected</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Paid</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Pending</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                    {permissions.canEditStudents && <th className="text-center py-3 px-2 font-medium text-muted-foreground">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {pendingData.map(({ student, expectedFee, paidAmount, pendingAmount, status, prorated }) => (
                    <tr key={student.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <Link to={`/students/${student.id}`} className="font-medium text-primary hover:underline">
                          {student.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{student.studentCode}</p>
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
                      <td className="py-3 px-2 text-right font-semibold text-destructive">{formatPKR(pendingAmount)}</td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant={status === "partial" ? "secondary" : "destructive"}>
                          {status === "partial" ? "Partial" : "Unpaid"}
                        </Badge>
                      </td>
                      {permissions.canEditStudents && (
                        <td className="py-3 px-2 text-center">
                          <Button size="sm" variant="outline" onClick={() => openPaymentDialog(student, pendingAmount)}>
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
              <Label>Amount (PKR)</Label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter amount"
              />
              {paymentStudent && (
                <p className="text-xs text-muted-foreground">Pending: {formatPKR(paymentStudent.pendingAmount)}</p>
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
