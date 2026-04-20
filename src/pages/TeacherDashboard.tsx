import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { useTeachers, useTeacherSalaries, useTeacherLoans } from "@/store/useTeacherStore";
import { Briefcase, Banknote, Clock, AlertCircle, DollarSign, CreditCard } from "lucide-react";
import { format, subMonths } from "date-fns";
import { formatPKR } from "@/lib/currency";
import { toast } from "sonner";
import { getProratedMonthlyAmount } from "@/lib/proration";

const salaryChartConfig: ChartConfig = {
  salary: { label: "Salaries", color: "hsl(220 60% 50%)" },
};

export default function TeacherDashboard() {
  const { teachers } = useTeachers();
  const { salaries } = useTeacherSalaries();
  const { loans, addLoan } = useTeacherLoans();

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ teacherId: "", amount: 0, notes: "", month: format(new Date(), "yyyy-MM"), paymentMode: "cash" as "cash" | "online" });

  const currentMonth = format(new Date(), "yyyy-MM");
  const currentYear = new Date().getFullYear().toString();

  const activeTeachers = teachers.filter((t) => t.status === "active");
  const teachersPaidThisMonth = new Set(
    salaries.filter((s) => s.month === currentMonth).map((s) => s.teacherId)
  );
  const pendingTeachers = activeTeachers.filter(
    (t) => !teachersPaidThisMonth.has(t.id) && getProratedMonthlyAmount(t.monthlySalary, t.joiningDate, currentMonth) > 0
  );
  const totalPendingSalary = pendingTeachers.reduce(
    (s, t) => s + getProratedMonthlyAmount(t.monthlySalary, t.joiningDate, currentMonth),
    0
  );

  const totalSalaryIssuedThisMonth = salaries
    .filter((s) => s.month === currentMonth)
    .reduce((s, sal) => s + sal.netPaid, 0);
  const totalSalaryIssuedThisYear = salaries
    .filter((s) => s.datePaid.startsWith(currentYear))
    .reduce((s, sal) => s + sal.netPaid, 0);

  const activeLoansTotal = loans
    .filter((l) => l.status === "active")
    .reduce((s, l) => s + l.remaining, 0);

  const salaryChartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(now, 5 - i);
      const monthStr = format(month, "yyyy-MM");
      const salary = salaries.filter((s) => s.month === monthStr).reduce((sum, s) => sum + s.netPaid, 0);
      return { month: format(month, "MMM"), salary };
    });
  }, [salaries]);

  const recentSalaries = useMemo(
    () => [...salaries].sort((a, b) => new Date(b.datePaid).getTime() - new Date(a.datePaid).getTime()).slice(0, 5),
    [salaries]
  );

  const getTeacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? "Unknown";

  const handleAdvanceSalary = async () => {
    if (!advanceForm.teacherId) { toast.error("Select a teacher"); return; }
    if (advanceForm.amount <= 0) { toast.error("Enter a valid amount"); return; }
    const teacher = teachers.find((t) => t.id === advanceForm.teacherId);
    if (!teacher) return;
    await addLoan({
      teacherId: advanceForm.teacherId,
      amount: advanceForm.amount,
      remaining: advanceForm.amount,
      dateIssued: format(new Date(), "yyyy-MM-dd"),
      notes: advanceForm.notes || "Advance salary",
      status: "active",
      repaymentType: "manual",
      repaymentMonth: null,
      repaymentPercentage: null,
      repaymentAmount: null,
    });
    toast.success(`Advance of ${formatPKR(advanceForm.amount)} issued to ${teacher.name}`);
    setAdvanceOpen(false);
    setAdvanceForm({ teacherId: "", amount: 0, notes: "", month: format(new Date(), "yyyy-MM"), paymentMode: "cash" });
  };

  const teacherCards = [
    { title: "Active Teachers", value: activeTeachers.length, icon: Briefcase, color: "text-primary" },
    { title: "Pending Salaries", value: `${pendingTeachers.length} teacher${pendingTeachers.length !== 1 ? "s" : ""}`, icon: Clock, color: "text-destructive" },
    { title: "Pending Amount", value: formatPKR(totalPendingSalary), icon: AlertCircle, color: "text-destructive" },
    { title: "Paid This Month", value: formatPKR(totalSalaryIssuedThisMonth), icon: Banknote, color: "text-primary" },
    { title: "Paid This Year", value: formatPKR(totalSalaryIssuedThisYear), icon: DollarSign, color: "text-primary" },
    { title: "Outstanding Loans", value: formatPKR(activeLoansTotal), icon: CreditCard, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teacher Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of teacher salaries & loans</p>
        </div>
        <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Banknote className="h-4 w-4 mr-1" /> Issue Advance Salary</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Issue Advance Salary</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will be recorded as a loan and deducted from future salaries automatically.</p>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Teacher</Label>
                <Select value={advanceForm.teacherId} onValueChange={(v) => setAdvanceForm({ ...advanceForm, teacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    {activeTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Month</Label>
                <Input type="month" value={advanceForm.month} onChange={(e) => setAdvanceForm({ ...advanceForm, month: e.target.value })} />
              </div>
              <div>
                <Label>Amount</Label>
                <Input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: Number(e.target.value) })} placeholder="Enter amount" />
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select value={advanceForm.paymentMode} onValueChange={(v) => setAdvanceForm({ ...advanceForm, paymentMode: v as "cash" | "online" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={advanceForm.notes} onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })} placeholder="e.g. Advance for Eid" />
              </div>
              <Button className="w-full" onClick={handleAdvanceSalary}>Issue Advance</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {teacherCards.map((card) => (
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
          <CardHeader><CardTitle className="text-lg">Salary Disbursement (Last 6 Months)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={salaryChartConfig} className="h-[250px] w-full">
              <BarChart data={salaryChartData}>
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="salary" fill="var(--color-salary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Pending Salary Teachers</CardTitle></CardHeader>
          <CardContent>
            {pendingTeachers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">All teachers paid for this month!</p>
            ) : (
              <div className="space-y-3">
                {pendingTeachers.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">Since {t.joiningDate}</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive">
                      {formatPKR(getProratedMonthlyAmount(t.monthlySalary, t.joiningDate, currentMonth))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Salary Payments</CardTitle></CardHeader>
        <CardContent>
          {recentSalaries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No salary payments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {recentSalaries.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{getTeacherName(s.teacherId)}</p>
                    <p className="text-xs text-muted-foreground">{s.month} · Paid {s.datePaid}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{formatPKR(s.netPaid)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
