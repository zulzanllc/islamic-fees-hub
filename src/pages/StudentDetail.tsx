import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStudents, usePayments, useFeeStructures } from "@/store/useStore";
import { useAuth } from "@/hooks/useAuth";
import { formatPKR } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, User, CreditCard, AlertTriangle, Plus } from "lucide-react";
import { format, parseISO, eachMonthOfInterval, startOfMonth } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { getProratedMonthlyAmount, isJoiningMonth } from "@/lib/proration";

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { students } = useStudents();
  const { payments, addPayment } = usePayments();
  const { fees } = useFeeStructures();
  const { user, permissions } = useAuth();

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [filterFeeType, setFilterFeeType] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [payForm, setPayForm] = useState({
    feeType: "tuition" as "tuition" | "registration",
    amountPaid: "",
    feeMonth: format(new Date(), "yyyy-MM"),
    paymentMode: "cash",
    notes: "",
  });

  const resetPayForm = () =>
    setPayForm({
      feeType: "tuition",
      amountPaid: "",
      feeMonth: format(new Date(), "yyyy-MM"),
      paymentMode: "cash",
      notes: "",
    });

  const handleRecordPayment = async () => {
    if (!id || !payForm.amountPaid || parseFloat(payForm.amountPaid) <= 0) return;
    await addPayment({
      studentId: id,
      feeType: payForm.feeType,
      amountPaid: parseFloat(payForm.amountPaid),
      date: format(new Date(), "yyyy-MM-dd"),
      feeMonth: payForm.feeMonth,
      notes: payForm.notes,
      collectedBy: user?.id ?? null,
      paymentMode: payForm.paymentMode,
    });
    toast({ title: "Payment recorded", description: `${formatPKR(parseFloat(payForm.amountPaid))} received.` });
    resetPayForm();
    setPayDialogOpen(false);
  };

  const student = students.find((s) => s.id === id);
  const studentPayments = payments
    .filter((p) => p.studentId === id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredPayments = studentPayments.filter((p) => {
    if (filterFeeType !== "all" && p.feeType !== filterFeeType) return false;
    if (filterMonth !== "all" && p.feeMonth !== filterMonth) return false;
    return true;
  });

  const paymentMonths = [...new Set(studentPayments.map((p) => p.feeMonth).filter(Boolean))].sort().reverse();

  const tuitionFee = fees.find(
    (f) => f.classGrade === student?.classGrade && f.feeType === "tuition"
  );
  const registrationFee = fees.find(
    (f) => f.classGrade === student?.classGrade && f.feeType === "registration"
  );
  const selectedFee = payForm.feeType === "tuition" ? tuitionFee : registrationFee;
  const suggestedAmount =
    student && selectedFee
      ? payForm.feeType === "tuition"
        ? getProratedMonthlyAmount(selectedFee.amount, student.enrollmentDate, payForm.feeMonth)
        : selectedFee.amount
      : 0;
  const suggestedAmountIsProrated =
    Boolean(student) &&
    payForm.feeType === "tuition" &&
    isJoiningMonth(student?.enrollmentDate ?? "", payForm.feeMonth);

  useEffect(() => {
    if (!payDialogOpen || suggestedAmount <= 0) return;
    setPayForm((current) => ({ ...current, amountPaid: String(suggestedAmount) }));
  }, [payDialogOpen, payForm.feeType, payForm.feeMonth, suggestedAmount]);

  // Calculate pending months — from enrollment to now
  const pendingMonths: { month: string; due: number; paid: number; balance: number; prorated: boolean }[] = [];
  if (student && tuitionFee) {
    const enrollDate = parseISO(student.enrollmentDate);
    const now = new Date();
    const months = eachMonthOfInterval({
      start: startOfMonth(enrollDate),
      end: startOfMonth(now),
    });
    for (const m of months) {
      const monthKey = format(m, "yyyy-MM");
      const paidForMonth = studentPayments
        .filter((p) => p.feeMonth === monthKey && p.feeType === "tuition")
        .reduce((sum, p) => sum + p.amountPaid, 0);
      const due = getProratedMonthlyAmount(tuitionFee.amount, student.enrollmentDate, monthKey);
      const balance = due - paidForMonth;
      pendingMonths.push({
        month: monthKey,
        due,
        paid: paidForMonth,
        balance,
        prorated: isJoiningMonth(student.enrollmentDate, monthKey),
      });
    }
  }

  const totalDue = pendingMonths.reduce((s, m) => s + m.due, 0);
  const totalPaid = studentPayments
    .filter((p) => p.feeType === "tuition")
    .reduce((s, p) => s + p.amountPaid, 0);
  const totalPending = totalDue - totalPaid;
  const unpaidMonths = pendingMonths.filter((m) => m.balance > 0);

  if (!student) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Student not found.</p>
        <Button variant="outline" onClick={() => navigate("/students")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Students
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/students")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{student.name}</h1>
          <p className="text-sm text-muted-foreground">
            {student.studentCode} · {student.classGrade}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Dialog open={payDialogOpen} onOpenChange={(open) => { setPayDialogOpen(open); if (!open) resetPayForm(); }}>
            {permissions.canCollectFees && (
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Record Payment
                </Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Payment for {student.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Fee Type</Label>
                  <Select value={payForm.feeType} onValueChange={(v) => setPayForm({ ...payForm, feeType: v as "tuition" | "registration" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tuition">Tuition</SelectItem>
                      <SelectItem value="registration">Registration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fee Month</Label>
                  <Input type="month" value={payForm.feeMonth} onChange={(e) => setPayForm({ ...payForm, feeMonth: e.target.value })} />
                </div>
                <div>
                  <Label>Amount (PKR) *</Label>
                  <Input type="number" min={0} value={payForm.amountPaid} onChange={(e) => setPayForm({ ...payForm, amountPaid: e.target.value })} placeholder="0" />
                  {student && selectedFee && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Suggested {payForm.feeType === "tuition" ? "tuition" : "fee"}: {formatPKR(suggestedAmount)}
                      {suggestedAmountIsProrated ? " (prorated from joining date)" : ""}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={payForm.paymentMode} onValueChange={(v) => setPayForm({ ...payForm, paymentMode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Optional notes" />
                </div>
                <Button onClick={handleRecordPayment} className="w-full">Record Payment</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Badge variant={student.status === "active" ? "default" : "secondary"}>
            {student.status}
          </Badge>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Student Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Guardian</p>
              <p className="font-medium">{student.guardianName || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Contact</p>
              <p className="font-medium">{student.contact || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Joining Date</p>
              <p className="font-medium">{student.enrollmentDate}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Monthly Fee</p>
              <p className="font-medium">{tuitionFee ? formatPKR(tuitionFee.amount) : "Not set"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Fees Due</p>
            <p className="text-2xl font-bold">{formatPKR(totalDue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Paid</p>
            <p className="text-2xl font-bold text-primary">{formatPKR(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Balance</p>
            <p className={`text-2xl font-bold ${totalPending > 0 ? "text-destructive" : ""}`}>
              {formatPKR(Math.max(0, totalPending))}
            </p>
            {unpaidMonths.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {unpaidMonths.length} month(s) unpaid/partial
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Pending Fees ({unpaidMonths.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1">
            <CreditCard className="h-3.5 w-3.5" /> Payment History ({studentPayments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
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
                  {unpaidMonths.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        All fees are paid. 🎉
                      </TableCell>
                    </TableRow>
                  ) : (
                    unpaidMonths.map((m) => (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium">{m.month}</TableCell>
                        <TableCell>
                          {formatPKR(m.due)}
                          {m.prorated && <p className="text-xs text-muted-foreground">Prorated</p>}
                        </TableCell>
                        <TableCell>{formatPKR(m.paid)}</TableCell>
                        <TableCell className="font-semibold text-destructive">
                          {formatPKR(m.balance)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.paid === 0 ? "destructive" : "secondary"}>
                            {m.paid === 0 ? "Unpaid" : "Partial"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Select value={filterFeeType} onValueChange={setFilterFeeType}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Fee Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="tuition">Tuition</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Fee Month" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {paymentMonths.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(filterFeeType !== "all" || filterMonth !== "all") && (
                  <Button variant="ghost" size="sm" onClick={() => { setFilterFeeType("all"); setFilterMonth("all"); }}>
                    Clear Filters
                  </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{filteredPayments.length} record(s)</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Fee Month</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payments found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.date}</TableCell>
                        <TableCell>{p.feeMonth || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{p.feeType}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {p.paymentMode.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{formatPKR(p.amountPaid)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.receiptNumber}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.notes || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
