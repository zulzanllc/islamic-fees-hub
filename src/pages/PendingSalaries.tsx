import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useTeachers, useTeacherSalaries, useTeacherLoans } from "@/store/useTeacherStore";
import { useTeacherAdvances } from "@/store/useTeacherAdvances";
import { formatPKR } from "@/lib/currency";
import { format, subMonths } from "date-fns";
import { AlertCircle, Wallet, Download } from "lucide-react";
import { downloadCSV } from "@/lib/exportCsv";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { Teacher } from "@/types";
import { getProratedMonthlyAmount, isJoiningMonth } from "@/lib/proration";
import { useAuth } from "@/hooks/useAuth";
import ProofUpload from "@/components/ProofUpload";

export default function PendingSalaries() {
  const { teachers } = useTeachers();
  const { salaries, addSalary } = useTeacherSalaries();
  const { loans } = useTeacherLoans();
  const { advances } = useTeacherAdvances();
  const { permissions } = useAuth();
  const teachersOnlyAccess =
    permissions.canViewTeachers &&
    permissions.canPaySalaries &&
    !permissions.canViewStudents &&
    !permissions.canManageRoles;

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  // Payment dialog state
  const [payOpen, setPayOpen] = useState(false);
  const [payTeacher, setPayTeacher] = useState<{ teacher: Teacher; pending: number; loanDeduction: number; baseSalary: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [payProofUrl, setPayProofUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openPayDialog = (teacher: Teacher, pending: number, loanDeduction: number, baseSalary: number) => {
    setPayTeacher({ teacher, pending, loanDeduction, baseSalary });
    setPayAmount(String(pending));
    setPayMode("cash");
    setPayNotes("");
    setPayProofUrl("");
    setPayOpen(true);
  };

  const handlePaySalary = async () => {
    if (!payTeacher || !payAmount) return;
    const amount = Number(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (payMode === "online" && !payProofUrl) {
      toast.error("Please upload payment proof for online payment");
      return;
    }
    if (amount > payTeacher.pending) {
      toast.error(`Maximum payable amount is ${formatPKR(payTeacher.pending)} (advance salary already deducted)`);
      return;
    }
    setSubmitting(true);
    try {
      await addSalary({
        teacherId: payTeacher.teacher.id,
        month: selectedMonth,
        baseSalary: payTeacher.baseSalary,
        loanDeduction: payTeacher.loanDeduction,
        otherDeduction: 0,
        netPaid: amount,
        datePaid: format(new Date(), "yyyy-MM-dd"),
        notes: payNotes,
        paymentMode: payMode as "cash" | "online",
        receiptUrl: "",
        proofImageUrl: payProofUrl,
        customAmount: amount !== payTeacher.pending ? amount : 0,
      });
      toast.success(`Salary of ${formatPKR(amount)} paid to ${payTeacher.teacher.name}`);
      setPayOpen(false);
    } catch {
      toast.error("Failed to record salary payment");
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

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status === "active"),
    [teachers]
  );

  const pendingData = useMemo(() => {
    const paidTeachers = new Map<string, number>();
    salaries
      .filter((s) => s.month === selectedMonth)
      .forEach((s) => {
        paidTeachers.set(s.teacherId, (paidTeachers.get(s.teacherId) ?? 0) + s.netPaid);
      });

    return activeTeachers.map((teacher) => {
      const baseSalary = getProratedMonthlyAmount(
        teacher.monthlySalary,
        teacher.joiningDate,
        selectedMonth
      );
      const activeLoans = loans.filter((l) => l.teacherId === teacher.id && l.status === "active");
      const loanDeduction = activeLoans.reduce((sum, l) => {
        if (l.repaymentType === "percentage" && l.repaymentPercentage) {
          return sum + (baseSalary * l.repaymentPercentage) / 100;
        }
        if (l.repaymentType === "custom_amount" && l.repaymentAmount) {
          return sum + Math.min(l.repaymentAmount, baseSalary);
        }
        if (l.repaymentType === "specific_month" && l.repaymentMonth === selectedMonth) {
          return sum + Math.min(l.remaining, baseSalary);
        }
        return sum;
      }, 0);
      const manualLoanAdvance = activeLoans
        .filter((loan) => loan.repaymentType === "manual")
        .reduce((sum, loan) => sum + loan.remaining, 0);
      const recordedAdvance = advances
        .filter((advance) => advance.teacherId === teacher.id && advance.month === selectedMonth)
        .reduce((sum, advance) => sum + advance.amount, 0);
      const advanceTaken = manualLoanAdvance + recordedAdvance;

      const expectedSalary = Math.max(0, baseSalary - loanDeduction - advanceTaken);
      const paidAmount = paidTeachers.get(teacher.id) ?? 0;
      const pendingAmount = Math.max(0, expectedSalary - paidAmount);
      const status: "paid" | "partial" | "unpaid" =
        paidAmount >= expectedSalary ? "paid" : paidAmount > 0 ? "partial" : "unpaid";

      // Estimate loan completion
      let estCompletion = "—";
      if (activeLoans.length > 0) {
        const totalRemaining = activeLoans.reduce((s, l) => s + l.remaining, 0);
        if (totalRemaining <= 0) {
          estCompletion = "Completed";
        } else {
          const totalMonthlyDeduction = activeLoans.reduce((s, l) => {
            if (l.repaymentType === "percentage" && l.repaymentPercentage) {
              return s + teacher.monthlySalary * (l.repaymentPercentage / 100);
            }
            if (l.repaymentType === "custom_amount" && l.repaymentAmount) {
              return s + l.repaymentAmount;
            }
            if (l.repaymentType === "specific_month" && l.repaymentMonth) {
              return s; // handled separately
            }
            return s;
          }, 0);

          // Find the latest specific_month deadline
          const specificMonths = activeLoans
            .filter((l) => l.repaymentType === "specific_month" && l.repaymentMonth)
            .map((l) => l.repaymentMonth!);

          if (totalMonthlyDeduction > 0) {
            const monthsLeft = Math.ceil(totalRemaining / totalMonthlyDeduction);
            const completionDate = new Date();
            completionDate.setMonth(completionDate.getMonth() + monthsLeft);
            estCompletion = format(completionDate, "MMM yyyy");
          } else if (specificMonths.length > 0) {
            estCompletion = specificMonths.sort().pop()!;
          } else {
            estCompletion = "Manual";
          }
        }
      }

      return {
        teacher,
        baseSalary,
        loanDeduction,
        advanceTaken,
        expectedSalary,
        paidAmount,
        pendingAmount,
        status,
        estCompletion,
        prorated: isJoiningMonth(teacher.joiningDate, selectedMonth),
      };
    }).filter((d) => d.status !== "paid");
  }, [activeTeachers, salaries, loans, advances, selectedMonth]);

  const totalPending = pendingData.reduce((s, d) => s + d.pendingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pending Salaries</h1>
          <p className="text-sm text-muted-foreground">Teachers with unpaid or partially paid salaries</p>
        </div>
        {pendingData.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => {
            const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label ?? selectedMonth;
            downloadCSV(
              `pending-salaries-${selectedMonth}.csv`,
              ["Teacher", "Contact", "CNIC", "Joining Date", "Base Salary", "Loan Deduction", "Advance Deduction", "Net Expected", "Paid", "Pending", "Status"],
              pendingData.map(({ teacher, baseSalary, loanDeduction, advanceTaken, expectedSalary, paidAmount, pendingAmount, status }) => [
                teacher.name, teacher.contact, teacher.cnic, teacher.joiningDate,
                String(baseSalary), String(loanDeduction), String(advanceTaken), String(expectedSalary),
                String(paidAmount), String(pendingAmount), status === "partial" ? "Partial" : "Unpaid",
              ])
            );
            toast.success(`Exported ${pendingData.length} records for ${monthLabel}`);
          }}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        )}
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unpaid Teachers</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Teachers</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{activeTeachers.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Salary Details</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">All teachers have been paid for this month! 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Teacher</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Joining Date</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">Base Salary</th>
                     <th className="text-right py-3 px-2 font-medium text-muted-foreground">Loan Ded.</th>
                     <th className="text-right py-3 px-2 font-medium text-muted-foreground">Advance Ded.</th>
                     <th className="text-right py-3 px-2 font-medium text-muted-foreground">Est. Completion</th>
                     <th className="text-right py-3 px-2 font-medium text-muted-foreground">Net Expected</th>
                     <th className="text-right py-3 px-2 font-medium text-muted-foreground">Paid</th>
                     <th className="text-right py-3 px-2 font-medium text-muted-foreground">Pending</th>
                     <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                     {permissions.canPaySalaries && <th className="text-center py-3 px-2 font-medium text-muted-foreground">Action</th>}
                  </tr>
                </thead>
                <tbody>
                   {pendingData.map(({ teacher, baseSalary, loanDeduction, advanceTaken, expectedSalary, paidAmount, pendingAmount, status, estCompletion, prorated }) => (
                     <tr key={teacher.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                       <td className="py-3 px-2">
                         {teachersOnlyAccess ? (
                           <span className="font-medium">{teacher.name}</span>
                         ) : (
                           <Link to={`/teachers/${teacher.id}`} className="font-medium text-primary hover:underline">
                             {teacher.name}
                           </Link>
                         )}
                         <p className="text-xs text-muted-foreground">{teacher.cnic}</p>
                       </td>
                       <td className="py-3 px-2">{teacher.contact}</td>
                       <td className="py-3 px-2">{teacher.joiningDate}</td>
                       <td className="py-3 px-2 text-right">
                         {formatPKR(baseSalary)}
                         {prorated && <p className="text-xs text-muted-foreground">Prorated</p>}
                       </td>
                       <td className="py-3 px-2 text-right">{loanDeduction > 0 ? formatPKR(loanDeduction) : "—"}</td>
                       <td className="py-3 px-2 text-right">{advanceTaken > 0 ? formatPKR(advanceTaken) : "—"}</td>
                       <td className="py-3 px-2 text-right text-xs text-muted-foreground">{estCompletion}</td>
                      <td className="py-3 px-2 text-right">{formatPKR(expectedSalary)}</td>
                      <td className="py-3 px-2 text-right">{formatPKR(paidAmount)}</td>
                      <td className="py-3 px-2 text-right font-semibold text-destructive">{formatPKR(pendingAmount)}</td>
                      <td className="py-3 px-2 text-center">
                        <Badge variant={status === "partial" ? "secondary" : "destructive"}>
                          {status === "partial" ? "Partial" : "Unpaid"}
                        </Badge>
                      </td>
                      {permissions.canPaySalaries && (
                        <td className="py-3 px-2 text-center">
                          <Button size="sm" variant="outline" onClick={() => openPayDialog(teacher, pendingAmount, loanDeduction, baseSalary)}>
                            <Wallet className="h-3 w-3 mr-1" /> Pay
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

      {/* Pay Salary Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay Salary</DialogTitle>
            <DialogDescription>
              {payTeacher && `Paying salary to ${payTeacher.teacher.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount (PKR)</Label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter amount"
              />
              {payTeacher && (
                <p className="text-xs text-muted-foreground">Pending: {formatPKR(payTeacher.pending)}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Payment Mode</Label>
              <Select value={payMode} onValueChange={setPayMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payMode === "online" && (
              <ProofUpload
                value={payProofUrl}
                onChange={setPayProofUrl}
                required
              />
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} placeholder="Any notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handlePaySalary} disabled={submitting}>
              {submitting ? "Saving..." : "Pay Salary"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
