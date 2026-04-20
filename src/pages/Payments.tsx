import { useEffect, useState } from "react";
import { useStudents, usePayments, useFeeStructures } from "@/store/useStore";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Download, FileText, Search } from "lucide-react";
import { downloadCSV } from "@/lib/exportCsv";
import { format } from "date-fns";
import { formatPKR } from "@/lib/currency";
import { formatFeeMonth } from "@/lib/formatMonth";
import { getProratedMonthlyAmount, isJoiningMonth } from "@/lib/proration";

export default function Payments() {
  const { students } = useStudents();
  const { payments, addPayment } = usePayments();
  const { fees } = useFeeStructures();
  const { user, permissions } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterFeeType, setFilterFeeType] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [searchReceipt, setSearchReceipt] = useState("");

  const currentMonth = format(new Date(), "yyyy-MM");
  const [form, setForm] = useState({
    studentId: "",
    feeType: "tuition" as "tuition" | "registration",
    amountPaid: 0,
    date: format(new Date(), "yyyy-MM-dd"),
    feeMonth: currentMonth,
    paymentMode: "cash",
    notes: "",
  });

  const selectedStudent = students.find((s) => s.id === form.studentId);
  const selectedFee = selectedStudent
    ? fees.find((f) => f.classGrade === selectedStudent.classGrade && f.feeType === form.feeType)
    : undefined;
  const expectedAmount =
    selectedStudent && selectedFee
      ? form.feeType === "tuition"
        ? getProratedMonthlyAmount(selectedFee.amount, selectedStudent.enrollmentDate, form.feeMonth)
        : selectedFee.amount
      : 0;
  const isProrated =
    Boolean(selectedStudent) &&
    form.feeType === "tuition" &&
    isJoiningMonth(selectedStudent?.enrollmentDate ?? "", form.feeMonth);

  useEffect(() => {
    if (!form.studentId || expectedAmount <= 0) return;
    setForm((current) => ({ ...current, amountPaid: expectedAmount }));
  }, [form.studentId, form.feeType, form.feeMonth, expectedAmount]);

  const handleSubmit = () => {
    if (!form.studentId || form.amountPaid <= 0) return;
    addPayment({
      ...form,
      collectedBy: user?.id ?? null,
    });
    setForm({
      studentId: "",
      feeType: "tuition",
      amountPaid: 0,
      date: format(new Date(), "yyyy-MM-dd"),
      feeMonth: currentMonth,
      paymentMode: "cash",
      notes: "",
    });
    setDialogOpen(false);
  };

  const getStudentName = (id: string) =>
    students.find((s) => s.id === id)?.name ?? "Unknown";
  const getStudent = (id: string) => students.find((s) => s.id === id);

  const generateFeeSlip = (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return;
    const student = getStudent(payment.studentId);

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head><title>Fee Slip - ${payment.receiptNumber}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 40px; max-width: 600px; margin: auto; color: #1a1a1a; }
          .header { text-align: center; border-bottom: 3px solid #1a6b4a; padding-bottom: 16px; margin-bottom: 28px; }
          .header h1 { color: #1a6b4a; margin: 0; font-size: 24px; }
          .header p { color: #666; margin: 4px 0 0; font-size: 13px; }
          .header .slip-title { font-size: 16px; font-weight: 700; margin-top: 8px; color: #333; text-transform: uppercase; letter-spacing: 2px; }
          .section { margin-bottom: 20px; }
          .section-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; font-weight: 600; }
          .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
          .label { color: #666; font-size: 14px; }
          .value { font-weight: 600; font-size: 14px; }
          .amount-row { background: #f0faf5; padding: 12px; border-radius: 8px; margin-top: 12px; }
          .amount-row .value { font-size: 22px; color: #1a6b4a; }
          .footer { text-align: center; margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 11px; }
          .stamp { text-align: right; margin-top: 40px; }
          .stamp-line { display: inline-block; width: 200px; border-top: 1px solid #333; padding-top: 4px; font-size: 12px; color: #666; text-align: center; }
          @media print { body { padding: 20px; } }
        </style></head>
        <body>
          <div class="header">
            <h1>☪ Islamic Education Center</h1>
            <p>Fee Payment Slip</p>
            <div class="slip-title">Fee Slip</div>
          </div>
          <div class="section">
            <div class="section-title">Student Information</div>
            <div class="row"><span class="label">Student Name</span><span class="value">${student?.name ?? "Unknown"}</span></div>
            <div class="row"><span class="label">Student Code</span><span class="value">${student?.studentCode ?? "—"}</span></div>
            <div class="row"><span class="label">Class / Grade</span><span class="value">${student?.classGrade ?? "—"}</span></div>
            <div class="row"><span class="label">Guardian</span><span class="value">${student?.guardianName ?? "—"}</span></div>
          </div>
          <div class="section">
            <div class="section-title">Payment Details</div>
            <div class="row"><span class="label">Receipt #</span><span class="value">${payment.receiptNumber}</span></div>
            <div class="row"><span class="label">Payment Date</span><span class="value">${payment.date}</span></div>
            <div class="row"><span class="label">Fee Month</span><span class="value">${formatFeeMonth(payment.feeMonth) || "—"}</span></div>
            <div class="row"><span class="label">Fee Type</span><span class="value" style="text-transform:capitalize">${payment.feeType}</span></div>
            ${payment.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${payment.notes}</span></div>` : ""}
            <div class="row amount-row"><span class="label" style="font-size:16px">Amount Paid</span><span class="value">Rs. ${payment.amountPaid.toLocaleString()}</span></div>
          </div>
          <div class="stamp">
            <span class="stamp-line">Authorized Signature</span>
          </div>
          <div class="footer">
            Thank you for your payment. May Allah bless you.<br/>
            Generated on ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const sortedPayments = [...payments].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filteredPayments = sortedPayments.filter((p) => {
    if (searchReceipt && !p.receiptNumber.toLowerCase().includes(searchReceipt.toLowerCase())) return false;
    if (filterFeeType !== "all" && p.feeType !== filterFeeType) return false;
    if (filterMonth !== "all" && p.feeMonth !== filterMonth) return false;
    if (filterMode !== "all" && p.paymentMode !== filterMode) return false;
    return true;
  });

  const paymentMonths = [...new Set(payments.map((p) => p.feeMonth).filter(Boolean))].sort().reverse();

  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalCount = filteredPayments.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Record and track fee payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const headers = ["Date", "Fee Month", "Student", "Fee Type", "Amount", "Receipt #", "Notes"];
              const rows = sortedPayments.map((p) => [
                p.date,
                p.feeMonth,
                getStudentName(p.studentId),
                p.feeType,
                String(p.amountPaid),
                p.receiptNumber,
                p.notes,
              ]);
              downloadCSV("payments.csv", headers, rows);
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {permissions.canEditStudents && (
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Record Payment
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Student *</Label>
                <Select
                  value={form.studentId}
                  onValueChange={(v) => setForm({ ...form, studentId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students
                      .filter((s) => s.status === "active")
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.classGrade})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fee Type *</Label>
                <Select
                  value={form.feeType}
                  onValueChange={(v: "tuition" | "registration") =>
                    setForm({ ...form, feeType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tuition">Tuition</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (PKR) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.amountPaid || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      amountPaid: parseFloat(e.target.value) || 0,
                    })
                  }
                />
                {selectedStudent && selectedFee && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Suggested {form.feeType === "tuition" ? "tuition" : "fee"}: {formatPKR(expectedAmount)}
                    {isProrated ? " (prorated from joining date)" : ""}
                  </p>
                )}
              </div>
              <div>
                <Label>Fee Month *</Label>
                <Input
                  type="month"
                  value={form.feeMonth}
                  onChange={(e) => setForm({ ...form, feeMonth: e.target.value })}
                />
              </div>
              <div>
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Payment Mode *</Label>
                <Select
                  value={form.paymentMode}
                  onValueChange={(v) => setForm({ ...form, paymentMode: v })}
                >
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
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                Record Payment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Collected {filterMonth !== "all" ? `(${formatFeeMonth(filterMonth)})` : "(All)"}</p>
            <p className="text-2xl font-bold text-foreground">{formatPKR(totalCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Payments Count</p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Receipt #"
                value={searchReceipt}
                onChange={(e) => setSearchReceipt(e.target.value)}
                className="pl-8 w-[180px]"
              />
            </div>
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
                  <SelectItem key={m} value={m}>{formatFeeMonth(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMode} onValueChange={setFilterMode}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Mode" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
            {(searchReceipt || filterFeeType !== "all" || filterMonth !== "all" || filterMode !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchReceipt(""); setFilterFeeType("all"); setFilterMonth("all"); setFilterMode("all"); }}>
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
                <TableHead>Student</TableHead>
                <TableHead>Fee Type</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Collected By</TableHead>
                <TableHead className="text-right">Slip</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No payments recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date}</TableCell>
                    <TableCell>{formatFeeMonth(p.feeMonth)}</TableCell>
                    <TableCell className="font-medium">
                      {getStudentName(p.studentId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {p.feeType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {p.paymentMode.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPKR(p.amountPaid)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.receiptNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {p.collectedBy ? user?.email ?? "Admin" : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => generateFeeSlip(p.id)}
                        title="Generate Fee Slip"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
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
