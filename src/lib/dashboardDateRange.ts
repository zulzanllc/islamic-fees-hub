export type DashboardDateFilterMode = "year" | "month" | "custom";

export interface DashboardDateFilterValue {
  mode: DashboardDateFilterMode;
  year: string;
  month: string;
  startDate: string;
  endDate: string;
}

export interface DashboardDateRange {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  label: string;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function parseLocalDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function createDefaultDashboardDateFilter(date = new Date()): DashboardDateFilterValue {
  const year = String(date.getFullYear());
  const month = monthKey(date);

  return {
    mode: "month",
    year,
    month,
    startDate: `${year}-01-01`,
    endDate: dateKey(date),
  };
}

export function getDashboardDateRange(filter: DashboardDateFilterValue): DashboardDateRange {
  if (filter.mode === "year") {
    const year = Number(filter.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);

    return {
      start,
      end,
      startDate: dateKey(start),
      endDate: dateKey(end),
      label: String(year),
    };
  }

  if (filter.mode === "custom") {
    const fallback = new Date();
    const rawStart = parseLocalDate(filter.startDate) ?? new Date(fallback.getFullYear(), fallback.getMonth(), 1);
    const rawEnd = parseLocalDate(filter.endDate) ?? fallback;
    const start = rawStart <= rawEnd ? rawStart : rawEnd;
    const end = rawStart <= rawEnd ? rawEnd : rawStart;

    return {
      start,
      end,
      startDate: dateKey(start),
      endDate: dateKey(end),
      label: `${dateKey(start)} to ${dateKey(end)}`,
    };
  }

  const [year, monthNumber] = filter.month.split("-").map(Number);
  const safeYear = year || new Date().getFullYear();
  const safeMonthIndex = monthNumber ? monthNumber - 1 : new Date().getMonth();
  const start = new Date(safeYear, safeMonthIndex, 1);
  const end = new Date(safeYear, safeMonthIndex + 1, 0);

  return {
    start,
    end,
    startDate: dateKey(start),
    endDate: dateKey(end),
    label: start.toLocaleString("en-US", { month: "long", year: "numeric" }),
  };
}

export function isDateInDashboardRange(dateValue: string, range: DashboardDateRange) {
  const date = parseLocalDate(dateValue);
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

export function isDateOnOrBefore(dateValue: string, end: Date) {
  const date = parseLocalDate(dateValue);
  if (!date) return false;
  return date <= end;
}

export function getMonthKeysInRange(range: DashboardDateRange) {
  const months: string[] = [];
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const end = new Date(range.end.getFullYear(), range.end.getMonth(), 1);

  while (cursor <= end) {
    months.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

export function isMonthInDashboardRange(month: string, range: DashboardDateRange) {
  return getMonthKeysInRange(range).includes(month);
}

export function getRangeChartMonths(range: DashboardDateRange) {
  return getMonthKeysInRange(range).map((value) => {
    const [year, monthNumber] = value.split("-").map(Number);
    const date = new Date(year, monthNumber - 1, 1);
    const includeYear = range.start.getFullYear() !== range.end.getFullYear();

    return {
      value,
      label: date.toLocaleString("en-US", includeYear ? { month: "short", year: "2-digit" } : { month: "short" }),
    };
  });
}

export function isPersonActiveInRange(
  joiningDate: string,
  status: "active" | "inactive",
  range: DashboardDateRange,
  leavingDate?: string | null
) {
  const joined = parseLocalDate(joiningDate);
  if (!joined || joined > range.end) return false;

  const left = parseLocalDate(leavingDate);
  if (left) return left >= range.start;

  return status === "active";
}
