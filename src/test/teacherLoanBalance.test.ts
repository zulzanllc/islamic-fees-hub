import { describe, expect, it } from "vitest";
import type { TeacherLoan } from "@/types";
import { getTeacherLoansWithCalculatedBalance } from "@/lib/teacherLoanBalance";

const loan: TeacherLoan = {
  id: "loan-1",
  teacherId: "teacher-1",
  amount: 60500,
  remaining: 0,
  dateIssued: "2026-04-01",
  notes: "",
  status: "paid",
  repaymentType: "custom_amount",
  repaymentMonth: null,
  repaymentPercentage: null,
  repaymentAmount: 20000,
  deductionStartMonth: "2026-04",
};

describe("teacher loan calculated balance", () => {
  it("does not mark a loan completed until salary deductions cover the full amount", () => {
    const [calculatedLoan] = getTeacherLoansWithCalculatedBalance(
      [loan],
      [
        { teacherId: "teacher-1", month: "2026-04", datePaid: "2026-05-04", loanDeduction: 20000 },
        { teacherId: "teacher-1", month: "2026-05", datePaid: "2026-05-25", loanDeduction: 20000 },
      ],
      [],
      "teacher-1"
    );

    expect(calculatedLoan.remaining).toBe(20500);
    expect(calculatedLoan.status).toBe("active");
  });

  it("starts deducting a later loan only from its configured start month", () => {
    const firstLoan: TeacherLoan = {
      ...loan,
      id: "loan-1",
      amount: 10000,
      remaining: 10000,
      repaymentAmount: 2000,
      deductionStartMonth: "2026-04",
      status: "active",
    };
    const secondLoan: TeacherLoan = {
      ...loan,
      id: "loan-2",
      amount: 10000,
      remaining: 10000,
      dateIssued: "2026-05-15",
      repaymentAmount: 2000,
      deductionStartMonth: "2026-06",
      status: "active",
    };

    const [calculatedFirst, calculatedSecond] = getTeacherLoansWithCalculatedBalance(
      [firstLoan, secondLoan],
      [
        { teacherId: "teacher-1", month: "2026-05", datePaid: "2026-05-31", loanDeduction: 2000 },
        { teacherId: "teacher-1", month: "2026-06", datePaid: "2026-06-30", loanDeduction: 4000 },
      ],
      [],
      "teacher-1"
    );

    expect(calculatedFirst.remaining).toBe(6000);
    expect(calculatedSecond.remaining).toBe(8000);
  });
});
