import { describe, expect, it } from "vitest";
import type { Payment, Student } from "@/types";
import { getPaymentTotalAmount, getStudentPendingFeeBalance } from "@/lib/studentPendingFees";
import { getStudentOpeningDueInstallments, getStudentTotalDueThroughMonth } from "@/lib/proration";

const student: Student = {
  id: "student-1",
  studentCode: "S-001",
  name: "Student",
  guardianName: "Guardian",
  contact: "",
  classGrade: "Grade 1",
  enrollmentDate: "2026-02-04",
  monthlyFee: 8000,
  openingDueAmount: 24000,
  status: "active",
};

const payment = (overrides: Partial<Payment>): Payment => ({
  id: "payment-1",
  studentId: "student-1",
  feeType: "tuition",
  amountPaid: 8000,
  pendingFeePaid: 0,
  date: "2026-06-08",
  feeMonth: "2026-06",
  receiptNumber: "RCP-1",
  notes: "",
  collectedBy: null,
  paymentMode: "cash",
  receiptPrinted: false,
  proofImageUrl: "",
  ...overrides,
});

describe("standalone student pending fees", () => {
  it("does not allocate opening pending fees to monthly installments", () => {
    expect(getStudentOpeningDueInstallments(8000, "2026-02-04", 24000, "2026-06")).toEqual([]);
  });

  it("keeps opening pending fees separate from monthly due totals", () => {
    expect(getStudentTotalDueThroughMonth(8000, "2026-02-01", "2026-06", null, 24000)).toBe(40000);
  });

  it("reduces standalone pending balance only by pending fee payments", () => {
    const payments = [
      payment({ amountPaid: 8000, pendingFeePaid: 3000 }),
      payment({ id: "payment-2", amountPaid: 8000, pendingFeePaid: 0 }),
    ];

    expect(getStudentPendingFeeBalance(student, payments)).toBe(21000);
  });

  it("adds monthly and pending portions for collected totals", () => {
    expect(getPaymentTotalAmount(payment({ amountPaid: 8000, pendingFeePaid: 3000 }))).toBe(11000);
  });
});
