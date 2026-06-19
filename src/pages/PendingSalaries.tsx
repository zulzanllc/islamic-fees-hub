import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useTeachers, useTeacherSalaries, useTeacherLoans, useTeacherSalarySettings } from "@/store/useTeacherStore";
import { useTeacherAdvances } from "@/store/useTeacherAdvances";
import { formatPKR } from "@/lib/currency";
import { format, subMonths } from "date-fns";
import { AlertCircle, Wallet, Download, Search } from "lucide-react";
import { downloadCSV } from "@/lib/exportCsv";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { Teacher } from "@/types";
import { getTeacherPendingSalaryDetails } from "@/lib/teacherPendingSalary";
import { useAuth } from "@/hooks/useAuth";
import ProofUpload from "@/components/ProofUpload";

export default function PendingSalaries() {
  const { teachers } = useTeachers();
  const { salaries, addSalary } = useTeacherSalaries();
  const { loans } = useTeacherLoans();
  const { settings } = useTeacherSalarySettings();
  const { advances } = useTeacherAdvances();
  const { permissions } = useAuth();
  const teachersOnlyAccess =
    permissions.canViewTeachers &&
    permissions.canPaySalaries &&
    !permissions.canViewStudents &&
    !permissions.canManageRoles;

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [searchQuery, setSearchQuery] = useState("");

  // Payment dialog state
  const [payOpen, setPayOpen] = useState(false);
  const [payTeacher, setPayTeacher] = useState<{
    teacher: Teacher;
    pending: number;
    loanDeduction: number;
    baseSalary: number;
    advanceTaken: number;
    otherDeduction: number;
    expectedSalary: number;
    paidAmount: number;
    prorated: boolean;
    estCompletion: string;
    loanBreakdown: Array<{
      id: string;
      amount: number;
      modeLabel: string;
      deduction: number;
    }>;
    totalLoanRemaining: number;
  } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("cash");
  const [payNotes, setPayNotes] = useState("");
  const [payProofUrl, setPayProofUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openPayDialog = (teacher: Teacher, pendingDetails: NonNullable<typeof pendingData>[number]) => {
    setPayTeacher({
      teacher,
      pending: pendingDetails.pendingAmount,
      loanDeduction: pendingDetails.loanDeduction,
      baseSalary: pendingDetails.baseSalary,
      advanceTaken: pendingDetails.advanceTaken,
      otherDeduction: pendingDetails.otherDeduction,
      expectedSalary: pendingDetails.expectedSalary,
      paidAmount: pendingDetails.paidAmount,
      prorated: pendingDetails.prorated,
      estCompletion: pendingDetails.estCompletion,
      loanBreakdown: pendingDetails.loanBreakdown,
      totalLoanRemaining: pendingDetails.totalLoanRemaining,
    });
    setPayAmount(String(pendingDetails.pendingAmount));
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
        loanDeduction: payTeacher.loanDeduction + payTeacher.advanceTaken,
        otherDeduction: 0,
        bonusAmount: 0,
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
    return activeTeachers
      .map((teacher) =>
        getTeacherPendingSalaryDetails({
          teacher,
          month: selectedMonth,
          salaries,
          loans,
          advances,
          annualIncrementPercentage: settings.annualIncrementPercentage,
        })
      )
      .filter((d) => d.status !== "paid")
      .filter((details) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        const teacher = details.teacher;
        return (
          teacher.name.toLowerCase().includes(query) ||
          teacher.contact.toLowerCase().includes(query) ||
          teacher.cnic.toLowerCase().includes(query) ||
          teacher.joiningDate.toLowerCase().includes(query)
        );
      });
  }, [activeTeachers, salaries, loans, advances, selectedMonth, settings.annualIncrementPercentage, searchQuery]);

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
              ["S.No", "Teacher", "Contact", "CNIC", "Joining Date", "Base Salary", "Loan Deduction", "Advance Deduction", "Other Deduction", "Net Expected", "Paid", "Pending", "Status"],
              pendingData.map(({ teacher, baseSalary, loanDeduction, advanceTaken, otherDeduction, expectedSalary, paidAmount, pendingAmount, status }, index) => [
                String(index + 1), teacher.name, teacher.contact, teacher.cnic, teacher.joiningDate,
                String(baseSalary), String(loanDeduction), String(advanceTaken), String(otherDeduction), String(expectedSalary),
                String(paidAmount), String(pendingAmount), status === "partial" ? "Partial" : "Unpaid",
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
          <label className="text-sm font-medium text-muted-foreground">Search</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search teacher, contact or CNIC"
              className="w-[260px] pl-8"
            />
          </div>
        </div>
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
            <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky top-0 z-10 bg-background text-left py-3 px-2 font-medium text-muted-foreground">S.No</th>
                    <th className="sticky top-0 z-10 bg-background text-left py-3 px-2 font-medium text-muted-foreground">Teacher</th>
                    <th className="sticky top-0 z-10 bg-background text-left py-3 px-2 font-medium text-muted-foreground">Contact</th>
                    <th className="sticky top-0 z-10 bg-background text-left py-3 px-2 font-medium text-muted-foreground">Joining Date</th>
                     <th className="sticky top-0 z-10 bg-background text-right py-3 px-2 font-medium text-muted-foreground">Base Salary</th>
                     <th className="sticky top-0 z-10 bg-background text-right py-3 px-2 font-medium text-muted-foreground">Loan Ded.</th>
                     <th className="sticky top-0 z-10 bg-background text-right py-3 px-2 font-medium text-muted-foreground">Advance Ded.</th>
                     <th className="sticky top-0 z-10 bg-background text-right py-3 px-2 font-medium text-muted-foreground">Other Ded.</th>
                     <th className="sticky top-0 z-10 bg-background text-right py-3 px-2 font-medium text-muted-foreground">Est. Completion</th>
                     <th className="sticky top-0 z-10 bg-background text-right py-3 px-2 font-medium text-muted-foreground">Net Expected</th>
                     <th className="sticky top-0 z-10 bg-background text-right py-3 px-2 font-medium text-muted-foreground">Paid</th>
                     <th className="sticky top-0 z-10 bg-background text-right py-3 px-2 font-medium text-muted-foreground">Pending</th>
                     <th className="sticky top-0 z-10 bg-background text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                     {permissions.canPaySalaries && <th className="sticky top-0 z-10 bg-background text-center py-3 px-2 font-medium text-muted-foreground">Action</th>}
                  </tr>
                </thead>
                <tbody>
                   {pendingData.map((details, index) => {
                     const { teacher, baseSalary, loanDeduction, advanceTaken, otherDeduction, expectedSalary, paidAmount, pendingAmount, status, estCompletion, prorated } = details;
                     return (
                     <tr key={teacher.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                       <td className="py-3 px-2 text-xs text-muted-foreground font-mono">{index + 1}</td>
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
                       <td className="py-3 px-2 text-right">{otherDeduction > 0 ? formatPKR(otherDeduction) : "—"}</td>
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
                          <Button size="sm" variant="outline" onClick={() => openPayDialog(teacher, details)}>
                            <Wallet className="h-3 w-3 mr-1" /> Pay
                          </Button>
                        </td>
                      )}
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pay Salary Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pay Salary</DialogTitle>
            <DialogDescription>
              {payTeacher && `Paying salary to ${payTeacher.teacher.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {payTeacher && (
              <div className="bg-muted p-3 rounded-md text-sm space-y-2">
                <p>
                  Base Salary: <strong>{formatPKR(payTeacher.baseSalary)}</strong>
                  {payTeacher.prorated && (
                    <span className="text-xs text-muted-foreground"> (prorated from joining date)</span>
                  )}
                </p>
                <p>
                  Loan Deduction: <strong className="text-destructive">
                    {payTeacher.loanDeduction > 0 ? `-${formatPKR(payTeacher.loanDeduction)}` : "—"}
                  </strong>
                </p>
                <p>
                  Advance Already Paid: <strong className="text-destructive">
                    {payTeacher.advanceTaken > 0 ? `-${formatPKR(payTeacher.advanceTaken)}` : "—"}
                  </strong>
                </p>
                <p>
                  Other Deduction: <strong className="text-destructive">
                    {payTeacher.otherDeduction > 0 ? `-${formatPKR(payTeacher.otherDeduction)}` : "—"}
                  </strong>
                </p>
                {payTeacher.loanBreakdown.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-2 mt-1">
                    <p className="text-xs font-medium text-muted-foreground">Loan Breakdown:</p>
                    {payTeacher.loanBreakdown.map((loan) => (
                      <div key={loan.id} className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground">
                          {formatPKR(loan.amount)} loan — <span className="italic">{loan.modeLabel}</span>
                        </span>
                        <span className="text-destructive font-medium">
                          {loan.deduction > 0 ? `-${formatPKR(loan.deduction)}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {payTeacher.loanBreakdown.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Outstanding loans: {formatPKR(payTeacher.totalLoanRemaining)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Estimated completion: {payTeacher.estCompletion}
                    </p>
                  </>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 border-t border-border pt-2 mt-1">
                  <p>
                    Net Expected: <strong>{formatPKR(payTeacher.expectedSalary)}</strong>
                  </p>
                  <p>
                    Already Paid: <strong>{formatPKR(payTeacher.paidAmount)}</strong>
                  </p>
                  <p>
                    Remaining Pending: <strong className="text-destructive">{formatPKR(payTeacher.pending)}</strong>
                  </p>
                </div>
              </div>
            )}
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
