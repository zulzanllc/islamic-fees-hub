import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { useStudents, usePayments, useFeeStructures } from "@/store/useStore";
import { Users, DollarSign, AlertCircle, Plus, CreditCard, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPKR } from "@/lib/currency";
import { getStudentMonthlyDue } from "@/lib/proration";
import { getStudentMonthlyFee } from "@/lib/studentFees";
import { getPaymentTotalAmount, getStudentPendingFeeBalance } from "@/lib/studentPendingFees";
import { DashboardDateFilter } from "@/components/DashboardDateFilter";
import {
  createDefaultDashboardDateFilter,
  getDashboardDateRange,
  getMonthKeysInRange,
  getRangeChartMonths,
  isDateInDashboardRange,
  isPersonActiveInRange,
} from "@/lib/dashboardDateRange";

const chartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(160 45% 32%)" },
};

export default function Dashboard() {
  const { students } = useStudents();
  const { payments } = usePayments();
  const { fees } = useFeeStructures();
  const [dateFilter, setDateFilter] = useState(createDefaultDashboardDateFilter);

  const range = useMemo(() => getDashboardDateRange(dateFilter), [dateFilter]);
  const rangeMonths = useMemo(() => getMonthKeysInRange(range), [range]);

  const studentsInRange = useMemo(
    () => students.filter((student) => isPersonActiveInRange(student.enrollmentDate, student.status, range, student.leavingDate)),
    [students, range]
  );

  const paymentsInRange = useMemo(
    () => payments.filter((payment) => isDateInDashboardRange(payment.date, range)),
    [payments, range]
  );

  const tuitionPaymentsForRangeMonths = useMemo(
    () => payments.filter((payment) => payment.feeType === "tuition" && rangeMonths.includes(payment.feeMonth)),
    [payments, rangeMonths]
  );

  const pendingSummary = useMemo(() => {
    const paidByStudent = new Map<string, number>();
    tuitionPaymentsForRangeMonths.forEach((payment) => {
      paidByStudent.set(payment.studentId, (paidByStudent.get(payment.studentId) ?? 0) + payment.amountPaid);
    });

    let totalExpected = 0;
    let totalPending = 0;
    let pendingCount = 0;

    studentsInRange.forEach((student) => {
      const expected = rangeMonths.reduce(
        (sum, month) =>
          sum +
          getStudentMonthlyDue(
            getStudentMonthlyFee(student, fees),
            student.enrollmentDate,
            month,
            student.leavingDate
          ),
        0
      );
      const standalonePending = getStudentPendingFeeBalance(student, payments);
      const paid = paidByStudent.get(student.id) ?? 0;
      const pending = Math.max(0, expected - paid) + standalonePending;

      totalExpected += expected + standalonePending;
      totalPending += pending;
      if (pending > 0) pendingCount += 1;
    });

    return { totalExpected, totalPending, pendingCount };
  }, [studentsInRange, rangeMonths, tuitionPaymentsForRangeMonths, fees, payments]);

  const totalCollection = paymentsInRange.reduce((s, p) => s + getPaymentTotalAmount(p), 0);
  const tuitionCollection = paymentsInRange
    .filter((p) => p.feeType === "tuition")
    .reduce((s, p) => s + getPaymentTotalAmount(p), 0);
  const registrationCollection = paymentsInRange
    .filter((p) => p.feeType === "registration")
    .reduce((s, p) => s + getPaymentTotalAmount(p), 0);

  const recentPayments = useMemo(
    () => [...paymentsInRange].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [paymentsInRange]
  );

  const chartData = useMemo(() => {
    return getRangeChartMonths(range).map((month) => {
      const revenue = payments
        .filter((p) => p.date.startsWith(month.value))
        .reduce((s, p) => s + getPaymentTotalAmount(p), 0);
      return { month: month.label, revenue };
    });
  }, [payments, range]);

  const getStudentName = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown";

  const studentCards = [
    { title: "Students in Range", value: studentsInRange.length, icon: Users, color: "text-primary" },
    { title: "Pending Fees", value: `${pendingSummary.pendingCount} student${pendingSummary.pendingCount !== 1 ? "s" : ""}`, icon: AlertCircle, color: "text-destructive" },
    { title: "Pending Amount", value: formatPKR(pendingSummary.totalPending), icon: CalendarDays, color: "text-destructive" },
    { title: "Expected Fees", value: formatPKR(pendingSummary.totalExpected), icon: DollarSign, color: "text-primary" },
    { title: "Collected", value: formatPKR(totalCollection), icon: CreditCard, color: "text-primary" },
    { title: "Tuition Collected", value: formatPKR(tuitionCollection), icon: DollarSign, color: "text-primary" },
    { title: "Registration", value: formatPKR(registrationCollection), icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Student Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of student fees & collections for {range.label}</p>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <DashboardDateFilter value={dateFilter} onChange={setDateFilter} />
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link to="/students"><Plus className="h-4 w-4 mr-1" /> Add Student</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/payments"><CreditCard className="h-4 w-4 mr-1" /> Record Payment</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {studentCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{card.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Revenue ({range.label})</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={chartData}>
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Recent Payments ({range.label})</CardTitle></CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No payments recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((p, index) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">
                        <span className="text-xs text-muted-foreground font-mono mr-2">{index + 1}.</span>
                        {getStudentName(p.studentId)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{p.feeType} · {p.date}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{formatPKR(getPaymentTotalAmount(p))}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
