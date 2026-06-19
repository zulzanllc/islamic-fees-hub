import { useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ProofUpload from "@/components/ProofUpload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTeachers, useTeacherSalarySettings } from "@/store/useTeacherStore";
import { useTeacherAdvances, type TeacherAdvance } from "@/store/useTeacherAdvances";
import { useAuth } from "@/hooks/useAuth";
import { formatPKR } from "@/lib/currency";
import { getProratedMonthlyAmount } from "@/lib/proration";
import { getEffectiveTeacherMonthlySalary } from "@/lib/teacherSalary";
import { Banknote, Pencil, Plus, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function TeacherAdvances() {
  const { teachers } = useTeachers();
  const { settings } = useTeacherSalarySettings();
  const { advances, loading, addAdvance, updateAdvance, deleteAdvance } = useTeacherAdvances();
  const { permissions } = useAuth();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMonth, setFilterMonth] = useState("all");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [editTeacherSearch, setEditTeacherSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const currentMonth = format(new Date(), "yyyy-MM");
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = subMonths(now, index);
      return { value: format(date, "yyyy-MM"), label: format(date, "MMMM yyyy") };
    });
  }, []);
  const [form, setForm] = useState({
    teacherId: "",
    amount: 0,
    notes: "",
    paymentMode: "cash" as "cash" | "online",
    proofImageUrl: "",
  });
  const [editForm, setEditForm] = useState({
    teacherId: "",
    month: currentMonth,
    amount: 0,
    dateGiven: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    paymentMode: "cash" as "cash" | "online",
    proofImageUrl: "",
  });

  const activeTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.status === "active"),
    [teachers]
  );
  const filteredTeachers = useMemo(() => {
    const query = teacherSearch.trim().toLowerCase();
    if (!query) return activeTeachers;
    return activeTeachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(query) ||
      teacher.contact.toLowerCase().includes(query) ||
      teacher.cnic.toLowerCase().includes(query)
    );
  }, [activeTeachers, teacherSearch]);
  const filteredEditTeachers = useMemo(() => {
    const query = editTeacherSearch.trim().toLowerCase();
    if (!query) return activeTeachers;
    return activeTeachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(query) ||
      teacher.contact.toLowerCase().includes(query) ||
      teacher.cnic.toLowerCase().includes(query)
    );
  }, [activeTeachers, editTeacherSearch]);

  const getTeacherName = (teacherId: string) => teachers.find((teacher) => teacher.id === teacherId)?.name ?? "Unknown";

  const escapeHtml = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const printAdvanceReceipt = (advance: TeacherAdvance) => {
    const teacher = teachers.find((item) => item.id === advance.teacherId);
    const receiptWindow = window.open("", "_blank");
    if (!receiptWindow) {
      toast.error("Unable to open receipt window");
      return;
    }

    const monthlySalary = teacher
      ? getProratedMonthlyAmount(
          getEffectiveTeacherMonthlySalary(
            teacher.monthlySalary,
            teacher.joiningDate,
            advance.month,
            settings.annualIncrementPercentage
          ),
          teacher.joiningDate,
          advance.month
        )
      : 0;
    const receiptNo = `ADV-${advance.id.slice(0, 8).toUpperCase()}`;

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Advance Salary Receipt - ${escapeHtml(receiptNo)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 24px; }
            .receipt { max-width: 760px; margin: 0 auto; border: 1px solid #d1d5db; padding: 24px; }
            .header { text-align: center; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; }
            .header h2 { margin: 8px 0 0; font-size: 18px; font-weight: 600; }
            .meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 18px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 14px; }
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
              <h2>Advance Salary Receipt</h2>
            </div>
            <div class="meta">
              <div><strong>Receipt No:</strong> ${escapeHtml(receiptNo)}</div>
              <div><strong>Printed:</strong> ${escapeHtml(format(new Date(), "yyyy-MM-dd HH:mm"))}</div>
            </div>
            <div class="section-title">Teacher Details</div>
            <table>
              <tbody>
                <tr><td>Teacher Name</td><td>${escapeHtml(teacher?.name ?? "Unknown")}</td></tr>
                <tr><td>Contact</td><td>${escapeHtml(teacher?.contact ?? "-")}</td></tr>
                <tr><td>CNIC</td><td>${escapeHtml(teacher?.cnic ?? "-")}</td></tr>
                <tr><td>Joining Date</td><td>${escapeHtml(teacher?.joiningDate ?? "-")}</td></tr>
              </tbody>
            </table>
            <div class="section-title">Advance Salary Details</div>
            <table>
              <tbody>
                <tr><td>Advance Amount</td><td class="amount">${escapeHtml(formatPKR(advance.amount))}</td></tr>
                <tr><td>Salary Month</td><td>${escapeHtml(advance.month)}</td></tr>
                <tr><td>Monthly Salary</td><td>${escapeHtml(formatPKR(monthlySalary))}</td></tr>
                <tr><td>Date Given</td><td>${escapeHtml(advance.dateGiven)}</td></tr>
                <tr><td>Payment Mode</td><td>${escapeHtml(advance.paymentMode === "online" ? "Online" : "Cash")}</td></tr>
              </tbody>
            </table>
            <div class="section-title">Notes</div>
            <table>
              <tbody><tr><td class="notes">${escapeHtml(advance.notes || "-")}</td></tr></tbody>
            </table>
            <div class="footer">
              <div class="signature">Teacher Signature</div>
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

  const filteredAdvances = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return advances.filter((advance) => {
      if (filterMonth !== "all" && advance.month !== filterMonth) return false;
      if (!query) return true;

      const teacher = teachers.find((item) => item.id === advance.teacherId);
      const teacherName = teacher?.name ?? "Unknown";
      return (
        teacherName.toLowerCase().includes(query) ||
        teacher?.contact.toLowerCase().includes(query) ||
        teacher?.cnic.toLowerCase().includes(query)
      );
    });
  }, [advances, filterMonth, searchQuery, teachers]);

  const totalAdvanceIssued = filteredAdvances.reduce((sum, advance) => sum + advance.amount, 0);

  const getRemainingAdvanceAllowance = (
    teacherId: string,
    month: string,
    excludeAdvanceId?: string | null
  ) => {
    const teacher = teachers.find((item) => item.id === teacherId);
    if (!teacher) return 0;

    const totalSalaryForMonth = getProratedMonthlyAmount(
      getEffectiveTeacherMonthlySalary(
        teacher.monthlySalary,
        teacher.joiningDate,
        month,
        settings.annualIncrementPercentage
      ),
      teacher.joiningDate,
      month
    );

    const existingAdvances = advances
      .filter((advance) => advance.teacherId === teacherId && advance.month === month && advance.id !== excludeAdvanceId)
      .reduce((sum, advance) => sum + advance.amount, 0);

    return totalSalaryForMonth - existingAdvances;
  };

  const handleSubmit = async () => {
    if (!form.teacherId) {
      toast.error("Select a teacher");
      return;
    }
    if (form.amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (form.paymentMode === "online" && !form.proofImageUrl) {
      toast.error("Please upload payment proof for online payment");
      return;
    }

    const teacher = teachers.find((item) => item.id === form.teacherId);
    if (!teacher) return;
    const remaining = getRemainingAdvanceAllowance(form.teacherId, currentMonth);

    if (form.amount > remaining) {
      const alreadyAdvanced = advances
        .filter((advance) => advance.teacherId === form.teacherId && advance.month === currentMonth)
        .reduce((sum, advance) => sum + advance.amount, 0);
      toast.error(`Maximum advance available: ${formatPKR(remaining)} (already advanced: ${formatPKR(alreadyAdvanced)})`);
      return;
    }

    setSubmitting(true);
    const error = await addAdvance({
      teacherId: form.teacherId,
      month: currentMonth,
      amount: form.amount,
      dateGiven: format(new Date(), "yyyy-MM-dd"),
      paymentMode: form.paymentMode,
      notes: form.notes || "Advance salary",
      proofImageUrl: form.proofImageUrl,
    });
    setSubmitting(false);

    if (error) {
      toast.error("Failed to record advance salary");
      return;
    }

    toast.success(`Advance of ${formatPKR(form.amount)} issued to ${teacher.name}`);
    setOpen(false);
    setTeacherSearch("");
    setForm({ teacherId: "", amount: 0, notes: "", paymentMode: "cash", proofImageUrl: "" });
  };

  const openEditDialog = (advance: TeacherAdvance) => {
    setEditingAdvanceId(advance.id);
    setEditForm({
      teacherId: advance.teacherId,
      month: advance.month,
      amount: advance.amount,
      dateGiven: advance.dateGiven,
      notes: advance.notes,
      paymentMode: advance.paymentMode as "cash" | "online",
      proofImageUrl: advance.proofImageUrl,
    });
    setEditTeacherSearch(getTeacherName(advance.teacherId));
    setEditOpen(true);
  };

  const handleEditAdvance = async () => {
    if (!editingAdvanceId || !editForm.teacherId) {
      toast.error("Select a teacher");
      return;
    }
    if (editForm.amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (editForm.paymentMode === "online" && !editForm.proofImageUrl) {
      toast.error("Please upload payment proof for online payment");
      return;
    }

    const remaining = getRemainingAdvanceAllowance(editForm.teacherId, editForm.month, editingAdvanceId);
    if (editForm.amount > remaining) {
      toast.error(`Maximum advance available for ${editForm.month}: ${formatPKR(remaining)}`);
      return;
    }

    setEditSubmitting(true);
    const error = await updateAdvance(editingAdvanceId, {
      teacherId: editForm.teacherId,
      month: editForm.month,
      amount: editForm.amount,
      dateGiven: editForm.dateGiven,
      paymentMode: editForm.paymentMode,
      notes: editForm.notes || "Advance salary",
      proofImageUrl: editForm.proofImageUrl,
    });
    setEditSubmitting(false);

    if (error) {
      toast.error("Failed to update advance salary record");
      return;
    }

    toast.success("Advance salary record updated");
    setEditOpen(false);
    setEditingAdvanceId(null);
    setEditTeacherSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Advance Salary</h1>
          <p className="text-sm text-muted-foreground">View and manage salary advances issued to teachers</p>
        </div>
        {permissions.canPaySalaries && (
          <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
              setOpen(nextOpen);
              if (!nextOpen) {
                setTeacherSearch("");
                setForm({ teacherId: "", amount: 0, notes: "", paymentMode: "cash", proofImageUrl: "" });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Issue Advance Salary
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Issue Advance Salary</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Teacher</Label>
                  <Select value={form.teacherId} onValueChange={(value) => setForm({ ...form, teacherId: value })}>
                    <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      <div className="sticky top-0 z-10 bg-popover p-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={teacherSearch}
                            onChange={(e) => setTeacherSearch(e.target.value)}
                            onKeyDown={(e) => e.stopPropagation()}
                            placeholder="Search teacher..."
                            className="h-9 pl-8"
                          />
                        </div>
                      </div>
                      {activeTeachers.length === 0 && (
                        <p className="text-sm text-muted-foreground p-2 text-center">No active teachers found.</p>
                      )}
                      {activeTeachers.length > 0 && filteredTeachers.length === 0 && (
                        <p className="text-sm text-muted-foreground p-2 text-center">No teachers found.</p>
                      )}
                      {filteredTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.teacherId && (() => {
                  const teacher = teachers.find((item) => item.id === form.teacherId);
                  const base = teacher
                    ? getProratedMonthlyAmount(
                        getEffectiveTeacherMonthlySalary(
                          teacher.monthlySalary,
                          teacher.joiningDate,
                          currentMonth,
                          settings.annualIncrementPercentage
                        ),
                        teacher.joiningDate,
                        currentMonth
                      )
                    : 0;
                  const existingAdvances = advances
                    .filter((advance) => advance.teacherId === form.teacherId && advance.month === currentMonth)
                    .reduce((sum, advance) => sum + advance.amount, 0);
                  const remaining = base - existingAdvances;

                  return (
                    <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                      <p>Monthly Salary: <strong>{formatPKR(base)}</strong></p>
                      {existingAdvances > 0 && (
                        <p>Already Advanced: <strong className="text-destructive">{formatPKR(existingAdvances)}</strong></p>
                      )}
                      <p>Available for Advance: <strong className="text-primary">{formatPKR(remaining)}</strong></p>
                    </div>
                  );
                })()}
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    placeholder="Enter amount"
                  />
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={form.paymentMode} onValueChange={(value) => setForm({ ...form, paymentMode: value as "cash" | "online" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.paymentMode === "online" && (
                  <ProofUpload
                    value={form.proofImageUrl}
                    onChange={(url) => setForm({ ...form, proofImageUrl: url })}
                    required
                  />
                )}
                <div>
                  <Label>Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. Advance for Eid"
                  />
                </div>
                <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Saving..." : "Issue Advance"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teachers With Advances</CardTitle>
            <Banknote className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{new Set(filteredAdvances.map((advance) => advance.teacherId)).size}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Advanced</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{formatPKR(totalAdvanceIssued)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Advance Salary History</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-[260px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by teacher name"
                  className="pl-9"
                />
              </div>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {monthOptions.map((month) => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(searchQuery || filterMonth !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterMonth("all");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : advances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No advance salary records.</p>
          ) : filteredAdvances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No advance salary records match the selected filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>S.No</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Date Given</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Notes</TableHead>
                  {permissions.canEditSalaries && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAdvances.map((advance, index) => (
                  <TableRow key={advance.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{index + 1}</TableCell>
                    <TableCell className="font-medium">{getTeacherName(advance.teacherId)}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatPKR(advance.amount)}</TableCell>
                    <TableCell>{advance.month}</TableCell>
                    <TableCell>{advance.dateGiven}</TableCell>
                    <TableCell>
                      <Badge variant={advance.paymentMode === "online" ? "default" : "secondary"}>
                        {advance.paymentMode}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">{advance.notes || "-"}</TableCell>
                    {permissions.canEditSalaries && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => printAdvanceReceipt(advance)} title="Print Advance Receipt">
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEditDialog(advance)} title="Edit Advance">
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
                                <AlertDialogTitle>Delete Advance Salary</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this advance record for {getTeacherName(advance.teacherId)} ({formatPKR(advance.amount)}). This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    const error = await deleteAdvance(advance.id);
                                    if (error) {
                                      toast.error("Failed to delete advance salary record");
                                      return;
                                    }
                                    toast.success("Advance salary record deleted");
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
            setEditingAdvanceId(null);
            setEditTeacherSearch("");
            setEditForm({
              teacherId: "",
              month: currentMonth,
              amount: 0,
              dateGiven: format(new Date(), "yyyy-MM-dd"),
              notes: "",
              paymentMode: "cash",
              proofImageUrl: "",
            });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Advance Salary</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Teacher</Label>
              <Select value={editForm.teacherId} onValueChange={(value) => setEditForm({ ...editForm, teacherId: value })}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  <div className="sticky top-0 z-10 bg-popover p-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={editTeacherSearch}
                        onChange={(e) => setEditTeacherSearch(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder="Search teacher..."
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                  {activeTeachers.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2 text-center">No active teachers found.</p>
                  )}
                  {activeTeachers.length > 0 && filteredEditTeachers.length === 0 && (
                    <p className="text-sm text-muted-foreground p-2 text-center">No teachers found.</p>
                  )}
                  {filteredEditTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Month</Label>
              <Input
                type="month"
                value={editForm.month}
                onChange={(e) => setEditForm({ ...editForm, month: e.target.value })}
              />
            </div>
            <div>
              <Label>Date Given</Label>
              <Input
                type="date"
                value={editForm.dateGiven}
                onChange={(e) => setEditForm({ ...editForm, dateGiven: e.target.value })}
              />
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <Label>Payment Mode</Label>
              <Select value={editForm.paymentMode} onValueChange={(value) => setEditForm({ ...editForm, paymentMode: value as "cash" | "online" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.paymentMode === "online" && (
              <ProofUpload
                value={editForm.proofImageUrl}
                onChange={(url) => setEditForm({ ...editForm, proofImageUrl: url })}
                required
              />
            )}
            <div>
              <Label>Notes</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="e.g. Advance for Eid"
              />
            </div>
            <Button className="w-full" onClick={handleEditAdvance} disabled={editSubmitting}>
              {editSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
