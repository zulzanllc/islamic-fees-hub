import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Student, FeeStructure, Payment, StudentPaymentSubmission } from "@/types";

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setStudents(
        data.map((s) => ({
          id: s.id,
          studentCode: (s as any).student_code ?? "",
          name: s.name,
          guardianName: s.guardian_name,
          contact: s.contact,
          classGrade: s.class_grade,
          enrollmentDate: s.enrollment_date,
          status: s.status as "active" | "inactive",
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const addStudent = useCallback(async (student: Omit<Student, "id" | "studentCode"> & { studentCode?: string }) => {
    const insertData: Record<string, unknown> = {
      name: student.name,
      guardian_name: student.guardianName,
      contact: student.contact,
      class_grade: student.classGrade,
      enrollment_date: student.enrollmentDate,
      status: student.status,
    };
    if (student.studentCode) insertData.student_code = student.studentCode;
    const { data, error } = await supabase
      .from("students")
      .insert(insertData as any)
      .select()
      .single();
    if (data) await fetchStudents();
    return data;
  }, [fetchStudents]);

  const bulkAddStudents = useCallback(async (students: Array<Omit<Student, "id" | "studentCode"> & { studentCode?: string }>) => {
    const rows = students.map((s) => {
      const row: Record<string, unknown> = {
        name: s.name,
        guardian_name: s.guardianName,
        contact: s.contact,
        class_grade: s.classGrade,
        enrollment_date: s.enrollmentDate,
        status: s.status,
      };
      if (s.studentCode) row.student_code = s.studentCode;
      return row;
    });
    const { error } = await supabase.from("students").insert(rows as any);
    await fetchStudents();
    return error;
  }, [fetchStudents]);

  const updateStudent = useCallback(async (id: string, updates: Partial<Student>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.name !== undefined) mapped.name = updates.name;
    if (updates.guardianName !== undefined) mapped.guardian_name = updates.guardianName;
    if (updates.contact !== undefined) mapped.contact = updates.contact;
    if (updates.classGrade !== undefined) mapped.class_grade = updates.classGrade;
    if (updates.enrollmentDate !== undefined) mapped.enrollment_date = updates.enrollmentDate;
    if (updates.status !== undefined) mapped.status = updates.status;
    await supabase.from("students").update(mapped).eq("id", id);
    await fetchStudents();
  }, [fetchStudents]);

  const deleteStudent = useCallback(async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    await fetchStudents();
  }, [fetchStudents]);

  return { students, loading, addStudent, bulkAddStudents, updateStudent, deleteStudent };
}

export function useFeeStructures() {
  const [fees, setFees] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFees = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fee_structures")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setFees(
        data.map((f) => ({
          id: f.id,
          classGrade: f.class_grade,
          feeType: f.fee_type as "tuition" | "registration",
          amount: Number(f.amount),
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFees(); }, [fetchFees]);

  const addFee = useCallback(async (fee: Omit<FeeStructure, "id">) => {
    await supabase.from("fee_structures").insert({
      class_grade: fee.classGrade,
      fee_type: fee.feeType,
      amount: fee.amount,
    });
    await fetchFees();
  }, [fetchFees]);

  const updateFee = useCallback(async (id: string, updates: Partial<FeeStructure>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.classGrade !== undefined) mapped.class_grade = updates.classGrade;
    if (updates.feeType !== undefined) mapped.fee_type = updates.feeType;
    if (updates.amount !== undefined) mapped.amount = updates.amount;
    await supabase.from("fee_structures").update(mapped).eq("id", id);
    await fetchFees();
  }, [fetchFees]);

  const deleteFee = useCallback(async (id: string) => {
    await supabase.from("fee_structures").delete().eq("id", id);
    await fetchFees();
  }, [fetchFees]);

  return { fees, loading, addFee, updateFee, deleteFee };
}

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setPayments(
        data.map((p) => ({
          id: p.id,
          studentId: p.student_id,
          feeType: p.fee_type as "tuition" | "registration",
          amountPaid: Number(p.amount_paid),
          date: p.date,
          feeMonth: p.fee_month ?? "",
          receiptNumber: p.receipt_number,
          notes: p.notes,
          collectedBy: p.collected_by,
          paymentMode: p.payment_mode,
          receiptPrinted: (p as any).receipt_printed ?? false,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const addPayment = useCallback(async (payment: Omit<Payment, "id" | "receiptNumber" | "receiptPrinted">) => {
    const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;
    const { data } = await supabase
      .from("payments")
      .insert({
        student_id: payment.studentId,
        fee_type: payment.feeType,
        amount_paid: payment.amountPaid,
        date: payment.date,
        fee_month: payment.feeMonth,
        receipt_number: receiptNumber,
        notes: payment.notes,
        collected_by: payment.collectedBy,
        payment_mode: payment.paymentMode,
      })
      .select()
      .single();
    await fetchPayments();
    if (data) {
      return {
        id: data.id,
        studentId: data.student_id,
        feeType: data.fee_type as "tuition" | "registration",
        amountPaid: Number(data.amount_paid),
        date: data.date,
        feeMonth: data.fee_month ?? "",
        receiptNumber: data.receipt_number,
        notes: data.notes,
        collectedBy: data.collected_by,
        paymentMode: data.payment_mode,
      };
    }
    return null;
  }, [fetchPayments]);

  const updatePayment = useCallback(async (id: string, updates: Partial<Payment>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.studentId !== undefined) mapped.student_id = updates.studentId;
    if (updates.feeType !== undefined) mapped.fee_type = updates.feeType;
    if (updates.amountPaid !== undefined) mapped.amount_paid = updates.amountPaid;
    if (updates.date !== undefined) mapped.date = updates.date;
    if (updates.feeMonth !== undefined) mapped.fee_month = updates.feeMonth;
    if (updates.notes !== undefined) mapped.notes = updates.notes;
    if (updates.collectedBy !== undefined) mapped.collected_by = updates.collectedBy;
    if (updates.paymentMode !== undefined) mapped.payment_mode = updates.paymentMode;
    if (updates.receiptPrinted !== undefined) mapped.receipt_printed = updates.receiptPrinted;

    const { error } = await supabase.from("payments").update(mapped).eq("id", id);
    if (!error) await fetchPayments();
    return error;
  }, [fetchPayments]);

  return { payments, loading, addPayment, updatePayment };
}

export function useStudentPaymentSubmissions() {
  const [submissions, setSubmissions] = useState<StudentPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_payment_submissions")
      .select("*")
      .order("submission_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (data) {
      setSubmissions(
        data.map((submission) => ({
          id: submission.id,
          feeMonth: submission.fee_month,
          amountSubmitted: Number(submission.amount_submitted),
          totalCollectedAtSubmission: Number(submission.total_collected_at_submission),
          previouslySubmittedAmount: Number(submission.previously_submitted_amount),
          remainingAfterSubmission: Number(submission.remaining_after_submission),
          submissionDate: submission.submission_date,
          paymentMode: submission.payment_mode,
          notes: submission.notes,
          submittedBy: submission.submitted_by,
          createdAt: submission.created_at,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const addSubmission = useCallback(async (
    submission: Omit<StudentPaymentSubmission, "id" | "createdAt">
  ) => {
    const { error } = await supabase.from("student_payment_submissions").insert({
      fee_month: submission.feeMonth,
      amount_submitted: submission.amountSubmitted,
      total_collected_at_submission: submission.totalCollectedAtSubmission,
      previously_submitted_amount: submission.previouslySubmittedAmount,
      remaining_after_submission: submission.remainingAfterSubmission,
      submission_date: submission.submissionDate,
      payment_mode: submission.paymentMode,
      notes: submission.notes,
      submitted_by: submission.submittedBy,
    });
    if (!error) await fetchSubmissions();
    return error;
  }, [fetchSubmissions]);

  const updateSubmission = useCallback(async (
    id: string,
    submission: Partial<Omit<StudentPaymentSubmission, "id" | "createdAt">>
  ) => {
    const updates: Record<string, unknown> = {};
    if (submission.feeMonth !== undefined) updates.fee_month = submission.feeMonth;
    if (submission.amountSubmitted !== undefined) updates.amount_submitted = submission.amountSubmitted;
    if (submission.totalCollectedAtSubmission !== undefined) updates.total_collected_at_submission = submission.totalCollectedAtSubmission;
    if (submission.previouslySubmittedAmount !== undefined) updates.previously_submitted_amount = submission.previouslySubmittedAmount;
    if (submission.remainingAfterSubmission !== undefined) updates.remaining_after_submission = submission.remainingAfterSubmission;
    if (submission.submissionDate !== undefined) updates.submission_date = submission.submissionDate;
    if (submission.paymentMode !== undefined) updates.payment_mode = submission.paymentMode;
    if (submission.notes !== undefined) updates.notes = submission.notes;
    if (submission.submittedBy !== undefined) updates.submitted_by = submission.submittedBy;

    const { error } = await supabase
      .from("student_payment_submissions")
      .update(updates)
      .eq("id", id);
    if (!error) await fetchSubmissions();
    return error;
  }, [fetchSubmissions]);

  return { submissions, loading, addSubmission, updateSubmission, fetchSubmissions };
}
