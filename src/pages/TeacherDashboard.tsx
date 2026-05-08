import { useMemo, useState } from "react";
import ProofUpload from "@/components/ProofUpload";
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
import { useTeachers, useTeacherSalaries, useTeacherLoans, useTeacherSalarySettings } from "@/store/useTeacherStore";
import { useTeacherAdvances } from "@/store/useTeacherAdvances";
import { Briefcase, Banknote, Clock, AlertCircle, CreditCard, Search, Landmark, Wallet } from "lucide-react";
import { format } from "date-fns";
import { formatPKR } from "@/lib/currency";
import { toast } from "sonner";
import { getProratedMonthlyAmount } from "@/lib/proration";
import { getEffectiveTeacherMonthlySalary } from "@/lib/teacherSalary";
import { DashboardDateFilter } from "@/components/DashboardDateFilter";
import {
  createDefaultDashboardDateFilter,
  getDashboardDateRange,
  getMonthKeysInRange,
  getRangeChartMonths,
  isDateInDashboardRange,
  isDateOnOrBefore,
  isPersonActiveInRange,
} from "@/lib/dashboardDateRange";

const salaryChartConfig: ChartConfig = {
  salary: { label: "Salaries", color: "hsl(220 60% 50%)" },
};

export default function TeacherDashboard() {
  const { teachers } = useTeachers();
  const { salaries } = useTeacherSalaries();
  const { loans } = useTeacherLoans();
  const { settings } = useTeacherSalarySettings();
  const { advances, addAdvance } = useTeacherAdvances();

  const [dateFilter, setDateFilter] = useState(createDefaultDashboardDateFilter);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ teacherId: "", amount: 0, notes: "", paymentMode: "cash" as "cash" | "online", proofImageUrl: "" });
  const [advanceTeacherSearch, setAdvanceTeacherSearch] = useState("");

  const currentMonth = format(new Date(), "yyyy-MM");
  const range = useMemo(() => getDashboardDateRange(dateFilter), [dateFilter]);
  const rangeMonths = useMemo(() => getMonthKeysInRange(range), [range]);

  const activeTeachers = teachers.filter((t) => t.status === "active");
  const teachersInRange = useMemo(
    () => teachers.filter((teacher) => isPersonActiveInRange(teacher.joiningDate, teacher.status, range)),
    [teachers, range]
  );
  const filteredAdvanceTeachers = useMemo(() => {
    const query = advanceTeacherSearch.trim().toLowerCase();
    if (!query) return activeTeachers;
    return activeTeachers.filter((teacher) =>
      teacher.name.toLowerCase().includes(query) ||
      teacher.contact.toLowerCase().includes(query) ||
      teacher.cnic.toLowerCase().includes(query)
    );
  }, [activeTeachers, advanceTeacherSearch]);
  const salariesInRange = useMemo(
    () => salaries.filter((salary) => isDateInDashboardRange(salary.datePaid, range)),
    [salaries, range]
  );

  const pendingSalaryData = useMemo(() => {
    const salaryPaidByTeacher = new Map<string, number>();
    salaries
      .filter((salary) => rangeMonths.includes(salary.month))
      .forEach((salary) => {
        salaryPaidByTeacher.set(salary.teacherId, (salaryPaidByTeacher.get(salary.teacherId) ?? 0) + salary.netPaid);
      });

    return teachersInRange
      .map((teacher) => {
        const expectedSalary = rangeMonths.reduce(
          (sum, month) =>
            sum +
            getProratedMonthlyAmount(
              getEffectiveTeacherMonthlySalary(teacher.monthlySalary, teacher.joiningDate, month, settings.annualIncrementPercentage),
              teacher.joiningDate,
              month
            ),
          0
        );
        const paidSalary = salaryPaidByTeacher.get(teacher.id) ?? 0;
        const pendingSalary = Math.max(0, expectedSalary - paidSalary);

        return { teacher, expectedSalary, paidSalary, pendingSalary };
      })
      .filter((item) => item.pendingSalary > 0);
  }, [salaries, rangeMonths, teachersInRange, settings.annualIncrementPercentage]);

  const totalPendingSalary = pendingSalaryData.reduce((sum, item) => sum + item.pendingSalary, 0);

  const totalSalaryIssued = salariesInRange.reduce((s, sal) => s + sal.netPaid, 0);
  const totalSalaryPaidCash = salariesInRange
    .filter((s) => s.paymentMode === "cash")
    .reduce((sum, salary) => sum + salary.netPaid, 0);
  const totalSalaryPaidOnline = salariesInRange
    .filter((s) => s.paymentMode === "online")
    .reduce((sum, salary) => sum + salary.netPaid, 0);

  const activeLoansTotal = loans
    .filter((l) => l.status === "active" && isDateOnOrBefore(l.dateIssued, range.end))
    .reduce((s, l) => s + l.remaining, 0);

  const salaryChartData = useMemo(() => {
    return getRangeChartMonths(range).map((month) => {
      const salary = salaries.filter((s) => s.month === month.value).reduce((sum, s) => sum + s.netPaid, 0);
      return { month: month.label, salary };
    });
  }, [salaries, range]);

  const recentSalaries = useMemo(
    () => [...salariesInRange].sort((a, b) => new Date(b.datePaid).getTime() - new Date(a.datePaid).getTime()).slice(0, 5),
    [salariesInRange]
  );

  const getTeacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? "Unknown";

  const handleAdvanceSalary = async () => {
    if (!advanceForm.teacherId) { toast.error("Select a teacher"); return; }
    if (advanceForm.amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (advanceForm.paymentMode === "online" && !advanceForm.proofImageUrl) { toast.error("Please upload payment proof for online payment"); return; }
    const teacher = teachers.find((t) => t.id === advanceForm.teacherId);
    if (!teacher) return;

    const existingAdvances = advances
      .filter((advance) => advance.teacherId === advanceForm.teacherId && advance.month === currentMonth)
      .reduce((sum, advance) => sum + advance.amount, 0);
    const remaining =
      getProratedMonthlyAmount(
        getEffectiveTeacherMonthlySalary(teacher.monthlySalary, teacher.joiningDate, currentMonth, settings.annualIncrementPercentage),
        teacher.joiningDate,
        currentMonth
      ) - existingAdvances;
    if (advanceForm.amount > remaining) {
      toast.error(`Maximum advance available: ${formatPKR(remaining)} (already advanced: ${formatPKR(existingAdvances)})`);
      return;
    }

    await addAdvance({
      teacherId: advanceForm.teacherId,
      month: currentMonth,
      amount: advanceForm.amount,
      dateGiven: format(new Date(), "yyyy-MM-dd"),
      paymentMode: advanceForm.paymentMode,
      notes: advanceForm.notes || "Advance salary",
      proofImageUrl: advanceForm.proofImageUrl,
    });
    toast.success(`Advance of ${formatPKR(advanceForm.amount)} issued to ${teacher.name}`);
    setAdvanceOpen(false);
    setAdvanceForm({ teacherId: "", amount: 0, notes: "", paymentMode: "cash", proofImageUrl: "" });
  };

  const teacherCards = [
    { title: "Teachers in Range", value: teachersInRange.length, icon: Briefcase, color: "text-primary" },
    { title: "Pending Salaries", value: `${pendingSalaryData.length} teacher${pendingSalaryData.length !== 1 ? "s" : ""}`, icon: Clock, color: "text-destructive" },
    { title: "Pending Amount", value: formatPKR(totalPendingSalary), icon: AlertCircle, color: "text-destructive" },
    { title: "Paid in Range", value: formatPKR(totalSalaryIssued), icon: Banknote, color: "text-primary" },
    { title: "Paid in Cash", value: formatPKR(totalSalaryPaidCash), icon: Wallet, color: "text-primary" },
    { title: "Paid Online", value: formatPKR(totalSalaryPaidOnline), icon: Landmark, color: "text-primary" },
    { title: "Outstanding Loans", value: formatPKR(activeLoansTotal), icon: CreditCard, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teacher Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of teacher salaries & loans for {range.label}</p>
        </div>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <DashboardDateFilter value={dateFilter} onChange={setDateFilter} />
          <Dialog
            open={advanceOpen}
            onOpenChange={(nextOpen) => {
              setAdvanceOpen(nextOpen);
              if (!nextOpen) {
                setAdvanceTeacherSearch("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Banknote className="h-4 w-4 mr-1" /> Issue Advance Salary</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Issue Advance Salary</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Give advance salary for the current month (<strong>{format(new Date(), "MMMM yyyy")}</strong>). This amount will be deducted when full salary is paid.
            </p>
            <div className="space-y-3 mt-2">
              <div>
                <Label>Teacher</Label>
                <Select value={advanceForm.teacherId} onValueChange={(v) => setAdvanceForm({ ...advanceForm, teacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>
                    <div className="sticky top-0 z-10 bg-popover p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={advanceTeacherSearch}
                          onChange={(e) => setAdvanceTeacherSearch(e.target.value)}
                          onKeyDown={(e) => e.stopPropagation()}
                          placeholder="Search teacher..."
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                    {activeTeachers.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2 text-center">No active teachers found.</p>
                    )}
                    {activeTeachers.length > 0 && filteredAdvanceTeachers.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2 text-center">No teachers found.</p>
                    )}
                    {filteredAdvanceTeachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {advanceForm.teacherId && (() => {
                const teacher = teachers.find((t) => t.id === advanceForm.teacherId);
                const base = teacher
                  ? getProratedMonthlyAmount(
                      getEffectiveTeacherMonthlySalary(teacher.monthlySalary, teacher.joiningDate, currentMonth, settings.annualIncrementPercentage),
                      teacher.joiningDate,
                      currentMonth
                    )
                  : 0;
                const existingAdvances = advances
                  .filter((advance) => advance.teacherId === advanceForm.teacherId && advance.month === currentMonth)
                  .reduce((sum, advance) => sum + advance.amount, 0);
                const remaining = base - existingAdvances;
                return (
                  <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                    <p>Monthly Salary: <strong>{formatPKR(base)}</strong></p>
                    {existingAdvances > 0 && <p>Already Advanced: <strong className="text-destructive">{formatPKR(existingAdvances)}</strong></p>}
                    <p>Available for Advance: <strong className="text-primary">{formatPKR(remaining)}</strong></p>
                  </div>
                );
              })()}
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
              {advanceForm.paymentMode === "online" && (
                <ProofUpload
                  value={advanceForm.proofImageUrl}
                  onChange={(url) => setAdvanceForm({ ...advanceForm, proofImageUrl: url })}
                  required
                />
              )}
              <div>
                <Label>Notes</Label>
                <Input value={advanceForm.notes} onChange={(e) => setAdvanceForm({ ...advanceForm, notes: e.target.value })} placeholder="e.g. Advance for Eid" />
              </div>
              <Button className="w-full" onClick={handleAdvanceSalary}>Issue Advance</Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
          <CardHeader><CardTitle className="text-lg">Salary Disbursement ({range.label})</CardTitle></CardHeader>
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
          <CardHeader><CardTitle className="text-lg">Pending Salary Teachers ({range.label})</CardTitle></CardHeader>
          <CardContent>
            {pendingSalaryData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">All teachers paid for this period!</p>
            ) : (
              <div className="space-y-3">
                {pendingSalaryData.map(({ teacher, pendingSalary }) => (
                  <div key={teacher.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{teacher.name}</p>
                      <p className="text-xs text-muted-foreground">Since {teacher.joiningDate}</p>
                    </div>
                    <span className="text-sm font-semibold text-destructive">
                      {formatPKR(pendingSalary)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Recent Salary Payments ({range.label})</CardTitle></CardHeader>
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
