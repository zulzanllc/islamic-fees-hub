function parseMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return null;
  return { year, monthIndex: monthNumber - 1 };
}

export function getTeacherAnnualIncrementCount(joiningDate: string, month: string) {
  if (!joiningDate) return 0;

  const selectedMonth = parseMonth(month);
  if (!selectedMonth) return 0;

  const joined = new Date(`${joiningDate}T00:00:00`);
  if (Number.isNaN(joined.getTime())) return 0;

  const yearDiff = selectedMonth.year - joined.getFullYear();
  if (yearDiff <= 0) return 0;

  return selectedMonth.monthIndex >= joined.getMonth() ? yearDiff : yearDiff - 1;
}

export function getEffectiveTeacherMonthlySalary(
  monthlySalary: number,
  joiningDate: string,
  month: string,
  annualIncrementPercentage: number
) {
  if (monthlySalary <= 0) return 0;
  const incrementCount = getTeacherAnnualIncrementCount(joiningDate, month);
  if (incrementCount <= 0 || annualIncrementPercentage <= 0) return monthlySalary;

  const multiplier = Math.pow(1 + annualIncrementPercentage / 100, incrementCount);
  return Math.round(monthlySalary * multiplier);
}
