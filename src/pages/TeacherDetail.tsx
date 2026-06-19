import { useParams, useNavigate } from "react-router-dom";
import { useTeachers, useTeacherSalaries, useTeacherLoans, useTeacherAttendance, useTeacherSalarySettings } from "@/store/useTeacherStore";
import { useTeacherAdvances } from "@/store/useTeacherAdvances";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, Wallet, HandCoins, Clock, Banknote } from "lucide-react";
import { formatPKR } from "@/lib/currency";
import { format } from "date-fns";
import { getEffectiveTeacherMonthlySalary, getTeacherAnnualIncrementCount } from "@/lib/teacherSalary";
import { getTeacherLoansWithCalculatedBalance } from "@/lib/teacherLoanBalance";

export default function TeacherDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { teachers, loading: teachersLoading } = useTeachers();
  const { salaries, loading: salariesLoading } = useTeacherSalaries();
  const { loans, loading: loansLoading } = useTeacherLoans();
  const { advances } = useTeacherAdvances();
  const { attendance, loading: attendanceLoading } = useTeacherAttendance();
  const { settings, loading: settingsLoading } = useTeacherSalarySettings();

  const teacher = teachers.find((t) => t.id === id);
  const teacherSalaries = salaries.filter((s) => s.teacherId === id);
  const teacherLoans = getTeacherLoansWithCalculatedBalance(loans, salaries, advances, id);
  const teacherAttendance = attendance.filter((a) => a.teacherId === id);

  const loading = teachersLoading || salariesLoading || loansLoading || attendanceLoading || settingsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("/teachers")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Teachers
        </Button>
        <p className="text-center text-muted-foreground py-12">Teacher not found.</p>
      </div>
    );
  }

  const totalPaid = teacherSalaries.reduce((sum, s) => sum + s.netPaid, 0);
  const activeLoans = teacherLoans.filter((l) => l.status === "active");
  const totalLoanRemaining = activeLoans.reduce((sum, l) => sum + l.remaining, 0);
  const teacherAdvances = teacherLoans.filter((l) => l.repaymentType === "manual");
  const totalAdvanceTaken = teacherAdvances.reduce((sum, a) => sum + a.amount, 0);
  const totalAdvanceRemaining = teacherAdvances.filter(a => a.status === "active").reduce((sum, a) => sum + a.remaining, 0);
  const currentMonth = format(new Date(), "yyyy-MM");
  const currentEffectiveSalary = getEffectiveTeacherMonthlySalary(
    teacher.monthlySalary,
    teacher.joiningDate,
    currentMonth,
    settings.annualIncrementPercentage
  );
  const completedIncrements = getTeacherAnnualIncrementCount(teacher.joiningDate, currentMonth);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/teachers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{teacher.name}</h1>
          <p className="text-sm text-muted-foreground">Teacher Profile</p>
        </div>
        <Badge variant={teacher.status === "active" ? "default" : "secondary"} className="ml-auto">
          {teacher.status}
        </Badge>
      </div>

      {/* Profile Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Contact</p>
            <p className="font-medium text-foreground">{teacher.contact || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">CNIC</p>
            <p className="font-medium text-foreground">{teacher.cnic || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Joining Date</p>
            <p className="font-medium text-foreground">{teacher.joiningDate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Current Monthly Salary</p>
            <p className="font-medium text-foreground">{formatPKR(currentEffectiveSalary)}</p>
            {completedIncrements > 0 && (
              <p className="text-xs text-muted-foreground">
                Base {formatPKR(teacher.monthlySalary)} · {completedIncrements} increment{completedIncrements !== 1 ? "s" : ""} applied
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="text-lg font-bold text-foreground">{formatPKR(totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <HandCoins className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Loan Balance</p>
              <p className="text-lg font-bold text-foreground">{formatPKR(totalLoanRemaining)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
              <Banknote className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Advance Balance</p>
              <p className="text-lg font-bold text-foreground">{formatPKR(totalAdvanceRemaining)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <Clock className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Attendance Records</p>
              <p className="text-lg font-bold text-foreground">{teacherAttendance.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="salaries">
        <TabsList>
          <TabsTrigger value="salaries">Salaries ({teacherSalaries.length})</TabsTrigger>
          <TabsTrigger value="advances">Advances ({teacherAdvances.length})</TabsTrigger>
          <TabsTrigger value="loans">Loans ({teacherLoans.length})</TabsTrigger>
          <TabsTrigger value="attendance">Attendance ({teacherAttendance.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="salaries">
          <Card>
            <CardHeader><CardTitle className="text-lg">Salary History</CardTitle></CardHeader>
            <CardContent>
              {teacherSalaries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No salary records.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Loan Ded.</TableHead>
                      <TableHead>Other Ded.</TableHead>
                      <TableHead>Net Paid</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teacherSalaries.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.month}</TableCell>
                        <TableCell>{formatPKR(s.baseSalary)}</TableCell>
                        <TableCell>{formatPKR(s.loanDeduction)}</TableCell>
                        <TableCell>{formatPKR(s.otherDeduction)}</TableCell>
                        <TableCell className="font-semibold">{formatPKR(s.netPaid)}</TableCell>
                        <TableCell>{s.datePaid}</TableCell>
                        <TableCell><Badge variant="outline">{s.paymentMode}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances">
          <Card>
            <CardHeader><CardTitle className="text-lg">Advance Salary History</CardTitle></CardHeader>
            <CardContent>
              {teacherAdvances.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No advance salary records.</p>
              ) : (
                <>
                  <div className="mb-4 flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Total Taken: <strong className="text-foreground">{formatPKR(totalAdvanceTaken)}</strong></span>
                    <span className="text-muted-foreground">Outstanding: <strong className="text-destructive">{formatPKR(totalAdvanceRemaining)}</strong></span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date Issued</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teacherAdvances.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{a.dateIssued}</TableCell>
                          <TableCell>{formatPKR(a.amount)}</TableCell>
                          <TableCell className="font-semibold">{formatPKR(a.remaining)}</TableCell>
                          <TableCell>
                            <Badge variant={a.status === "active" ? "destructive" : "default"}>{a.status}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{a.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card>
            <CardHeader><CardTitle className="text-lg">Loan History</CardTitle></CardHeader>
            <CardContent>
              {teacherLoans.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No loan records.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Issued</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teacherLoans.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>{l.dateIssued}</TableCell>
                        <TableCell>{formatPKR(l.amount)}</TableCell>
                        <TableCell className="font-semibold">{formatPKR(l.remaining)}</TableCell>
                        <TableCell>
                          <Badge variant={l.status === "active" ? "destructive" : "default"}>{l.status}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{l.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader><CardTitle className="text-lg">Attendance Records</CardTitle></CardHeader>
            <CardContent>
              {teacherAttendance.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No attendance records.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time In</TableHead>
                      <TableHead>Time Out</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teacherAttendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.date}</TableCell>
                        <TableCell>{a.timeIn || "—"}</TableCell>
                        <TableCell>{a.timeOut || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{a.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
