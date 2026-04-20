import { useMemo } from "react";
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
import { Users, DollarSign, AlertCircle, TrendingUp, Plus, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { formatPKR } from "@/lib/currency";
import { getProratedMonthlyAmount } from "@/lib/proration";

const chartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(160 45% 32%)" },
};

export default function Dashboard() {
  const { students } = useStudents();
  const { payments } = usePayments();
  const { fees } = useFeeStructures();

  const activeStudents = students.filter((s) => s.status === "active");
  const currentMonth = format(new Date(), "yyyy-MM");
  const studentsPaidThisMonth = new Map<string, number>();
  payments
    .filter((p) => p.feeMonth === currentMonth && p.feeType === "tuition")
    .forEach((p) => {
      studentsPaidThisMonth.set(p.studentId, (studentsPaidThisMonth.get(p.studentId) ?? 0) + p.amountPaid);
    });
  const pendingStudents = activeStudents.filter((student) => {
    const fee = fees.find((f) => f.classGrade === student.classGrade && f.feeType === "tuition");
    const expectedFee = getProratedMonthlyAmount(fee?.amount ?? 0, student.enrollmentDate, currentMonth);
    return expectedFee > (studentsPaidThisMonth.get(student.id) ?? 0);
  });

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayPayments = payments.filter((p) => p.date === todayStr);
  const todayCollection = todayPayments.reduce((s, p) => s + p.amountPaid, 0);

  const currentYear = new Date().getFullYear().toString();
  const monthlyCollection = payments
    .filter((p) => p.feeMonth === currentMonth)
    .reduce((s, p) => s + p.amountPaid, 0);
  const yearlyCollection = payments
    .filter((p) => p.date.startsWith(currentYear))
    .reduce((s, p) => s + p.amountPaid, 0);

  const recentPayments = useMemo(
    () => [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [payments]
  );

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i);
      const start = startOfMonth(month);
      const end = endOfMonth(month);
      const revenue = payments
        .filter((p) => isWithinInterval(new Date(p.date), { start, end }))
        .reduce((s, p) => s + p.amountPaid, 0);
      return { month: format(month, "MMM"), revenue };
    });
  }, [payments]);

  const getStudentName = (id: string) => students.find((s) => s.id === id)?.name ?? "Unknown";

  const studentCards = [
    { title: "Total Students", value: activeStudents.length, icon: Users, color: "text-primary" },
    { title: "Pending Fees", value: `${pendingStudents.length} student${pendingStudents.length !== 1 ? "s" : ""}`, icon: AlertCircle, color: "text-destructive" },
    { title: "Today's Collection", value: formatPKR(todayCollection), icon: TrendingUp, color: "text-primary" },
    { title: "This Month", value: formatPKR(monthlyCollection), icon: CreditCard, color: "text-primary" },
    { title: "This Year", value: formatPKR(yearlyCollection), icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Student Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of student fees & collections</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to="/students"><Plus className="h-4 w-4 mr-1" /> Add Student</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/payments"><CreditCard className="h-4 w-4 mr-1" /> Record Payment</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
          <CardHeader><CardTitle className="text-lg">Revenue (Last 6 Months)</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-lg">Recent Payments</CardTitle></CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No payments recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{getStudentName(p.studentId)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{p.feeType} · {p.date}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{formatPKR(p.amountPaid)}</span>
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
