import type { Payment, Student } from "@/types";

export function getPaymentTotalAmount(payment: Payment) {
  return payment.amountPaid + (payment.pendingFeePaid ?? 0);
}

export function getStudentPendingFeePaid(studentId: string, payments: Payment[]) {
  return payments
    .filter((payment) => payment.studentId === studentId)
    .reduce((sum, payment) => sum + (payment.pendingFeePaid ?? 0), 0);
}

export function getStudentPendingFeeBalance(student: Student | undefined, payments: Payment[]) {
  if (!student) return 0;
  return Math.max(0, (student.openingDueAmount ?? 0) - getStudentPendingFeePaid(student.id, payments));
}
