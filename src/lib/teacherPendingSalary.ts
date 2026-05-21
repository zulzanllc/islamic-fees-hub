import type { Teacher, TeacherLoan } from "@/types";
import { formatPKR } from "@/lib/currency";
import { getProratedMonthlyAmount, isJoiningMonth } from "@/lib/proration";
import { getEffectiveTeacherMonthlySalary } from "@/lib/teacherSalary";

type TeacherSalaryPayment = {
  teacherId: string;
  month: string;
  baseSalary?: number;
  netPaid: number;
  loanDeduction?: number;
  otherDeduction?: number;
  bonusAmount?: number;
};

type TeacherAdvancePayment = {
  teacherId: string;
  month: string;
  amount: number;
};

type TeacherPendingSalaryInput = {
  teacher: Teacher;
  month: string;
  salaries: TeacherSalaryPayment[];
  loans: TeacherLoan[];
  advances: TeacherAdvancePayment[];
  annualIncrementPercentage: number;
};

export function getTeacherPendingSalaryDetails({
  teacher,
  month,
  salaries,
  loans,
  advances,
  annualIncrementPercentage,
}: TeacherPendingSalaryInput) {
  const salaryRecords = salaries.filter((salary) => salary.teacherId === teacher.id && salary.month === month);
  const recordedBaseSalary = salaryRecords.reduce(
    (highest, salary) => Math.max(highest, salary.baseSalary ?? 0),
    0
  );
  const effectiveMonthlySalary = getEffectiveTeacherMonthlySalary(
    teacher.monthlySalary,
    teacher.joiningDate,
    month,
    annualIncrementPercentage
  );
  const baseSalary = recordedBaseSalary > 0
    ? recordedBaseSalary
    : getProratedMonthlyAmount(effectiveMonthlySalary, teacher.joiningDate, month);
  const activeLoans = loans.filter((loan) => loan.teacherId === teacher.id && loan.status === "active");

  const loanBreakdown = activeLoans.map((loan) => {
    if (loan.repaymentType === "percentage" && loan.repaymentPercentage) {
      return {
        id: loan.id,
        amount: loan.amount,
        modeLabel: `${loan.repaymentPercentage}% of salary`,
        deduction: Math.min((baseSalary * loan.repaymentPercentage) / 100, loan.remaining),
      };
    }
    if (loan.repaymentType === "custom_amount" && loan.repaymentAmount) {
      return {
        id: loan.id,
        amount: loan.amount,
        modeLabel: `Fixed ${formatPKR(loan.repaymentAmount)}/month`,
        deduction: Math.min(loan.repaymentAmount, Math.min(loan.remaining, baseSalary)),
      };
    }
    if (loan.repaymentType === "specific_month") {
      return {
        id: loan.id,
        amount: loan.amount,
        modeLabel: `Full return in ${loan.repaymentMonth}`,
        deduction: loan.repaymentMonth === month ? Math.min(loan.remaining, baseSalary) : 0,
      };
    }
    return {
      id: loan.id,
      amount: loan.amount,
      modeLabel: "Advance salary (manual)",
      deduction: 0,
    };
  });

  const loanDeduction = activeLoans.reduce((sum, loan) => {
    if (loan.repaymentType === "percentage" && loan.repaymentPercentage) {
      return sum + (baseSalary * loan.repaymentPercentage) / 100;
    }
    if (loan.repaymentType === "custom_amount" && loan.repaymentAmount) {
      return sum + Math.min(loan.repaymentAmount, baseSalary);
    }
    if (loan.repaymentType === "specific_month" && loan.repaymentMonth === month) {
      return sum + Math.min(loan.remaining, baseSalary);
    }
    return sum;
  }, 0);

  const manualLoanAdvance = activeLoans
    .filter((loan) => loan.repaymentType === "manual")
    .reduce((sum, loan) => sum + loan.remaining, 0);
  const recordedAdvance = advances
    .filter((advance) => advance.teacherId === teacher.id && advance.month === month)
    .reduce((sum, advance) => sum + advance.amount, 0);
  const advanceTaken = manualLoanAdvance + recordedAdvance;
  const paidAmount = salaryRecords.reduce((sum, salary) => sum + salary.netPaid, 0);
  const recordedLoanDeduction = salaryRecords.reduce((sum, salary) => sum + (salary.loanDeduction ?? 0), 0);
  const recordedOtherDeduction = salaryRecords.reduce((sum, salary) => sum + (salary.otherDeduction ?? 0), 0);
  const recordedBonusAmount = salaryRecords.reduce((sum, salary) => sum + (salary.bonusAmount ?? 0), 0);
  const hasSalaryRecord = salaryRecords.length > 0;

  const effectiveLoanDeduction = hasSalaryRecord ? recordedLoanDeduction : loanDeduction;
  const otherDeduction = hasSalaryRecord ? recordedOtherDeduction : 0;
  const effectiveAdvanceTaken = hasSalaryRecord ? 0 : advanceTaken;
  const expectedSalary = Math.max(
    0,
    baseSalary + recordedBonusAmount - effectiveLoanDeduction - effectiveAdvanceTaken - otherDeduction
  );
  const settledBaseAmount = hasSalaryRecord
    ? Math.max(0, paidAmount + effectiveLoanDeduction + otherDeduction - recordedBonusAmount)
    : paidAmount;
  const pendingAmount = hasSalaryRecord
    ? Math.max(0, baseSalary - settledBaseAmount)
    : Math.max(0, expectedSalary - paidAmount);
  const status: "paid" | "partial" | "unpaid" =
    pendingAmount <= 0 ? "paid" : settledBaseAmount > 0 ? "partial" : "unpaid";
  const totalLoanRemaining = activeLoans.reduce((sum, loan) => sum + loan.remaining, 0);

  let estCompletion = "-";
  if (activeLoans.length > 0) {
    if (totalLoanRemaining <= 0) {
      estCompletion = "Completed";
    } else {
      const totalMonthlyDeduction = activeLoans.reduce((sum, loan) => {
        if (loan.repaymentType === "percentage" && loan.repaymentPercentage) {
          return sum + effectiveMonthlySalary * (loan.repaymentPercentage / 100);
        }
        if (loan.repaymentType === "custom_amount" && loan.repaymentAmount) {
          return sum + loan.repaymentAmount;
        }
        return sum;
      }, 0);
      const specificMonths = activeLoans
        .filter((loan) => loan.repaymentType === "specific_month" && loan.repaymentMonth)
        .map((loan) => loan.repaymentMonth!);

      if (totalMonthlyDeduction > 0) {
        const monthsLeft = Math.ceil(totalLoanRemaining / totalMonthlyDeduction);
        const completionDate = new Date();
        completionDate.setMonth(completionDate.getMonth() + monthsLeft);
        estCompletion = completionDate.toLocaleString("en-US", { month: "short", year: "numeric" });
      } else if (specificMonths.length > 0) {
        estCompletion = specificMonths.sort().pop()!;
      } else {
        estCompletion = "Manual";
      }
    }
  }

  return {
    teacher,
    baseSalary,
    loanDeduction: effectiveLoanDeduction,
    advanceTaken: effectiveAdvanceTaken,
    otherDeduction,
    expectedSalary,
    paidAmount,
    pendingAmount,
    status,
    estCompletion,
    prorated: isJoiningMonth(teacher.joiningDate, month),
    loanBreakdown,
    totalLoanRemaining,
  };
}
