import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Teacher, TeacherLoan, TeacherSalary, TeacherAttendance, TeacherSalarySettings } from "@/types";
import { writeAppLog } from "@/lib/appLogger";

export function useTeachers() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("teachers").select("*").order("created_at", { ascending: false });
    if (data) {
      setTeachers(data.map((t: any) => ({
        id: t.id,
        name: t.name,
        contact: t.contact,
        cnic: t.cnic,
        joiningDate: t.joining_date,
        status: t.status as "active" | "inactive",
        monthlySalary: Number(t.monthly_salary),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const addTeacher = useCallback(async (teacher: Omit<Teacher, "id">) => {
    await supabase.from("teachers").insert({
      name: teacher.name, contact: teacher.contact, cnic: teacher.cnic,
      joining_date: teacher.joiningDate, status: teacher.status, monthly_salary: teacher.monthlySalary,
    } as any);
    await writeAppLog({
      action: "teacher_created",
      entityType: "teacher",
      message: `Created teacher ${teacher.name}`,
      details: teacher as Record<string, unknown>,
    });
    await fetchTeachers();
  }, [fetchTeachers]);

  const bulkAddTeachers = useCallback(async (teachers: Omit<Teacher, "id">[]) => {
    const rows = teachers.map((teacher) => ({
      name: teacher.name,
      contact: teacher.contact,
      cnic: teacher.cnic,
      joining_date: teacher.joiningDate,
      status: teacher.status,
      monthly_salary: teacher.monthlySalary,
    }));
    const { error } = await supabase.from("teachers").insert(rows as any);
    if (!error) {
      await writeAppLog({
        action: "teachers_imported",
        entityType: "teacher",
        message: `Imported ${teachers.length} teachers`,
        details: { count: teachers.length },
      });
    }
    await fetchTeachers();
    return error;
  }, [fetchTeachers]);

  const updateTeacher = useCallback(async (id: string, updates: Partial<Teacher>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.contact !== undefined) mapped.contact = updates.contact;
    if (updates.cnic !== undefined) mapped.cnic = updates.cnic;
    if (updates.joiningDate !== undefined) mapped.joining_date = updates.joiningDate;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.monthlySalary !== undefined) mapped.monthly_salary = updates.monthlySalary;
    await supabase.from("teachers").update(mapped).eq("id", id);
    await writeAppLog({
      action: "teacher_updated",
      entityType: "teacher",
      entityId: id,
      message: `Updated teacher ${id}`,
      details: updates as Record<string, unknown>,
    });
    await fetchTeachers();
  }, [fetchTeachers]);

  const deleteTeacher = useCallback(async (id: string) => {
    await supabase.from("teachers").delete().eq("id", id);
    await writeAppLog({
      action: "teacher_deleted",
      entityType: "teacher",
      entityId: id,
      message: `Deleted teacher ${id}`,
    });
    await fetchTeachers();
  }, [fetchTeachers]);

  return { teachers, loading, addTeacher, bulkAddTeachers, updateTeacher, deleteTeacher };
}

export function useTeacherLoans() {
  const [loans, setLoans] = useState<TeacherLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const mapLoanRow = (l: any): TeacherLoan => ({
    id: l.id,
    teacherId: l.teacher_id,
    amount: Number(l.amount),
    remaining: Number(l.remaining),
    dateIssued: l.date_issued,
    notes: l.notes,
    status: l.status as "active" | "paid",
    repaymentType: l.repayment_type || "manual",
    repaymentMonth: l.repayment_month || null,
    repaymentPercentage: l.repayment_percentage != null ? Number(l.repayment_percentage) : null,
    repaymentAmount: l.repayment_amount != null ? Number(l.repayment_amount) : null,
    deductionStartMonth: l.deduction_start_month || (l.date_issued ? String(l.date_issued).slice(0, 7) : null),
  });

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("teacher_loans").select("*").order("created_at", { ascending: false });
    if (data) {
      setLoans(data.map(mapLoanRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const addLoan = useCallback(async (loan: Omit<TeacherLoan, "id">) => {
    const { data } = await supabase.from("teacher_loans").insert({
      teacher_id: loan.teacherId, amount: loan.amount, remaining: loan.remaining,
      date_issued: loan.dateIssued, notes: loan.notes, status: loan.status,
      repayment_type: loan.repaymentType || "manual",
      repayment_month: loan.repaymentMonth || null,
      repayment_percentage: loan.repaymentPercentage || null,
      repayment_amount: loan.repaymentAmount || null,
      deduction_start_month: loan.deductionStartMonth || (loan.dateIssued ? loan.dateIssued.slice(0, 7) : null),
    } as any).select("*").single();
    await writeAppLog({
      action: "teacher_loan_created",
      entityType: "teacher_loan",
      entityId: loan.teacherId,
      message: `Created loan for teacher ${loan.teacherId}`,
      details: loan as Record<string, unknown>,
    });
    await fetchLoans();
    return data ? mapLoanRow(data) : null;
  }, [fetchLoans]);

  const updateLoan = useCallback(async (id: string, updates: Partial<TeacherLoan>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.teacherId !== undefined) mapped.teacher_id = updates.teacherId;
    if (updates.amount !== undefined) mapped.amount = updates.amount;
    if (updates.remaining !== undefined) mapped.remaining = updates.remaining;
    if (updates.dateIssued !== undefined) mapped.date_issued = updates.dateIssued;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    if (updates.repaymentType !== undefined) mapped.repayment_type = updates.repaymentType;
    if (updates.repaymentMonth !== undefined) mapped.repayment_month = updates.repaymentMonth;
    if (updates.repaymentPercentage !== undefined) mapped.repayment_percentage = updates.repaymentPercentage;
    if (updates.repaymentAmount !== undefined) mapped.repayment_amount = updates.repaymentAmount;
    if (updates.deductionStartMonth !== undefined) mapped.deduction_start_month = updates.deductionStartMonth;
    await supabase.from("teacher_loans").update(mapped).eq("id", id);
    await writeAppLog({
      action: "teacher_loan_updated",
      entityType: "teacher_loan",
      entityId: id,
      message: `Updated loan ${id}`,
      details: updates as Record<string, unknown>,
    });
    await fetchLoans();
  }, [fetchLoans]);

  return { loans, loading, addLoan, updateLoan, fetchLoans };
}

export function useTeacherSalaries() {
  const [salaries, setSalaries] = useState<TeacherSalary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSalaries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("teacher_salaries").select("*").order("created_at", { ascending: false });
    if (data) {
      setSalaries(data.map((s: any) => ({
        id: s.id, teacherId: s.teacher_id, month: s.month,
        baseSalary: Number(s.base_salary), loanDeduction: Number(s.loan_deduction),
        otherDeduction: Number(s.other_deduction), bonusAmount: Number(s.bonus_amount || 0), netPaid: Number(s.net_paid),
        datePaid: s.date_paid, notes: s.notes,
        paymentMode: s.payment_mode || "cash",
        receiptUrl: s.receipt_url || "",
        proofImageUrl: s.proof_image_url || "",
        customAmount: Number(s.custom_amount || 0),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);

  const addSalary = useCallback(async (salary: Omit<TeacherSalary, "id">) => {
    const salaryRow = {
      teacher_id: salary.teacherId, month: salary.month, base_salary: salary.baseSalary,
      loan_deduction: salary.loanDeduction, other_deduction: salary.otherDeduction,
      bonus_amount: salary.bonusAmount || 0, net_paid: salary.netPaid, date_paid: salary.datePaid, notes: salary.notes,
      payment_mode: salary.paymentMode || "cash",
      receipt_url: salary.receiptUrl || "",
      proof_image_url: salary.proofImageUrl || "",
      custom_amount: salary.customAmount || 0,
    };

    let { error } = await supabase.from("teacher_salaries").insert(salaryRow as any);
    const missingBonusColumn =
      error &&
      (error.code === "PGRST204" || error.code === "42703") &&
      error.message.toLowerCase().includes("bonus_amount");

    if (missingBonusColumn && !salary.bonusAmount) {
      const { bonus_amount, ...fallbackSalaryRow } = salaryRow;
      const fallbackResult = await supabase.from("teacher_salaries").insert(fallbackSalaryRow as any);
      error = fallbackResult.error;
    }

    if (error) throw error;

    await writeAppLog({
      action: "teacher_salary_created",
      entityType: "teacher_salary",
      entityId: salary.teacherId,
      message: `Recorded salary for teacher ${salary.teacherId}`,
      details: {
        month: salary.month,
        netPaid: salary.netPaid,
        paymentMode: salary.paymentMode,
      },
    });
    await fetchSalaries();
  }, [fetchSalaries]);

  const updateSalary = useCallback(async (id: string, updates: Partial<TeacherSalary>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.baseSalary !== undefined) mapped.base_salary = updates.baseSalary;
    if (updates.loanDeduction !== undefined) mapped.loan_deduction = updates.loanDeduction;
    if (updates.otherDeduction !== undefined) mapped.other_deduction = updates.otherDeduction;
    if (updates.bonusAmount !== undefined) mapped.bonus_amount = updates.bonusAmount;
    if (updates.netPaid !== undefined) mapped.net_paid = updates.netPaid;
    if (updates.datePaid !== undefined) mapped.date_paid = updates.datePaid;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    if (updates.paymentMode !== undefined) mapped.payment_mode = updates.paymentMode;
    if (updates.receiptUrl !== undefined) mapped.receipt_url = updates.receiptUrl;
    if (updates.proofImageUrl !== undefined) mapped.proof_image_url = updates.proofImageUrl;
    if (updates.customAmount !== undefined) mapped.custom_amount = updates.customAmount;
    const { error } = await supabase.from("teacher_salaries").update(mapped).eq("id", id);
    if (!error) {
      await writeAppLog({
        action: "teacher_salary_updated",
        entityType: "teacher_salary",
        entityId: id,
        message: `Updated salary ${id}`,
        details: updates as Record<string, unknown>,
      });
      await fetchSalaries();
    }
    return error;
  }, [fetchSalaries]);

  const deleteSalary = useCallback(async (id: string) => {
    const { error } = await supabase.from("teacher_salaries").delete().eq("id", id);
    if (!error) {
      await writeAppLog({
        action: "teacher_salary_deleted",
        entityType: "teacher_salary",
        entityId: id,
        message: `Deleted salary ${id}`,
      });
      await fetchSalaries();
    }
    return error;
  }, [fetchSalaries]);

  return { salaries, loading, addSalary, updateSalary, deleteSalary };
}

export function useTeacherAttendance() {
  const [attendance, setAttendance] = useState<TeacherAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("teacher_attendance").select("*").order("date", { ascending: false });
    if (data) {
      setAttendance(data.map((a: any) => ({
        id: a.id, teacherId: a.teacher_id, date: a.date,
        timeIn: a.time_in, timeOut: a.time_out, notes: a.notes,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const addAttendance = useCallback(async (entry: Omit<TeacherAttendance, "id">) => {
    await supabase.from("teacher_attendance").insert({
      teacher_id: entry.teacherId, date: entry.date,
      time_in: entry.timeIn, time_out: entry.timeOut, notes: entry.notes,
    } as any);
    await writeAppLog({
      action: "teacher_attendance_created",
      entityType: "teacher_attendance",
      entityId: entry.teacherId,
      message: `Recorded attendance for teacher ${entry.teacherId}`,
      details: entry as Record<string, unknown>,
    });
    await fetchAttendance();
  }, [fetchAttendance]);

  const updateAttendance = useCallback(async (id: string, updates: Partial<TeacherAttendance>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.timeIn !== undefined) mapped.time_in = updates.timeIn;
    if (updates.timeOut !== undefined) mapped.time_out = updates.timeOut;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    await supabase.from("teacher_attendance").update(mapped).eq("id", id);
    await writeAppLog({
      action: "teacher_attendance_updated",
      entityType: "teacher_attendance",
      entityId: id,
      message: `Updated attendance ${id}`,
      details: updates as Record<string, unknown>,
    });
    await fetchAttendance();
  }, [fetchAttendance]);

  return { attendance, loading, addAttendance, updateAttendance };
}

export function useTeacherSalarySettings() {
  const [settings, setSettings] = useState<TeacherSalarySettings>({ annualIncrementPercentage: 10 });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("teacher_salary_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      setSettings({
        annualIncrementPercentage: Number((data as any).annual_increment_percentage ?? 10),
      });
    } else {
      setSettings({ annualIncrementPercentage: 10 });
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: Partial<TeacherSalarySettings>) => {
    const { error } = await supabase.from("teacher_salary_settings").upsert({
      id: 1,
      annual_increment_percentage: updates.annualIncrementPercentage ?? settings.annualIncrementPercentage,
    } as any);
    if (!error) {
      await writeAppLog({
        source: "admin",
        action: "teacher_salary_settings_updated",
        entityType: "teacher_salary_settings",
        entityId: "1",
        message: "Updated teacher salary settings",
        details: updates as Record<string, unknown>,
      });
      await fetchSettings();
    }
    return error;
  }, [fetchSettings, settings.annualIncrementPercentage]);

  return { settings, loading, updateSettings, fetchSettings };
}
