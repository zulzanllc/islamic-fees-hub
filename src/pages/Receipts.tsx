import { useRef, useState } from "react";
import { useStudents, usePayments } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, Search } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { formatFeeMonth } from "@/lib/formatMonth";
import { supabase } from "@/integrations/supabase/client";

export default function Receipts() {
  const { students } = useStudents();
  const { payments } = usePayments();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getStudentName = (id: string) =>
    students.find((s) => s.id === id)?.name ?? "Unknown";
  const getStudentClass = (id: string) =>
    students.find((s) => s.id === id)?.classGrade ?? "—";

  const formatPaymentMode = (mode?: string) =>
    (mode || "cash")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const sortedPayments = [...payments]
    .filter((p) =>
      searchQuery === "" ||
      p.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handlePrint = async (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId);
    if (!payment) return;
    const student = students.find((s) => s.id === payment.studentId);

    const isOriginal = !(payment as any).receiptPrinted;
    const copyLabel = isOriginal ? "Original" : "Duplicate";

    // Mark as printed after first print
    if (isOriginal) {
      await supabase.from("payments").update({ receipt_printed: true } as any).eq("id", paymentId);
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head><title>Receipt ${payment.receiptNumber}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 40px; max-width: 600px; margin: auto; font-weight: 700; }
          .header { text-align: center; border-bottom: 2px solid #1a6b4a; padding-bottom: 16px; margin-bottom: 24px; }
          .header h1 { color: #1a6b4a; margin: 0; font-size: 22px; }
          .header p { color: #666; margin: 4px 0 0; font-size: 13px; }
          .copy-label { text-align: right; font-size: 14px; font-weight: 700; color: ${isOriginal ? "#1a6b4a" : "#c0392b"}; margin-bottom: 12px; text-transform: uppercase; border: 2px solid ${isOriginal ? "#1a6b4a" : "#c0392b"}; display: inline-block; padding: 2px 10px; float: right; }
          .details { margin-bottom: 24px; clear: both; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .label { color: #666; font-size: 14px; font-weight: 700; }
          .value { font-weight: 700; font-size: 14px; }
          .total { font-size: 18px; color: #1a6b4a; }
          .footer { text-align: center; margin-top: 32px; color: #999; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style></head>
        <body>
          <div class="header">
            <h1>☪ Islamic Education Center</h1>
            <p>Payment Receipt</p>
          </div>
          <div class="copy-label">${copyLabel}</div>
          <div class="details">
            <div class="row"><span class="label">Receipt #</span><span class="value">${payment.receiptNumber}</span></div>
            <div class="row"><span class="label">Date</span><span class="value">${payment.date}</span></div>
            <div class="row"><span class="label">Payment Mode</span><span class="value">${formatPaymentMode(payment.paymentMode)}</span></div>
            <div class="row"><span class="label">Student</span><span class="value">${student?.name ?? "Unknown"}</span></div>
            <div class="row"><span class="label">Class</span><span class="value">${student?.classGrade ?? "—"}</span></div>
            <div class="row"><span class="label">Fee Month</span><span class="value">${formatFeeMonth(payment.feeMonth)}</span></div>
            <div class="row"><span class="label">Fee Type</span><span class="value" style="text-transform:capitalize">${payment.feeType}</span></div>
            <div class="row"><span class="label">Amount Paid</span><span class="value total">Rs. ${payment.amountPaid.toLocaleString()}</span></div>
            ${payment.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${payment.notes}</span></div>` : ""}
          </div>
          <div class="footer">Thank you for your payment. May Allah bless you.</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Receipts</h1>
          <p className="text-sm text-muted-foreground">
            View and print payment receipts
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Receipt #"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S.No</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="text-right">Print</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No receipts available.
                  </TableCell>
                </TableRow>
              ) : (
                sortedPayments.map((p, index) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs text-muted-foreground font-mono">{index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {p.receiptNumber}
                    </TableCell>
                    <TableCell>{p.date}</TableCell>
                    <TableCell className="font-medium">
                      {getStudentName(p.studentId)}
                    </TableCell>
                    <TableCell>{getStudentClass(p.studentId)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {p.feeType}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPKR(p.amountPaid)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handlePrint(p.id)}
                      >
                        <Printer className="h-4 w-4" />
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
