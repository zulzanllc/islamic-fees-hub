import type { FeeStructure, Student } from "@/types";

export function getStudentMonthlyFee(student: Student | undefined | null, fees: FeeStructure[] = []) {
  if (!student) return 0;
  if ((student.monthlyFee ?? 0) > 0) return student.monthlyFee;

  const classTuition = fees.find(
    (fee) => fee.classGrade === student.classGrade && fee.feeType === "tuition"
  );
  return classTuition?.amount ?? 0;
}
