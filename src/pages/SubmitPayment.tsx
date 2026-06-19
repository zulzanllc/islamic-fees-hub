import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePayments, useStudentPaymentSubmissions } from "@/store/useStore";
import { useAuth } from "@/hooks/useAuth";
import { formatPKR } from "@/lib/currency";
import { formatFeeMonth } from "@/lib/formatMonth";
import { getPaymentTotalAmount } from "@/lib/studentPendingFees";
import { format, subMonths } from "date-fns";
import { Pencil, Plus, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { StudentPaymentSubmission } from "@/types";

export default function SubmitPayment() {
  const { payments } = usePayments();
  const { submissions, loading, addSubmission, updateSubmission, deleteSubmission } = useStudentPaymentSubmissions();
  const { user, permissions } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [emailFilter, setEmailFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState<StudentPaymentSubmission | null>(null);
  const [form, setForm] = useState({
    amountSubmitted: "",
    submissionDate: format(new Date(), "yyyy-MM-dd"),
    paymentMode: "cash",
    notes: "",
  });

  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 18 }, (_, index) => {
      const month = subMonths(now, index);
      return { value: format(month, "yyyy-MM"), label: format(month, "MMMM yyyy") };
    });
  }, []);

  const getSubmissionClasses = (submission: StudentPaymentSubmission) =>
    submission.classGrades ?? (submission.classGrade ? [submission.classGrade] : []);

  const totalCollected = useMemo(
    () =>
      payments
        .filter(
          (payment) =>
            payment.feeMonth === selectedMonth &&
            payment.paymentMode === "cash"
        )
        .reduce((sum, payment) => sum + getPaymentTotalAmount(payment), 0),
    [payments, selectedMonth]
  );

  const monthSubmissions = useMemo(
    () =>
      submissions
        .filter(
          (submission) =>
            submission.feeMonth === selectedMonth &&
            submission.paymentMode === "cash"
        )
        .sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()),
    [submissions, selectedMonth]
  );

  const alreadySubmitted = monthSubmissions.reduce(
    (sum, submission) => sum + submission.amountSubmitted,
    0
  );
  const filteredHistorySubmissions = useMemo(() => {
    const query = emailFilter.trim().toLowerCase();
    if (!query) return monthSubmissions;

    return monthSubmissions.filter((submission) => {
      const submittedByEmail =
        submission.submittedByEmail ||
        (submission.submittedBy === user?.id ? user?.email : null) ||
        "";
      return submittedByEmail.toLowerCase().includes(query);
    });
  }, [monthSubmissions, emailFilter, user?.email, user?.id]);
  const remainingToSubmit = Math.max(0, totalCollected - alreadySubmitted);
  const editableRemainingToSubmit = editingSubmission
    ? Math.max(0, totalCollected - (alreadySubmitted - editingSubmission.amountSubmitted))
    : remainingToSubmit;

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setForm({
        amountSubmitted: String(remainingToSubmit),
        submissionDate: format(new Date(), "yyyy-MM-dd"),
        paymentMode: "cash",
        notes: "",
      });
    } else {
      setEditingSubmission(null);
    }
  };

  const openEditDialog = (submission: StudentPaymentSubmission) => {
    setEditingSubmission(submission);
    setForm({
      amountSubmitted: String(submission.amountSubmitted),
      submissionDate: submission.submissionDate,
      paymentMode: "cash",
      notes: submission.notes,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!permissions.canManageRoles) {
      toast.error("Only admins can submit payments");
      return;
    }
    const amount = Number(form.amountSubmitted);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > editableRemainingToSubmit) {
      toast.error(`Maximum amount available to submit is ${formatPKR(editableRemainingToSubmit)}`);
      return;
    }

    const previouslySubmittedAmount = editingSubmission
      ? alreadySubmitted - editingSubmission.amountSubmitted
      : alreadySubmitted;
    const remainingAfterSubmission = Math.max(0, totalCollected - previouslySubmittedAmount - amount);

    const payload = {
      feeMonth: selectedMonth,
      classGrade: editingSubmission ? editingSubmission.classGrade : null,
      classGrades: editingSubmission ? editingSubmission.classGrades ?? (editingSubmission.classGrade ? [editingSubmission.classGrade] : null) : null,
      amountSubmitted: amount,
      totalCollectedAtSubmission: totalCollected,
      previouslySubmittedAmount,
      remainingAfterSubmission,
      submissionDate: form.submissionDate,
      paymentMode: "cash",
      notes: form.notes,
      submittedBy: user?.id ?? null,
      submittedByEmail: user?.email ?? null,
    };

    const error = editingSubmission
      ? await updateSubmission(editingSubmission.id, payload)
      : await addSubmission(payload);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      editingSubmission
        ? `Updated submission to ${formatPKR(amount)}`
        : `Submitted ${formatPKR(amount)} to administration`
    );
    setOpen(false);
  };

  const handleDeleteSubmission = async (submission: StudentPaymentSubmission) => {
    const error = await deleteSubmission(submission.id);
    if (error) {
      toast.error(error.message || "Failed to delete submission");
      return;
    }
    toast.success(`Submission of ${formatPKR(submission.amountSubmitted)} deleted`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Submit Payment</h1>
          <p className="text-sm text-muted-foreground">Submit collected student fees to administration</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          {permissions.canManageRoles && (
            <DialogTrigger asChild>
              <Button size="sm" disabled={remainingToSubmit <= 0}>
                <Plus className="h-4 w-4 mr-1" /> Add Submission
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSubmission ? "Edit Submitted Payment" : "Submit Payment to Administration"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-md bg-muted p-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Collected</p>
                  <p className="font-semibold">{formatPKR(totalCollected)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-semibold">{formatPKR(alreadySubmitted)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Remaining</p>
                  <p className="font-semibold text-primary">{formatPKR(editableRemainingToSubmit)}</p>
                </div>
              </div>
              <div>
                <Label>Fee Month</Label>
                <Input value={formatFeeMonth(selectedMonth)} disabled />
              </div>
              <div>
                <Label>Amount Submitted (PKR)</Label>
                <Input
                  type="number"
                  min={0}
                  max={editableRemainingToSubmit}
                  value={form.amountSubmitted}
                  onChange={(event) => setForm({ ...form, amountSubmitted: event.target.value })}
                />
              </div>
              <div>
                <Label>Submission Date</Label>
                <Input
                  type="date"
                  value={form.submissionDate}
                  onChange={(event) => setForm({ ...form, submissionDate: event.target.value })}
                />
              </div>
              <div>
                <Label>Mode</Label>
                <Input value="Cash" disabled />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Optional notes"
                />
              </div>
              <Button className="w-full" onClick={handleSubmit}>
                <Send className="h-4 w-4 mr-1" /> {editingSubmission ? "Update Submission" : "Submit to Administration"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <Label>Fee Month</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((month) => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Email ID</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={emailFilter}
              onChange={(event) => setEmailFilter(event.target.value)}
              placeholder="Search email"
              className="w-[240px] pl-8"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatPKR(totalCollected)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Already Submitted</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatPKR(alreadySubmitted)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining To Submit</CardTitle>
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{formatPKR(remainingToSubmit)}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Submission History</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
          ) : filteredHistorySubmissions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No submissions recorded for this month.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Total Collected</TableHead>
                  <TableHead>Submitted Before</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Remaining After</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Submitted By</TableHead>
                  <TableHead>Notes</TableHead>
                  {permissions.canManageRoles && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistorySubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>{submission.submissionDate}</TableCell>
                    <TableCell>{formatFeeMonth(submission.feeMonth)}</TableCell>
                    <TableCell>
                      {getSubmissionClasses(submission).length > 0
                        ? getSubmissionClasses(submission).join(", ")
                        : "All Classes"}
                    </TableCell>
                    <TableCell>{formatPKR(submission.totalCollectedAtSubmission)}</TableCell>
                    <TableCell>{formatPKR(submission.previouslySubmittedAmount)}</TableCell>
                    <TableCell className="font-semibold">{formatPKR(submission.amountSubmitted)}</TableCell>
                    <TableCell>{formatPKR(submission.remainingAfterSubmission)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {submission.paymentMode.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {submission.submittedByEmail || (submission.submittedBy === user?.id ? user?.email : null) || (submission.submittedBy ? "Unknown user" : "-")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{submission.notes || "-"}</TableCell>
                    {permissions.canManageRoles && (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(submission)} title="Edit Submission">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Delete Submission"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the {formatPKR(submission.amountSubmitted)} submission for {formatFeeMonth(submission.feeMonth)}. The amount will return to the remaining balance.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSubmission(submission)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
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
