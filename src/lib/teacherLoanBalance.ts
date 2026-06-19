import type { TeacherLoan } from "@/types";

type SalaryDeductionRecord = {
  teacherId: string;
  month: string;
  datePaid?: string;
  baseSalary?: number;
  loanDeduction?: number;
};

type AdvanceRecord = {
  teacherId: string;
  month: string;
  amount: number;
};

function recordDateKey(record: SalaryDeductionRecord) {
  return record.datePaid || `${record.month}-01`;
}

export function getLoanDeductionStartMonth(loan: TeacherLoan) {
  return loan.deductionStartMonth || loan.dateIssued.slice(0, 7);
}

export function isLoanDeductionActiveForMonth(loan: TeacherLoan, month: string) {
  return month >= getLoanDeductionStartMonth(loan);
}

function getScheduledLoanDeduction(loan: TeacherLoan, salary: SalaryDeductionRecord) {
  if (!isLoanDeductionActiveForMonth(loan, salary.month)) return 0;
  if (loan.repaymentType === "percentage" && loan.repaymentPercentage && salary.baseSalary) {
    return Math.min(loan.remaining, salary.baseSalary * (loan.repaymentPercentage / 100));
  }
  if (loan.repaymentType === "custom_amount" && loan.repaymentAmount) {
    return Math.min(loan.remaining, loan.repaymentAmount);
  }
  if (loan.repaymentType === "specific_month" && loan.repaymentMonth === salary.month) {
    return loan.remaining;
  }
  return 0;
}

export function getTeacherLoansWithCalculatedBalance(
  loans: TeacherLoan[],
  salaries: SalaryDeductionRecord[],
  advances: AdvanceRecord[],
  teacherId?: string
) {
  const scopedLoans = teacherId ? loans.filter((loan) => loan.teacherId === teacherId) : loans;
  const byId = new Map(
    scopedLoans.map((loan) => [
      loan.id,
      loan.repaymentType === "manual"
        ? { ...loan }
        : {
            ...loan,
            remaining: Math.max(0, loan.amount),
            status: "active" as TeacherLoan["status"],
          },
    ])
  );

  const salaryRecords = salaries
    .filter((salary) => !teacherId || salary.teacherId === teacherId)
    .sort((first, second) => recordDateKey(first).localeCompare(recordDateKey(second)));

  salaryRecords.forEach((salary) => {
    const advanceForMonth = advances
      .filter((advance) => advance.teacherId === salary.teacherId && advance.month === salary.month)
      .reduce((sum, advance) => sum + advance.amount, 0);
    let loanDeduction = Math.max(0, (salary.loanDeduction ?? 0) - advanceForMonth);
    if (loanDeduction <= 0) return;

    const eligibleLoans = [...byId.values()]
      .filter(
        (loan) =>
          loan.teacherId === salary.teacherId &&
          loan.repaymentType !== "manual" &&
          loan.remaining > 0 &&
          loan.dateIssued <= recordDateKey(salary) &&
          isLoanDeductionActiveForMonth(loan, salary.month)
      )
      .sort((first, second) => first.dateIssued.localeCompare(second.dateIssued));

    eligibleLoans.forEach((loan) => {
      if (loanDeduction <= 0) return;
      const scheduledDeduction = getScheduledLoanDeduction(loan, salary);
      if (scheduledDeduction <= 0) return;
      const applied = Math.min(scheduledDeduction, loanDeduction);
      loan.remaining = Math.max(0, loan.remaining - applied);
      loanDeduction -= applied;
    });
  });

  return scopedLoans.map((loan) => {
    const calculated = byId.get(loan.id);
    if (!calculated) return loan;
    return {
      ...loan,
      remaining: calculated.remaining,
      status: calculated.remaining <= 0 ? "paid" as const : "active" as const,
    };
  });
}

export function getTeacherLoanWithCalculatedBalance(
  loan: TeacherLoan,
  loans: TeacherLoan[],
  salaries: SalaryDeductionRecord[],
  advances: AdvanceRecord[]
) {
  return getTeacherLoansWithCalculatedBalance(loans, salaries, advances, loan.teacherId).find((item) => item.id === loan.id) ?? loan;
}
