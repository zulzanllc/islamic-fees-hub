import { useState, useMemo, useEffect } from "react";
import { useTeachers, useTeacherSalaries, useTeacherLoans, useTeacherSalarySettings } from "@/store/useTeacherStore";
import { useTeacherAdvances } from "@/store/useTeacherAdvances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertCircle, Printer, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatPKR } from "@/lib/currency";
import { getProratedMonthlyAmount, isJoiningMonth } from "@/lib/proration";
import { getEffectiveTeacherMonthlySalary } from "@/lib/teacherSalary";
import { useAuth } from "@/hooks/useAuth";
import ProofUpload from "@/components/ProofUpload";
import type { TeacherLoan } from "@/types";

type LoanRepaymentEdit = {
  repaymentType: TeacherLoan["repaymentType"];
  repaymentMonth: string;
  repaymentPercentage: number;
  repaymentAmount: number;
};

export default function TeacherSalaries() {
  const { teachers } = useTeachers();
  const { salaries, loading, addSalary, updateSalary, deleteSalary } = useTeacherSalaries();
  const { loans, updateLoan } = useTeacherLoans();
  const { settings } = useTeacherSalarySettings();
  const { advances } = useTeacherAdvances();
  const { permissions } = useAuth();
  const [open, setOpen] = useState(false);
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [salaryTeacherSearch, setSalaryTeacherSearch] = useState("");
  const [filterTeacherSearch, setFilterTeacherSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editSalary, setEditSalary] = useState<{ id: string; otherDeduction: number; notes: string; baseSalary: number; loanDeduction: number } | null>(null);
  const [form, setForm] = useState({
    teacherId: "",
    month: format(new Date(), "yyyy-MM"),
    otherDeduction: 0,
    notes: "",
    datePaid: format(new Date(), "yyyy-MM-dd"),
    paymentMode: "cash" as "cash" | "online",
    receiptUrl: "",
    proofImageUrl: "",
    skipLoanDeduction: false,
  });
  const [loanRepaymentEdits, setLoanRepaymentEdits] = useState<Record<string, LoanRepaymentEdit>>({});

  const selectedTeacher = teachers.find((t) => t.id === form.teacherId);
  const activeLoans = loans.filter((l) => l.teacherId === form.teacherId && l.status === "active");
  const totalLoanRemaining = activeLoans.reduce((s, l) => s + l.remaining, 0);
  const selectedTeacherMonthlySalary = selectedTeacher
    ? getEffectiveTeacherMonthlySalary(
        selectedTeacher.monthlySalary,
        selectedTeacher.joiningDate,
        form.month,
        settings.annualIncrementPercentage
      )
    : 0;
  const baseSalary = selectedTeacher
    ? getProratedMonthlyAmount(selectedTeacherMonthlySalary, selectedTeacher.joiningDate, form.month)
    : 0;
  const isBaseSalaryProrated =
    Boolean(selectedTeacher) && isJoiningMonth(selectedTeacher?.joiningDate ?? "", form.month);
  const advanceForMonth = advances
    .filter((advance) => advance.teacherId === form.teacherId && advance.month === form.month)
    .reduce((sum, advance) => sum + advance.amount, 0);

  useEffect(() => {
    if (!open || !form.teacherId) {
      setLoanRepaymentEdits({});
      return;
    }

    const nextEdits: Record<string, LoanRepaymentEdit> = {};
    loans
      .filter((loan) => loan.teacherId === form.teacherId && loan.status === "active")
      .forEach((loan) => {
        nextEdits[loan.id] = {
          repaymentType: loan.repaymentType,
          repaymentMonth: loan.repaymentMonth ?? "",
          repaymentPercentage: loan.repaymentPercentage ?? 0,
          repaymentAmount: loan.repaymentAmount ?? 0,
        };
      });
    setLoanRepaymentEdits(nextEdits);
  }, [open, form.teacherId, loans]);

  const updateLoanRepaymentEdit = (loanId: string, updates: Partial<LoanRepaymentEdit>) => {
    setLoanRepaymentEdits((current) => ({
      ...current,
      [loanId]: {
        ...current[loanId],
        ...updates,
      },
    }));
  };

  const getLoanWithRepaymentEdit = (loan: TeacherLoan): TeacherLoan => {
    const edit = loanRepaymentEdits[loan.id];
    if (!edit) return loan;

    return {
      ...loan,
      repaymentType: edit.repaymentType,
      repaymentMonth: edit.repaymentType === "specific_month" ? edit.repaymentMonth : null,
      repaymentPercentage: edit.repaymentType === "percentage" ? edit.repaymentPercentage : null,
      repaymentAmount: edit.repaymentType === "custom_amount" ? edit.repaymentAmount : null,
    };
  };

  const getScheduledDeductionForLoan = (loan: TeacherLoan) => {
    if (loan.repaymentType === "percentage" && loan.repaymentPercentage) {
      return Math.min(baseSalary * (loan.repaymentPercentage / 100), loan.remaining);
    }
    if (loan.repaymentType === "custom_amount" && loan.repaymentAmount) {
      return Math.min(loan.repaymentAmount, loan.remaining);
    }
    if (loan.repaymentType === "specific_month" && loan.repaymentMonth === form.month) {
      return loan.remaining;
    }
    return 0;
  };

  const getLoanRepaymentLabel = (loan: TeacherLoan) => {
    if (loan.repaymentType === "specific_month") {
      return loan.repaymentMonth ? `Return in ${loan.repaymentMonth}` : "Return in specific month";
    }
    if (loan.repaymentType === "percentage") {
      return `${loan.repaymentPercentage ?? 0}% from salary monthly`;
    }
    if (loan.repaymentType === "custom_amount") {
      return `${formatPKR(loan.repaymentAmount ?? 0)} fixed monthly`;
    }
    return "Manual - no auto deduction";
  };

  const getLoanDeductionNote = (loan: TeacherLoan, scheduledDeduction: number) => {
    if (scheduledDeduction > 0) return "Deducting this salary";
    if (loan.repaymentType === "specific_month" && loan.repaymentMonth !== form.month) {
      return `Scheduled for ${loan.repaymentMonth || "a specific month"}`;
    }
    if (loan.repaymentType === "manual") return "Manual repayment only";
    return "No deduction this month";
  };

  const loanDeductionDetails = activeLoans.map((loan) => {
    const effectiveLoan = getLoanWithRepaymentEdit(loan);
    const scheduledDeduction = getScheduledDeductionForLoan(effectiveLoan);
    const deduction = form.skipLoanDeduction ? 0 : scheduledDeduction;
    return {
      loan,
      effectiveLoan,
      scheduledDeduction,
      deduction,
      remainingAfter: Math.max(0, loan.remaining - deduction),
      repaymentLabel: getLoanRepaymentLabel(effectiveLoan),
      note: form.skipLoanDeduction && scheduledDeduction > 0 ? "Skipped this salary" : getLoanDeductionNote(effectiveLoan, scheduledDeduction),
    };
  });

  const scheduledLoanDeduction = loanDeductionDetails.reduce((total, item) => total + item.scheduledDeduction, 0);
  const loanDeduction = form.skipLoanDeduction ? 0 : scheduledLoanDeduction;

  const netPaid = baseSalary - loanDeduction - advanceForMonth - form.otherDeduction;

  const currentMonth = format(new Date(), "yyyy-MM");
  const paidTeacherIds = new Set(salaries.filter((s) => s.month === currentMonth).map((s) => s.teacherId));
  const pendingTeachers = teachers.filter(
    (t) =>
      t.status === "active" &&
      !paidTeacherIds.has(t.id) &&
      getProratedMonthlyAmount(
        getEffectiveTeacherMonthlySalary(t.monthlySalary, t.joiningDate, currentMonth, settings.annualIncrementPercentage),
        t.joiningDate,
        currentMonth
      ) > 0
  );
  const pendingTeacherTotal = pendingTeachers.reduce(
    (sum, teacher) =>
      sum +
      getProratedMonthlyAmount(
        getEffectiveTeacherMonthlySalary(teacher.monthlySalary, teacher.joiningDate, currentMonth, settings.annualIncrementPercentage),
        teacher.joiningDate,
        currentMonth
      ),
    0
  );

  const paidForSelectedMonth = new Set(salaries.filter((s) => s.month === form.month).map((s) => s.teacherId));
  const unpaidActiveTeachers = teachers.filter((teacher) => teacher.status === "active" && !paidForSelectedMonth.has(teacher.id));
  const filteredUnpaidActiveTeachers = useMemo(() => {
    const query = salaryTeacherSearch.trim().toLowerCase();
    if (!query) return unpaidActiveTeachers;
    return unpaidActiveTeachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(query) ||
      teacher.contact.toLowerCase().includes(query) ||
      teacher.cnic.toLowerCase().includes(query)
    );
  }, [unpaidActiveTeachers, salaryTeacherSearch]);
  const filteredSalaryHistoryTeachers = useMemo(() => {
    const query = filterTeacherSearch.trim().toLowerCase();
    if (!query) return teachers;

    return teachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(query) ||
      teacher.contact.toLowerCase().includes(query) ||
      teacher.cnic.toLowerCase().includes(query)
    );
  }, [teachers, filterTeacherSearch]);

  const handleSubmit = async () => {
    if (!form.teacherId) { toast.error("Select a teacher"); return; }
    if (paidForSelectedMonth.has(form.teacherId)) { toast.error("Salary already paid for this teacher this month"); return; }
    if (form.paymentMode === "online" && !form.proofImageUrl) { toast.error("Please upload payment proof for online payment"); return; }
    for (const item of loanDeductionDetails) {
      const loan = item.effectiveLoan;
      if (loan.repaymentType === "specific_month" && !loan.repaymentMonth) {
        toast.error("Select the return month for loan repayment");
        return;
      }
      if (loan.repaymentType === "percentage" && (!loan.repaymentPercentage || loan.repaymentPercentage <= 0 || loan.repaymentPercentage > 100)) {
        toast.error("Enter a valid loan deduction percentage (1-100)");
        return;
      }
      if (loan.repaymentType === "custom_amount" && (!loan.repaymentAmount || loan.repaymentAmount <= 0)) {
        toast.error("Enter a valid loan monthly deduction amount");
        return;
      }
    }
    await addSalary({
      teacherId: form.teacherId, month: form.month, baseSalary, loanDeduction: loanDeduction + advanceForMonth,
      otherDeduction: form.otherDeduction, netPaid, datePaid: form.datePaid, notes: form.notes,
      paymentMode: form.paymentMode, receiptUrl: form.receiptUrl,
      proofImageUrl: form.proofImageUrl, customAmount: 0,
    });
    for (const item of loanDeductionDetails) {
      const repaymentChanged =
        item.loan.repaymentType !== item.effectiveLoan.repaymentType ||
        item.loan.repaymentMonth !== item.effectiveLoan.repaymentMonth ||
        item.loan.repaymentPercentage !== item.effectiveLoan.repaymentPercentage ||
        item.loan.repaymentAmount !== item.effectiveLoan.repaymentAmount;

      if (item.deduction <= 0 && !repaymentChanged) continue;

      const loanUpdates: Partial<TeacherLoan> = {};
      if (repaymentChanged) {
        loanUpdates.repaymentType = item.effectiveLoan.repaymentType;
        loanUpdates.repaymentMonth = item.effectiveLoan.repaymentMonth;
        loanUpdates.repaymentPercentage = item.effectiveLoan.repaymentPercentage;
        loanUpdates.repaymentAmount = item.effectiveLoan.repaymentAmount;
      }
      if (item.deduction > 0) {
        loanUpdates.remaining = item.remainingAfter;
        loanUpdates.status = item.remainingAfter <= 0 ? "paid" : "active";
      }
      await updateLoan(item.loan.id, loanUpdates);
    }
    toast.success("Salary recorded");
    setOpen(false);
    setForm({
      teacherId: "", month: format(new Date(), "yyyy-MM"), otherDeduction: 0, notes: "",
      datePaid: format(new Date(), "yyyy-MM-dd"), paymentMode: "cash", receiptUrl: "", proofImageUrl: "",
      skipLoanDeduction: false,
    });
    setSalaryTeacherSearch("");
    setLoanRepaymentEdits({});
  };

  const getTeacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? "Unknown";
  const getAdvanceDeductionForSalary = (teacherId: string, month: string) =>
    advances
      .filter((advance) => advance.teacherId === teacherId && advance.month === month)
      .reduce((sum, advance) => sum + advance.amount, 0);

  const printSalarySlip = (salaryId: string) => {
    const s = salaries.find((sal) => sal.id === salaryId);
    if (!s) return;
    const teacher = teachers.find((t) => t.id === s.teacherId);
    const win = window.open("", "_blank", "width=600,height=700");
    if (!win) return;
    win.document.write(`
      <html><head><title>Salary Slip</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a1a; font-weight: 700; }
        .header { text-align: center; border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { font-size: 22px; margin-bottom: 4px; }
        .header p { font-size: 12px; color: #666; font-weight: 700; }
        .slip-title { text-align: center; font-size: 16px; font-weight: bold; background: #f0f0f0; padding: 8px; margin-bottom: 20px; border-radius: 4px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin-bottom: 20px; font-size: 13px; }
        .info-grid .label { color: #666; font-weight: 700; }
        .info-grid .value { font-weight: 700; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; font-weight: 700; }
        th { background: #f5f5f5; font-weight: 700; }
        .amount { text-align: right; }
        .deduction { color: #dc2626; }
        .net-row { background: #f0fdf4; font-weight: bold; }
        .net-row .amount { color: #16a34a; font-size: 15px; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; }
        .sig-line { border-top: 1px solid #333; padding-top: 5px; width: 150px; text-align: center; font-weight: 700; }
        .print-date { text-align: center; font-size: 11px; color: #999; margin-top: 30px; font-weight: 700; }
        @media print { body { padding: 15px; } }
      </style></head><body>
      <div class="header">
        <h1>Salary Slip</h1>
        <p>Payment Receipt</p>
      </div>
      <div class="slip-title">Month: ${s.month}</div>
      <div class="info-grid">
        <span class="label">Teacher Name:</span><span class="value">${teacher?.name ?? "Unknown"}</span>
        <span class="label">CNIC:</span><span class="value">${teacher?.cnic ?? "—"}</span>
        <span class="label">Contact:</span><span class="value">${teacher?.contact ?? "—"}</span>
        <span class="label">Date Paid:</span><span class="value">${s.datePaid}</span>
        <span class="label">Payment Mode:</span><span class="value">${s.paymentMode === "online" ? "Online" : "Cash"}</span>
        <span class="label">Joining Date:</span><span class="value">${teacher?.joiningDate ?? "—"}</span>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead>
        <tbody>
          <tr><td>Base Salary${s.customAmount > 0 ? " (Custom)" : ""}</td><td class="amount">${formatPKR(s.baseSalary)}</td></tr>
          <tr><td>Loan Deduction</td><td class="amount deduction">-${formatPKR(s.loanDeduction)}</td></tr>
          <tr><td>Other Deduction</td><td class="amount deduction">-${formatPKR(s.otherDeduction)}</td></tr>
          <tr class="net-row"><td><strong>Net Pay</strong></td><td class="amount">${formatPKR(s.netPaid)}</td></tr>
        </tbody>
      </table>
      ${s.notes ? `<p style="font-size:12px;color:#666;margin-bottom:20px;"><strong>Notes:</strong> ${s.notes}</p>` : ""}
      <div class="footer">
        <div class="sig-line">Teacher Signature</div>
        <div class="sig-line">Authorized Signature</div>
      </div>
      <p class="print-date">Printed on: ${format(new Date(), "yyyy-MM-dd HH:mm")}</p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const openEditDialog = (salary: typeof salaries[0]) => {
    setEditSalary({
      id: salary.id,
      otherDeduction: salary.otherDeduction,
      notes: salary.notes,
      baseSalary: salary.baseSalary,
      loanDeduction: salary.loanDeduction,
    });
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editSalary) return;
    const newNet = editSalary.baseSalary - editSalary.loanDeduction - editSalary.otherDeduction;
    const error = await updateSalary(editSalary.id, {
      otherDeduction: editSalary.otherDeduction,
      netPaid: newNet,
      notes: editSalary.notes,
    });
    if (error) {
      toast.error("Failed to update salary record");
      return;
    }
    toast.success("Salary record updated");
    setEditOpen(false);
    setEditSalary(null);
  };

  const handleDeleteSalary = async (id: string) => {
    if (!confirm("Are you sure you want to delete this salary record? This action cannot be undone.")) return;
    const error = await deleteSalary(id);
    if (error) {
      toast.error("Failed to delete salary record");
      return;
    }
    toast.success("Salary record deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teacher Salaries</h1>
          <p className="text-sm text-muted-foreground">Record and track salary payments</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen);
            if (!nextOpen) {
              setSalaryTeacherSearch("");
              setLoanRepaymentEdits({});
              setForm((current) => ({ ...current, skipLoanDeduction: false }));
            }
          }}
        >
          {permissions.canPaySalaries && (
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Pay Salary</Button></DialogTrigger>
          )}
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Pay Salary</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Teacher</Label>
                <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v, skipLoanDeduction: false })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 bg-popover p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={salaryTeacherSearch}
                          onChange={(e) => setSalaryTeacherSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Search teacher..."
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                    {unpaidActiveTeachers.length === 0 && <p className="text-sm text-muted-foreground p-2 text-center">All teachers paid for this month</p>}
                    {unpaidActiveTeachers.length > 0 && filteredUnpaidActiveTeachers.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2 text-center">No teachers found.</p>
                    )}
                    {filteredUnpaidActiveTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Month</Label><Input type="month" value={form.month} onChange={(e) => { setForm({ ...form, month: e.target.value, teacherId: "", skipLoanDeduction: false }); setSalaryTeacherSearch(""); }} /></div>
              <div><Label>Date Paid</Label><Input type="date" value={form.datePaid} onChange={(e) => setForm({ ...form, datePaid: e.target.value })} /></div>

              {/* Payment Mode */}
              <div><Label>Payment Mode</Label>
                <Select value={form.paymentMode} onValueChange={(v: "cash" | "online") => setForm({ ...form, paymentMode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Proof upload for online */}
              {form.paymentMode === "online" && (
                <div>
                  <Label>Attach Proof</Label>
                  <div className="flex items-center gap-2">
                    <ProofUpload value={form.proofImageUrl} onChange={(url) => setForm({ ...form, proofImageUrl: url })} required />
                  </div>
                  {form.receiptUrl && <p className="text-xs text-primary mt-1">✓ Receipt attached</p>}
                </div>
              )}

              {selectedTeacher && (
                <div className="bg-muted p-3 rounded-md text-sm space-y-2">
                  <p>
                    Base Salary: <strong>{formatPKR(baseSalary)}</strong>
                    {isBaseSalaryProrated && <span className="text-xs text-muted-foreground"> (prorated from joining date)</span>}
                  </p>
                  <p>Loan Deduction: <strong className="text-destructive">-{formatPKR(loanDeduction)}</strong></p>
                  {form.skipLoanDeduction && scheduledLoanDeduction > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Scheduled loan deduction skipped: {formatPKR(scheduledLoanDeduction)}
                    </p>
                  )}
                  {activeLoans.length > 0 && (
                    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border bg-background p-2">
                      <Checkbox
                        checked={form.skipLoanDeduction}
                        onCheckedChange={(checked) => setForm({ ...form, skipLoanDeduction: checked === true })}
                      />
                      <span className="space-y-0.5">
                        <span className="block text-sm font-medium">Skip loan deduction this month</span>
                        <span className="block text-xs text-muted-foreground">
                          Loan balance will stay unchanged for this salary payment.
                        </span>
                      </span>
                    </label>
                  )}
                  {advanceForMonth > 0 && <p>Advance Already Paid: <strong className="text-destructive">-{formatPKR(advanceForMonth)}</strong></p>}
                  {activeLoans.length > 0 && (
                    <div className="space-y-1 border-t border-border pt-2 mt-1">
                      <p className="text-xs font-medium text-muted-foreground">Loan Repayment Details:</p>
                      {loanDeductionDetails.map((item) => {
                        const loan = item.loan;
                        const edit = loanRepaymentEdits[loan.id] ?? {
                          repaymentType: loan.repaymentType,
                          repaymentMonth: loan.repaymentMonth ?? "",
                          repaymentPercentage: loan.repaymentPercentage ?? 0,
                          repaymentAmount: loan.repaymentAmount ?? 0,
                        };
                        return (
                          <div key={loan.id} className="rounded-md border border-border bg-background p-2 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{formatPKR(loan.amount)} loan</span>
                              <Badge variant={item.deduction > 0 ? "destructive" : "secondary"}>
                                {item.deduction > 0 ? `-${formatPKR(item.deduction)}` : "No deduction"}
                              </Badge>
                            </div>
                            <div className="space-y-2 rounded-md bg-muted/60 p-2">
                              <div>
                                <Label className="text-xs">Repayment Method</Label>
                                <Select
                                  value={edit.repaymentType}
                                  onValueChange={(value: TeacherLoan["repaymentType"]) => {
                                    updateLoanRepaymentEdit(loan.id, {
                                      repaymentType: value,
                                      repaymentMonth: value === "specific_month" ? edit.repaymentMonth || form.month : edit.repaymentMonth,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-8 bg-background"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="specific_month">Return in specific month</SelectItem>
                                    <SelectItem value="percentage">Deduct % from salary monthly</SelectItem>
                                    <SelectItem value="custom_amount">Deduct fixed amount monthly</SelectItem>
                                    <SelectItem value="manual">Manual (no auto deduction)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {edit.repaymentType === "specific_month" && (
                                <div>
                                  <Label className="text-xs">Return Month</Label>
                                  <Input
                                    type="month"
                                    value={edit.repaymentMonth}
                                    onChange={(event) => updateLoanRepaymentEdit(loan.id, { repaymentMonth: event.target.value })}
                                    className="h-8 bg-background"
                                  />
                                </div>
                              )}

                              {edit.repaymentType === "percentage" && (
                                <div>
                                  <Label className="text-xs">Monthly Deduction (%)</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={edit.repaymentPercentage}
                                    onChange={(event) => updateLoanRepaymentEdit(loan.id, { repaymentPercentage: Number(event.target.value) })}
                                    className="h-8 bg-background"
                                  />
                                </div>
                              )}

                              {edit.repaymentType === "custom_amount" && (
                                <div>
                                  <Label className="text-xs">Monthly Deduction Amount (PKR)</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={edit.repaymentAmount}
                                    onChange={(event) => updateLoanRepaymentEdit(loan.id, { repaymentAmount: Number(event.target.value) })}
                                    className="h-8 bg-background"
                                  />
                                </div>
                              )}
                            </div>
                            <p className="text-muted-foreground">Current plan: {item.repaymentLabel}</p>
                            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                              <span>
                                Remaining: <span className="font-medium text-foreground">{formatPKR(loan.remaining)}</span>
                              </span>
                              <span>
                                After pay: <span className="font-medium text-foreground">{formatPKR(item.remainingAfter)}</span>
                              </span>
                            </div>
                            <p className="text-muted-foreground">{item.note}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Outstanding loans: {formatPKR(totalLoanRemaining)}</p>
                </div>
              )}

              <div><Label>Other Deduction</Label><Input type="number" value={form.otherDeduction} onChange={(e) => setForm({ ...form, otherDeduction: Number(e.target.value) })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              {selectedTeacher && <p className="text-sm font-semibold">Net Pay: <span className="text-primary">{formatPKR(netPaid)}</span></p>}
              <Button className="w-full" onClick={handleSubmit}>Record Payment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Teachers */}
      {pendingTeachers.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Pending Salaries — {currentMonth}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingTeachers.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-sm font-semibold text-destructive">
                    {formatPKR(
                      getProratedMonthlyAmount(
                        getEffectiveTeacherMonthlySalary(t.monthlySalary, t.joiningDate, currentMonth, settings.annualIncrementPercentage),
                        t.joiningDate,
                        currentMonth
                      )
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Total pending: <strong className="text-destructive">{formatPKR(pendingTeacherTotal)}</strong>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Salary History</CardTitle>
          <div className="flex flex-wrap gap-3 mt-3">
            <Select
              value={filterTeacher}
              onValueChange={(value) => {
                setFilterTeacher(value);
                setFilterTeacherSearch("");
              }}
            >
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Teachers" /></SelectTrigger>
              <SelectContent>
                <div className="sticky top-0 z-10 bg-popover p-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={filterTeacherSearch}
                      onChange={(e) => setFilterTeacherSearch(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Search teacher..."
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                <SelectItem value="all">All Teachers</SelectItem>
                {filteredSalaryHistoryTeachers.length === 0 && (
                  <p className="text-sm text-muted-foreground p-2 text-center">No teachers found.</p>
                )}
                {filteredSalaryHistoryTeachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Months" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {[...new Set(salaries.map((s) => s.month))].sort().reverse().map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMode} onValueChange={setFilterMode}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Modes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
            {(filterTeacher !== "all" || filterMonth !== "all" || filterMode !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterTeacher("all"); setFilterTeacherSearch(""); setFilterMonth("all"); setFilterMode("all"); }}>Clear Filters</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> : (() => {
            const filtered = salaries.filter((s) =>
              (filterTeacher === "all" || s.teacherId === filterTeacher) &&
              (filterMonth === "all" || s.month === filterMonth) &&
              (filterMode === "all" || s.paymentMode === filterMode)
            );
            return filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No salary payments found.</p> : (
              <div className="max-h-[520px] overflow-auto rounded-md border">
              <table className="w-full caption-bottom text-sm">
                <TableHeader className="bg-background shadow-sm [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-background"><TableRow>
                  <TableHead>Teacher</TableHead><TableHead>Month</TableHead><TableHead>Base</TableHead><TableHead>Loan Ded.</TableHead><TableHead>Advance Ded.</TableHead><TableHead>Other Ded.</TableHead><TableHead>Net Paid</TableHead><TableHead>Mode</TableHead><TableHead>Date</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const advanceDeduction = getAdvanceDeductionForSalary(s.teacherId, s.month);
                    const loanOnlyDeduction = Math.max(0, s.loanDeduction - advanceDeduction);

                    return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{getTeacherName(s.teacherId)}</TableCell>
                      <TableCell>{s.month}</TableCell>
                      <TableCell>{formatPKR(s.baseSalary)}{s.customAmount > 0 && <span className="text-xs text-muted-foreground ml-1">(custom)</span>}</TableCell>
                      <TableCell className="text-destructive">-{formatPKR(loanOnlyDeduction)}</TableCell>
                      <TableCell className="text-destructive">{advanceDeduction > 0 ? `-${formatPKR(advanceDeduction)}` : "—"}</TableCell>
                      <TableCell className="text-destructive">-{formatPKR(s.otherDeduction)}</TableCell>
                      <TableCell className="font-semibold text-primary">{formatPKR(s.netPaid)}</TableCell>
                      <TableCell>
                        <Badge variant={s.paymentMode === "online" ? "default" : "secondary"}>
                          {s.paymentMode}
                        </Badge>
                        {s.receiptUrl && (
                          <a href={s.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary ml-1 underline">receipt</a>
                        )}
                      </TableCell>
                      <TableCell>{s.datePaid}</TableCell>
                      <TableCell className="flex gap-1">
                        {permissions.canEditSalaries && (
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(s)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => printSalarySlip(s.id)} title="Print Slip">
                          <Printer className="h-4 w-4" />
                        </Button>
                        {permissions.canEditSalaries && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteSalary(s.id)} title="Delete" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Salary Record</DialogTitle></DialogHeader>
          {editSalary && (
            <div className="space-y-3">
              <div>
                <Label>Other Deduction</Label>
                <Input type="number" value={editSalary.otherDeduction} onChange={(e) => setEditSalary({ ...editSalary, otherDeduction: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={editSalary.notes} onChange={(e) => setEditSalary({ ...editSalary, notes: e.target.value })} />
              </div>
              <p className="text-sm font-semibold">
                Updated Net Pay: <span className="text-primary">{formatPKR(editSalary.baseSalary - editSalary.loanDeduction - editSalary.otherDeduction)}</span>
              </p>
              <Button className="w-full" onClick={handleEditSave}>Save Changes</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
