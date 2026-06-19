import { useMemo, useState } from "react";
import { useTeachers, useTeacherLoans } from "@/store/useTeacherStore";
import { useTeacherSalaries } from "@/store/useTeacherStore";
import { useTeacherAdvances } from "@/store/useTeacherAdvances";
import { useTeacherBonuses } from "@/store/useTeacherBonuses";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Gift, Plus, Search, Trash2, Pencil, Printer } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatPKR } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import ProofUpload from "@/components/ProofUpload";
import { getTeacherLoansWithCalculatedBalance } from "@/lib/teacherLoanBalance";
import type { TeacherLoan } from "@/types";

type RepaymentType = "specific_month" | "percentage" | "custom_amount" | "manual";

export default function TeacherLoans() {
  const { teachers } = useTeachers();
  const { loans, loading, addLoan, updateLoan, fetchLoans } = useTeacherLoans();
  const { salaries } = useTeacherSalaries();
  const { advances } = useTeacherAdvances();
  const { bonuses, loading: bonusesLoading, addBonus, deleteBonus } = useTeacherBonuses();
  const { permissions } = useAuth();
  const [open, setOpen] = useState(false);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bonusTeacherSearch, setBonusTeacherSearch] = useState("");
  const [loanTeacherSearch, setLoanTeacherSearch] = useState("");
  const [form, setForm] = useState({
    teacherId: "",
    amount: 0,
    notes: "",
    dateIssued: format(new Date(), "yyyy-MM-dd"),
    deductionStartMonth: format(new Date(), "yyyy-MM"),
    repaymentType: "manual" as RepaymentType,
    repaymentMonth: "",
    repaymentPercentage: 0,
    repaymentAmount: 0,
  });
  const [bonusForm, setBonusForm] = useState({
    teacherId: "",
    amount: 0,
    notes: "",
    paymentMode: "cash",
    proofImageUrl: "",
  });
  const [bonusSubmitting, setBonusSubmitting] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!form.teacherId || form.amount <= 0) { toast.error("Select teacher and enter amount"); return; }

    if (form.repaymentType === "specific_month" && !form.repaymentMonth) {
      toast.error("Select the return month"); return;
    }
    if (form.repaymentType === "percentage" && (form.repaymentPercentage <= 0 || form.repaymentPercentage > 100)) {
      toast.error("Enter a valid percentage (1-100)"); return;
    }
    if (form.repaymentType === "custom_amount" && form.repaymentAmount <= 0) {
      toast.error("Enter a valid monthly deduction amount"); return;
    }
    if (form.repaymentType !== "manual" && !form.deductionStartMonth) {
      toast.error("Select the deduction start month"); return;
    }

    const createdLoan = await addLoan({
      teacherId: form.teacherId,
      amount: form.amount,
      remaining: form.amount,
      dateIssued: form.dateIssued,
      notes: form.notes,
      status: "active",
      repaymentType: form.repaymentType,
      repaymentMonth: form.repaymentType === "specific_month" ? form.repaymentMonth : null,
      repaymentPercentage: form.repaymentType === "percentage" ? form.repaymentPercentage : null,
      repaymentAmount: form.repaymentType === "custom_amount" ? form.repaymentAmount : null,
      deductionStartMonth: form.repaymentType === "manual" ? null : form.deductionStartMonth || form.dateIssued.slice(0, 7),
    });
    toast.success("Loan recorded");
    if (createdLoan) {
      printLoanReceipt(createdLoan);
    }
    setOpen(false);
    setForm({
      teacherId: "", amount: 0, notes: "",
      dateIssued: format(new Date(), "yyyy-MM-dd"),
      deductionStartMonth: format(new Date(), "yyyy-MM"),
      repaymentType: "manual", repaymentMonth: "", repaymentPercentage: 0, repaymentAmount: 0,
    });
    setLoanTeacherSearch("");
  };

  const getTeacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? "Unknown";

  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.status === "active"),
    [teachers]
  );
  const filteredBonusTeachers = useMemo(() => {
    const query = bonusTeacherSearch.trim().toLowerCase();
    if (!query) return activeTeachers;
    return activeTeachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(query) ||
      teacher.contact.toLowerCase().includes(query) ||
      teacher.cnic.toLowerCase().includes(query)
    );
  }, [activeTeachers, bonusTeacherSearch]);
  const filteredLoanTeachers = useMemo(() => {
    const query = loanTeacherSearch.trim().toLowerCase();
    if (!query) return activeTeachers;
    return activeTeachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(query) ||
      teacher.contact.toLowerCase().includes(query) ||
      teacher.cnic.toLowerCase().includes(query)
    );
  }, [activeTeachers, loanTeacherSearch]);

  const handleBonusSubmit = async () => {
    if (!bonusForm.teacherId || bonusForm.amount <= 0) {
      toast.error("Select teacher and enter amount");
      return;
    }
    if (!bonusForm.notes.trim()) {
      toast.error("Please add a note for the bonus");
      return;
    }
    if (bonusForm.paymentMode === "online" && !bonusForm.proofImageUrl) {
      toast.error("Please upload payment proof for online payment");
      return;
    }

    setBonusSubmitting(true);
    const error = await addBonus({
      teacherId: bonusForm.teacherId,
      amount: bonusForm.amount,
      month: format(new Date(), "yyyy-MM"),
      dateGiven: format(new Date(), "yyyy-MM-dd"),
      paymentMode: bonusForm.paymentMode,
      notes: bonusForm.notes,
      proofImageUrl: bonusForm.proofImageUrl,
    });
    setBonusSubmitting(false);

    if (error) {
      toast.error("Failed to record bonus");
      return;
    }

    toast.success(`Bonus of ${formatPKR(bonusForm.amount)} released to ${getTeacherName(bonusForm.teacherId)}`);
    setBonusOpen(false);
    setBonusForm({ teacherId: "", amount: 0, notes: "", paymentMode: "cash", proofImageUrl: "" });
    setBonusTeacherSearch("");
  };

  const calculatedLoans = useMemo(
    () => getTeacherLoansWithCalculatedBalance(loans, salaries, advances),
    [loans, salaries, advances]
  );

  const filteredLoans = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return calculatedLoans;

    return calculatedLoans.filter((loan) => {
      const teacherName = teachers.find((t) => t.id === loan.teacherId)?.name ?? "Unknown";
      return teacherName.toLowerCase().includes(query);
    });
  }, [calculatedLoans, searchQuery, teachers]);

  const getRepaymentLabel = (loan: TeacherLoan) => {
    switch (loan.repaymentType) {
      case "specific_month": return `Full return in ${loan.repaymentMonth}`;
      case "percentage": return `${loan.repaymentPercentage}% of salary/month`;
      case "custom_amount": return `${formatPKR(loan.repaymentAmount ?? 0)}/month`;
      default: return "Manual";
    }
  };

  const getEstimatedCompletion = (loan: TeacherLoan) => {
    if (loan.status === "paid") return "Completed";
    if (loan.remaining <= 0) return "Completed";

    const teacher = teachers.find((t) => t.id === loan.teacherId);
    if (!teacher) return "—";

    if (loan.repaymentType === "specific_month" && loan.repaymentMonth) {
      return loan.repaymentMonth;
    }

    let monthlyDeduction = 0;
    if (loan.repaymentType === "percentage" && loan.repaymentPercentage) {
      monthlyDeduction = teacher.monthlySalary * (loan.repaymentPercentage / 100);
    } else if (loan.repaymentType === "custom_amount" && loan.repaymentAmount) {
      monthlyDeduction = loan.repaymentAmount;
    } else {
      return "Manual";
    }

    if (monthlyDeduction <= 0) return "—";
    const monthsLeft = Math.ceil(loan.remaining / monthlyDeduction);
    const completionDate = new Date();
    completionDate.setMonth(completionDate.getMonth() + monthsLeft);
    return format(completionDate, "MMM yyyy");
  };

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const getRepaymentDetails = (loan: TeacherLoan) => {
    const details = [
      { label: "Repayment Method", value: getRepaymentLabel(loan) },
      { label: "Deduction Start Month", value: loan.repaymentType === "manual" ? "-" : loan.deductionStartMonth ?? loan.dateIssued.slice(0, 7) },
    ];

    if (loan.repaymentType === "specific_month") {
      details.push({ label: "Return Month", value: loan.repaymentMonth ?? "-" });
    }
    if (loan.repaymentType === "percentage") {
      details.push({ label: "Monthly Deduction", value: `${loan.repaymentPercentage ?? 0}% of salary` });
    }
    if (loan.repaymentType === "custom_amount") {
      details.push({ label: "Monthly Deduction", value: formatPKR(loan.repaymentAmount ?? 0) });
    }

    return details;
  };

  const printLoanReceipt = (loan: TeacherLoan) => {
    const teacher = teachers.find((t) => t.id === loan.teacherId);
    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) {
      toast.error("Unable to open receipt window");
      return;
    }

    const receiptNo = `LN-${loan.id.slice(0, 8).toUpperCase()}`;
    const repaymentRows = getRepaymentDetails(loan)
      .map((detail) => `
        <tr>
          <td>${escapeHtml(detail.label)}</td>
          <td>${escapeHtml(detail.value)}</td>
        </tr>
      `)
      .join("");

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Loan Receipt - ${escapeHtml(receiptNo)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
            .receipt { max-width: 760px; margin: 0 auto; border: 1px solid #d1d5db; padding: 24px; }
            .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header h2 { margin: 8px 0 0; font-size: 18px; font-weight: 600; }
            .meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 18px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            td, th { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 14px; }
            th { background: #f3f4f6; }
            .section-title { margin-top: 18px; font-size: 15px; font-weight: 700; }
            .amount { font-weight: 700; }
            .notes { min-height: 48px; white-space: pre-wrap; }
            .footer { display: flex; justify-content: space-between; margin-top: 44px; font-size: 13px; }
            .signature { border-top: 1px solid #111827; padding-top: 8px; width: 220px; text-align: center; }
            @media print { body { padding: 0; } .receipt { border: none; } }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>Madrasa Darul Quran Education System</h1>
              <h2>Loan Receipt</h2>
            </div>
            <div class="meta">
              <div><strong>Receipt No:</strong> ${escapeHtml(receiptNo)}</div>
              <div><strong>Generated:</strong> ${escapeHtml(format(new Date(), "yyyy-MM-dd"))}</div>
            </div>
            <div class="section-title">Teacher Details</div>
            <table>
              <tbody>
                <tr><td>Teacher Name</td><td>${escapeHtml(teacher?.name ?? "Unknown")}</td></tr>
                <tr><td>Contact</td><td>${escapeHtml(teacher?.contact ?? "-")}</td></tr>
                <tr><td>CNIC</td><td>${escapeHtml(teacher?.cnic ?? "-")}</td></tr>
              </tbody>
            </table>
            <div class="section-title">Loan Details</div>
            <table>
              <tbody>
                <tr><td>Loan Amount</td><td class="amount">${escapeHtml(formatPKR(loan.amount))}</td></tr>
                <tr><td>Remaining Balance</td><td class="amount">${escapeHtml(formatPKR(loan.remaining))}</td></tr>
                <tr><td>Date Issued</td><td>${escapeHtml(loan.dateIssued)}</td></tr>
                <tr><td>Status</td><td>${escapeHtml(loan.status)}</td></tr>
                <tr><td>Estimated Completion</td><td>${escapeHtml(getEstimatedCompletion(loan))}</td></tr>
              </tbody>
            </table>
            <div class="section-title">Repayment Details</div>
            <table>
              <tbody>${repaymentRows}</tbody>
            </table>
            <div class="section-title">Notes</div>
            <table>
              <tbody><tr><td class="notes">${escapeHtml(loan.notes || "-")}</td></tr></tbody>
            </table>
            <div class="footer">
              <div>Prepared by Admin</div>
              <div class="signature">Authorized Signature</div>
            </div>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  };

  const handleDeleteLoan = async (id: string) => {
    await supabase.from("teacher_loans").delete().eq("id", id);
    toast.success("Loan deleted");
    await fetchLoans();
  };

  const openEditLoan = (loan: TeacherLoan) => {
    setEditingLoanId(loan.id);
    setForm({
      teacherId: loan.teacherId,
      amount: loan.amount,
      notes: loan.notes,
      dateIssued: loan.dateIssued,
      deductionStartMonth: loan.deductionStartMonth ?? loan.dateIssued.slice(0, 7),
      repaymentType: loan.repaymentType,
      repaymentMonth: loan.repaymentMonth ?? "",
      repaymentPercentage: loan.repaymentPercentage ?? 0,
      repaymentAmount: loan.repaymentAmount ?? 0,
    });
    setLoanTeacherSearch(getTeacherName(loan.teacherId));
    setEditOpen(true);
  };

  const handleEditLoan = async () => {
    if (!editingLoanId || !form.teacherId || form.amount <= 0) {
      toast.error("Select teacher and enter amount");
      return;
    }
    if (form.repaymentType === "specific_month" && !form.repaymentMonth) {
      toast.error("Select the return month");
      return;
    }
    if (form.repaymentType === "percentage" && (form.repaymentPercentage <= 0 || form.repaymentPercentage > 100)) {
      toast.error("Enter a valid percentage (1-100)");
      return;
    }
    if (form.repaymentType === "custom_amount" && form.repaymentAmount <= 0) {
      toast.error("Enter a valid monthly deduction amount");
      return;
    }
    if (form.repaymentType !== "manual" && !form.deductionStartMonth) {
      toast.error("Select the deduction start month");
      return;
    }

    const currentLoan = loans.find((loan) => loan.id === editingLoanId);
    const nextAmount = form.amount;
    const nextRemaining = currentLoan ? Math.min(currentLoan.remaining, nextAmount) : nextAmount;

    await updateLoan(editingLoanId, {
      teacherId: form.teacherId,
      amount: nextAmount,
      remaining: nextRemaining,
      dateIssued: form.dateIssued,
      deductionStartMonth: form.repaymentType === "manual" ? null : form.deductionStartMonth || form.dateIssued.slice(0, 7),
      notes: form.notes,
      repaymentType: form.repaymentType,
      repaymentMonth: form.repaymentType === "specific_month" ? form.repaymentMonth : null,
      repaymentPercentage: form.repaymentType === "percentage" ? form.repaymentPercentage : null,
      repaymentAmount: form.repaymentType === "custom_amount" ? form.repaymentAmount : null,
      status: nextRemaining <= 0 ? "paid" : "active",
    });

    toast.success("Loan updated");
    setEditOpen(false);
    setEditingLoanId(null);
    setLoanTeacherSearch("");
    setForm({
      teacherId: "", amount: 0, notes: "",
      dateIssued: format(new Date(), "yyyy-MM-dd"),
      deductionStartMonth: format(new Date(), "yyyy-MM"),
      repaymentType: "manual", repaymentMonth: "", repaymentPercentage: 0, repaymentAmount: 0,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teacher Loans & Bonuses</h1>
          <p className="text-sm text-muted-foreground">Track loans and bonuses given to teachers</p>
        </div>
        <div className="flex gap-2">
          {permissions.canEditTeachers && (
            <Dialog
              open={bonusOpen}
              onOpenChange={(nextOpen) => {
                setBonusOpen(nextOpen);
                if (!nextOpen) setBonusTeacherSearch("");
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Gift className="h-4 w-4 mr-1" /> Give Bonus
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Give Bonus</DialogTitle>
                  <DialogDescription>Bonus is an extra amount and will not be deducted from salary.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Teacher</Label>
                    <Select value={bonusForm.teacherId} onValueChange={(v) => setBonusForm({ ...bonusForm, teacherId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                      <SelectContent>
                        <div className="sticky top-0 z-10 bg-popover p-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              value={bonusTeacherSearch}
                              onChange={(e) => setBonusTeacherSearch(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              placeholder="Search teacher..."
                              className="h-9 pl-8"
                            />
                          </div>
                        </div>
                        {activeTeachers.length === 0 && (
                          <p className="text-sm text-muted-foreground p-2 text-center">No active teachers found.</p>
                        )}
                        {activeTeachers.length > 0 && filteredBonusTeachers.length === 0 && (
                          <p className="text-sm text-muted-foreground p-2 text-center">No teachers found.</p>
                        )}
                        {filteredBonusTeachers.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount (PKR)</Label><Input type="number" value={bonusForm.amount} onChange={(e) => setBonusForm({ ...bonusForm, amount: Number(e.target.value) })} /></div>
                  <div><Label>Payment Mode</Label>
                    <Select value={bonusForm.paymentMode} onValueChange={(v) => setBonusForm({ ...bonusForm, paymentMode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent>
                    </Select>
                  </div>
                  {bonusForm.paymentMode === "online" && (
                    <ProofUpload value={bonusForm.proofImageUrl} onChange={(url) => setBonusForm({ ...bonusForm, proofImageUrl: url })} required />
                  )}
                  <div><Label>Notes <span className="text-destructive">*</span></Label><Textarea value={bonusForm.notes} onChange={(e) => setBonusForm({ ...bonusForm, notes: e.target.value })} /></div>
                  <Button className="w-full" onClick={handleBonusSubmit} disabled={bonusSubmitting}>{bonusSubmitting ? "Saving..." : "Release Bonus"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) setLoanTeacherSearch("");
            }}
          >
            {permissions.canEditTeachers && (
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Loan</Button></DialogTrigger>
            )}
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Record Loan</DialogTitle></DialogHeader>
              <div className="space-y-3">
              <div>
                <Label>Teacher</Label>
                <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 bg-popover p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={loanTeacherSearch}
                          onChange={(e) => setLoanTeacherSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Search teacher..."
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                    {activeTeachers.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2 text-center">No active teachers found.</p>
                    )}
                    {activeTeachers.length > 0 && filteredLoanTeachers.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2 text-center">No teachers found.</p>
                    )}
                    {filteredLoanTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><Label>Date Issued</Label><Input type="date" value={form.dateIssued} onChange={(e) => setForm({ ...form, dateIssued: e.target.value, deductionStartMonth: form.deductionStartMonth || e.target.value.slice(0, 7) })} /></div>

              <div>
                <Label>Repayment Method</Label>
                <Select value={form.repaymentType} onValueChange={(v) => setForm({ ...form, repaymentType: v as RepaymentType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="specific_month">Return in specific month</SelectItem>
                    <SelectItem value="percentage">Deduct % from salary monthly</SelectItem>
                    <SelectItem value="custom_amount">Deduct fixed amount monthly</SelectItem>
                    <SelectItem value="manual">Manual (no auto deduction)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.repaymentType !== "manual" && (
                <div>
                  <Label>Deduction Start Month</Label>
                  <Input
                    type="month"
                    value={form.deductionStartMonth}
                    onChange={(e) => setForm({ ...form, deductionStartMonth: e.target.value })}
                  />
                </div>
              )}

              {form.repaymentType === "specific_month" && (
                <div>
                  <Label>Return Month</Label>
                  <Input type="month" value={form.repaymentMonth} onChange={(e) => setForm({ ...form, repaymentMonth: e.target.value })} />
                </div>
              )}

              {form.repaymentType === "percentage" && (
                <div>
                  <Label>Monthly Deduction (%)</Label>
                  <Input type="number" min={1} max={100} value={form.repaymentPercentage} onChange={(e) => setForm({ ...form, repaymentPercentage: Number(e.target.value) })} placeholder="e.g. 10" />
                </div>
              )}

              {form.repaymentType === "custom_amount" && (
                <div>
                  <Label>Monthly Deduction Amount (PKR)</Label>
                  <Input type="number" min={1} value={form.repaymentAmount} onChange={(e) => setForm({ ...form, repaymentAmount: Number(e.target.value) })} placeholder="e.g. 5000" />
                </div>
              )}

              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button className="w-full" onClick={handleSubmit}>Record Loan</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">All Loans</CardTitle>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by teacher name"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> : loans.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No loans recorded.</p> : filteredLoans.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No loans match that teacher name.</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>S.No</TableHead><TableHead>Teacher</TableHead><TableHead>Amount</TableHead><TableHead>Remaining</TableHead><TableHead>Repayment</TableHead><TableHead>Start</TableHead><TableHead>Est. Completion</TableHead><TableHead>Date Issued</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead>{permissions.canEditTeachers && <TableHead>Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {filteredLoans.map((l, index) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{index + 1}</TableCell>
                    <TableCell className="font-medium">{getTeacherName(l.teacherId)}</TableCell>
                    <TableCell>{formatPKR(l.amount)}</TableCell>
                    <TableCell className={l.remaining > 0 ? "text-destructive font-semibold" : "text-primary"}>{formatPKR(l.remaining)}</TableCell>
                     <TableCell><Badge variant="outline">{getRepaymentLabel(l)}</Badge></TableCell>
                     <TableCell className="text-muted-foreground text-xs">{l.repaymentType === "manual" ? "-" : l.deductionStartMonth ?? l.dateIssued.slice(0, 7)}</TableCell>
                     <TableCell className="text-muted-foreground text-xs">{getEstimatedCompletion(l)}</TableCell>
                     <TableCell>{l.dateIssued}</TableCell>
                    <TableCell><Badge variant={l.status === "active" ? "destructive" : "default"}>{l.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{l.notes}</TableCell>
                    {permissions.canEditTeachers && (
                      <TableCell className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => printLoanReceipt(l)} title="Print Loan Receipt">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditLoan(l)} title="Edit Loan">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Loan</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this loan record for {getTeacherName(l.teacherId)} ({formatPKR(l.amount)}). This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLoan(l.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(nextOpen) => {
          setEditOpen(nextOpen);
          if (!nextOpen) {
            setEditingLoanId(null);
            setLoanTeacherSearch("");
            setForm({
              teacherId: "", amount: 0, notes: "",
              dateIssued: format(new Date(), "yyyy-MM-dd"),
              deductionStartMonth: format(new Date(), "yyyy-MM"),
              repaymentType: "manual", repaymentMonth: "", repaymentPercentage: 0, repaymentAmount: 0,
            });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Loan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Teacher</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 bg-popover p-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={loanTeacherSearch}
                        onChange={(e) => setLoanTeacherSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="Search teacher..."
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                  {activeTeachers.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2 text-center">No active teachers found.</p>
                  )}
                  {activeTeachers.length > 0 && filteredLoanTeachers.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2 text-center">No teachers found.</p>
                  )}
                  {filteredLoanTeachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Loan Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Date Issued</Label><Input type="date" value={form.dateIssued} onChange={(e) => setForm({ ...form, dateIssued: e.target.value, deductionStartMonth: form.deductionStartMonth || e.target.value.slice(0, 7) })} /></div>

            <div>
              <Label>Repayment Method</Label>
              <Select value={form.repaymentType} onValueChange={(v) => setForm({ ...form, repaymentType: v as RepaymentType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific_month">Return in specific month</SelectItem>
                  <SelectItem value="percentage">Deduct % from salary monthly</SelectItem>
                  <SelectItem value="custom_amount">Deduct fixed amount monthly</SelectItem>
                  <SelectItem value="manual">Manual (no auto deduction)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.repaymentType !== "manual" && (
              <div>
                <Label>Deduction Start Month</Label>
                <Input
                  type="month"
                  value={form.deductionStartMonth}
                  onChange={(e) => setForm({ ...form, deductionStartMonth: e.target.value })}
                />
              </div>
            )}

            {form.repaymentType === "specific_month" && (
              <div>
                <Label>Return Month</Label>
                <Input type="month" value={form.repaymentMonth} onChange={(e) => setForm({ ...form, repaymentMonth: e.target.value })} />
              </div>
            )}

            {form.repaymentType === "percentage" && (
              <div>
                <Label>Monthly Deduction (%)</Label>
                <Input type="number" min={1} max={100} value={form.repaymentPercentage} onChange={(e) => setForm({ ...form, repaymentPercentage: Number(e.target.value) })} />
              </div>
            )}

            {form.repaymentType === "custom_amount" && (
              <div>
                <Label>Monthly Deduction Amount (PKR)</Label>
                <Input type="number" min={1} value={form.repaymentAmount} onChange={(e) => setForm({ ...form, repaymentAmount: Number(e.target.value) })} />
              </div>
            )}

            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={handleEditLoan}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Bonus History</CardTitle></CardHeader>
        <CardContent>
          {bonusesLoading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> : bonuses.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No bonuses recorded.</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>S.No</TableHead><TableHead>Teacher</TableHead><TableHead>Amount</TableHead><TableHead>Month</TableHead><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead>Notes</TableHead>{permissions.canEditTeachers && <TableHead>Actions</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {bonuses.map((bonus, index) => (
                  <TableRow key={bonus.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{index + 1}</TableCell>
                    <TableCell className="font-medium">{getTeacherName(bonus.teacherId)}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatPKR(bonus.amount)}</TableCell>
                    <TableCell>{bonus.month}</TableCell>
                    <TableCell>{bonus.dateGiven}</TableCell>
                    <TableCell><Badge variant={bonus.paymentMode === "online" ? "default" : "secondary"}>{bonus.paymentMode}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{bonus.notes || "-"}</TableCell>
                    {permissions.canEditTeachers && (
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Bonus</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this bonus record for {getTeacherName(bonus.teacherId)} ({formatPKR(bonus.amount)}). This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteBonus(bonus.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
