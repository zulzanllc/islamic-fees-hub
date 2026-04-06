import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Teacher, TeacherLoan, TeacherSalary, TeacherAttendance } from "@/types";

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
    await fetchTeachers();
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
    await fetchTeachers();
  }, [fetchTeachers]);

  const deleteTeacher = useCallback(async (id: string) => {
    await supabase.from("teachers").delete().eq("id", id);
    await fetchTeachers();
  }, [fetchTeachers]);

  const bulkAddTeachers = useCallback(async (list: Omit<Teacher, "id">[]) => {
    const rows = list.map((t) => ({
      name: t.name, contact: t.contact, cnic: t.cnic,
      joining_date: t.joiningDate, status: t.status, monthly_salary: t.monthlySalary,
    }));
    const { error } = await supabase.from("teachers").insert(rows as any);
    await fetchTeachers();
    return error || null;
  }, [fetchTeachers]);

  return { teachers, loading, addTeacher, updateTeacher, deleteTeacher, bulkAddTeachers };
}

export function useTeacherLoans() {
  const [loans, setLoans] = useState<TeacherLoan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("teacher_loans").select("*").order("created_at", { ascending: false });
    if (data) {
      setLoans(data.map((l: any) => ({
        id: l.id, teacherId: l.teacher_id, amount: Number(l.amount),
        remaining: Number(l.remaining), dateIssued: l.date_issued,
        notes: l.notes, status: l.status as "active" | "paid",
        repaymentType: l.repayment_type || "manual",
        repaymentMonth: l.repayment_month || null,
        repaymentPercentage: l.repayment_percentage != null ? Number(l.repayment_percentage) : null,
        repaymentAmount: l.repayment_amount != null ? Number(l.repayment_amount) : null,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const addLoan = useCallback(async (loan: Omit<TeacherLoan, "id">) => {
    await supabase.from("teacher_loans").insert({
      teacher_id: loan.teacherId, amount: loan.amount, remaining: loan.remaining,
      date_issued: loan.dateIssued, notes: loan.notes, status: loan.status,
      repayment_type: loan.repaymentType || "manual",
      repayment_month: loan.repaymentMonth || null,
      repayment_percentage: loan.repaymentPercentage || null,
      repayment_amount: loan.repaymentAmount || null,
    } as any);
    await fetchLoans();
  }, [fetchLoans]);

  const updateLoan = useCallback(async (id: string, updates: Partial<TeacherLoan>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.remaining !== undefined) mapped.remaining = updates.remaining;
    if (updates.status !== undefined) mapped.status = updates.status;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    await supabase.from("teacher_loans").update(mapped).eq("id", id);
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
        otherDeduction: Number(s.other_deduction), netPaid: Number(s.net_paid),
        datePaid: s.date_paid, notes: s.notes,
        paymentMode: s.payment_mode || "cash",
        receiptUrl: s.receipt_url || "",
        customAmount: Number(s.custom_amount || 0),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSalaries(); }, [fetchSalaries]);

  const addSalary = useCallback(async (salary: Omit<TeacherSalary, "id">) => {
    await supabase.from("teacher_salaries").insert({
      teacher_id: salary.teacherId, month: salary.month, base_salary: salary.baseSalary,
      loan_deduction: salary.loanDeduction, other_deduction: salary.otherDeduction,
      net_paid: salary.netPaid, date_paid: salary.datePaid, notes: salary.notes,
      payment_mode: salary.paymentMode || "cash",
      receipt_url: salary.receiptUrl || "",
      custom_amount: salary.customAmount || 0,
      proof_image_url: (salary as any).proofImageUrl || "",
    } as any);
    await fetchSalaries();
  }, [fetchSalaries]);

  const updateSalary = useCallback(async (id: string, updates: Partial<TeacherSalary>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.otherDeduction !== undefined) mapped.other_deduction = updates.otherDeduction;
    if (updates.netPaid !== undefined) mapped.net_paid = updates.netPaid;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    await supabase.from("teacher_salaries").update(mapped).eq("id", id);
    await fetchSalaries();
  }, [fetchSalaries]);

  const deleteSalary = useCallback(async (id: string) => {
    await supabase.from("teacher_salaries").delete().eq("id", id);
    await fetchSalaries();
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
    await fetchAttendance();
  }, [fetchAttendance]);

  const updateAttendance = useCallback(async (id: string, updates: Partial<TeacherAttendance>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.timeIn !== undefined) mapped.time_in = updates.timeIn;
    if (updates.timeOut !== undefined) mapped.time_out = updates.timeOut;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    await supabase.from("teacher_attendance").update(mapped).eq("id", id);
    await fetchAttendance();
  }, [fetchAttendance]);

  return { attendance, loading, addAttendance, updateAttendance };
}
