function parseMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return null;
  return { year, monthIndex: monthNumber - 1 };
}

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function parseDate(date: string | null | undefined) {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getProratedMonthlyAmount(
  monthlyAmount: number,
  joiningDate: string,
  month: string
) {
  if (monthlyAmount <= 0) return 0;

  const selectedMonth = parseMonth(month);
  if (!selectedMonth || !joiningDate) return monthlyAmount;

  const joined = new Date(`${joiningDate}T00:00:00`);
  if (Number.isNaN(joined.getTime())) return monthlyAmount;

  const selectedKey = monthKey(selectedMonth.year, selectedMonth.monthIndex);
  const joiningKey = monthKey(joined.getFullYear(), joined.getMonth());

  if (joiningKey > selectedKey) return 0;
  if (joiningKey < selectedKey) return monthlyAmount;

  const daysInMonth = new Date(selectedMonth.year, selectedMonth.monthIndex + 1, 0).getDate();
  const payableDays = daysInMonth - joined.getDate() + 1;

  return Math.round((monthlyAmount * payableDays) / daysInMonth);
}

export function isJoiningMonth(joiningDate: string, month: string) {
  if (!joiningDate) return false;
  const joined = new Date(`${joiningDate}T00:00:00`);
  if (Number.isNaN(joined.getTime())) return false;
  return monthKey(joined.getFullYear(), joined.getMonth()) === month;
}

export function isLeavingMonth(leavingDate: string | null | undefined, month: string) {
  const left = parseDate(leavingDate);
  if (!left) return false;
  return monthKey(left.getFullYear(), left.getMonth()) === month;
}

export function getStudentMonthlyDue(
  monthlyAmount: number,
  joiningDate: string,
  month: string,
  leavingDate?: string | null
) {
  if (monthlyAmount <= 0) return 0;

  const selectedMonth = parseMonth(month);
  if (!selectedMonth || !joiningDate) return monthlyAmount;

  const joined = parseDate(joiningDate);
  if (!joined) return monthlyAmount;

  const selectedKey = monthKey(selectedMonth.year, selectedMonth.monthIndex);
  const joiningKey = monthKey(joined.getFullYear(), joined.getMonth());

  if (joiningKey > selectedKey) return 0;

  const left = parseDate(leavingDate);
  const leavingKey = left ? monthKey(left.getFullYear(), left.getMonth()) : null;
  if (leavingKey && leavingKey < selectedKey) return 0;

  const daysInMonth = new Date(selectedMonth.year, selectedMonth.monthIndex + 1, 0).getDate();
  const firstPayableDay = joiningKey === selectedKey ? joined.getDate() : 1;
  const lastPayableDay = leavingKey === selectedKey && left ? left.getDate() : daysInMonth;

  if (lastPayableDay < firstPayableDay) return 0;
  if (firstPayableDay === 1 && lastPayableDay === daysInMonth) return monthlyAmount;

  const payableDays = lastPayableDay - firstPayableDay + 1;
  return Math.round((monthlyAmount * payableDays) / daysInMonth);
}
