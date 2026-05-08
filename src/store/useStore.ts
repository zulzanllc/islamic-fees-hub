import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Student, FeeStructure, Payment, StudentPaymentSubmission } from "@/types";
import { writeAppLog } from "@/lib/appLogger";

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
          leavingDate: (s as any).leaving_date ?? null,
          monthlyFee: Number((s as any).monthly_fee ?? 0),
          openingDueAmount: Number((s as any).opening_due_amount ?? 0),
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
      leaving_date: student.leavingDate || null,
      monthly_fee: student.monthlyFee ?? 0,
      opening_due_amount: student.openingDueAmount ?? 0,
      status: student.status,
    };
    if (student.studentCode) insertData.student_code = student.studentCode;
    const { data, error } = await supabase
      .from("students")
      .insert(insertData as any)
      .select()
      .single();
    if (data) {
      await writeAppLog({
        action: "student_created",
        entityType: "student",
        entityId: data.id,
        message: `Created student ${student.name}`,
        details: {
          studentCode: data.student_code ?? student.studentCode ?? "",
          classGrade: student.classGrade,
          monthlyFee: student.monthlyFee ?? 0,
        },
      });
      await fetchStudents();
    }
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
        leaving_date: s.leavingDate || null,
        monthly_fee: s.monthlyFee ?? 0,
        opening_due_amount: s.openingDueAmount ?? 0,
        status: s.status,
      };
      if (s.studentCode) row.student_code = s.studentCode;
      return row;
    });
    const { error } = await supabase.from("students").insert(rows as any);
    if (!error) {
      await writeAppLog({
        action: "students_imported",
        entityType: "student",
        message: `Imported ${students.length} students`,
        details: {
          count: students.length,
        },
      });
    }
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
    if (updates.leavingDate !== undefined) mapped.leaving_date = updates.leavingDate || null;
    if (updates.monthlyFee !== undefined) mapped.monthly_fee = updates.monthlyFee;
    if (updates.openingDueAmount !== undefined) mapped.opening_due_amount = updates.openingDueAmount;
    if (updates.status !== undefined) mapped.status = updates.status;
    await supabase.from("students").update(mapped).eq("id", id);
    await writeAppLog({
      action: "student_updated",
      entityType: "student",
      entityId: id,
      message: `Updated student ${id}`,
      details: updates as Record<string, unknown>,
    });
    await fetchStudents();
  }, [fetchStudents]);

  const deleteStudent = useCallback(async (id: string) => {
    await supabase.from("students").delete().eq("id", id);
    await writeAppLog({
      action: "student_deleted",
      entityType: "student",
      entityId: id,
      message: `Deleted student ${id}`,
    });
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
    await writeAppLog({
      action: "fee_structure_created",
      entityType: "fee_structure",
      message: `Created ${fee.feeType} fee for ${fee.classGrade}`,
      details: fee as Record<string, unknown>,
    });
    await fetchFees();
  }, [fetchFees]);

  const updateFee = useCallback(async (id: string, updates: Partial<FeeStructure>) => {
    const mapped: Record<string, unknown> = {};
    if (updates.classGrade !== undefined) mapped.class_grade = updates.classGrade;
    if (updates.feeType !== undefined) mapped.fee_type = updates.feeType;
    if (updates.amount !== undefined) mapped.amount = updates.amount;
    await supabase.from("fee_structures").update(mapped).eq("id", id);
    await writeAppLog({
      action: "fee_structure_updated",
      entityType: "fee_structure",
      entityId: id,
      message: `Updated fee structure ${id}`,
      details: updates as Record<string, unknown>,
    });
    await fetchFees();
  }, [fetchFees]);

  const deleteFee = useCallback(async (id: string) => {
    await supabase.from("fee_structures").delete().eq("id", id);
    await writeAppLog({
      action: "fee_structure_deleted",
      entityType: "fee_structure",
      entityId: id,
      message: `Deleted fee structure ${id}`,
    });
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
          proofImageUrl: (p as any).proof_image_url ?? "",
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
        proof_image_url: (payment as any).proofImageUrl || "",
      })
      .select()
      .single();
    await fetchPayments();
    if (data) {
      await writeAppLog({
        action: "payment_created",
        entityType: "payment",
        entityId: data.id,
        message: `Recorded ${payment.feeType} payment`,
        details: {
          studentId: payment.studentId,
          amountPaid: payment.amountPaid,
          feeMonth: payment.feeMonth,
          paymentMode: payment.paymentMode,
        },
      });
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
        proofImageUrl: (data as any).proof_image_url ?? "",
        receiptPrinted: (data as any).receipt_printed ?? false,
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
    if (updates.proofImageUrl !== undefined) mapped.proof_image_url = updates.proofImageUrl;

    const { error } = await supabase.from("payments").update(mapped).eq("id", id);
    if (!error) {
      await writeAppLog({
        action: "payment_updated",
        entityType: "payment",
        entityId: id,
        message: `Updated payment ${id}`,
        details: updates as Record<string, unknown>,
      });
      await fetchPayments();
    }
    return error;
  }, [fetchPayments]);

  const deletePayment = useCallback(async (id: string) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (!error) {
      await writeAppLog({
        action: "payment_deleted",
        entityType: "payment",
        entityId: id,
        message: `Deleted payment ${id}`,
      });
      await fetchPayments();
    }
    return error;
  }, [fetchPayments]);

  return { payments, loading, addPayment, updatePayment, deletePayment };
}

export function useStudentPaymentSubmissions() {
  const [submissions, setSubmissions] = useState<StudentPaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("student_payment_submissions")
      .select("*")
      .order("submission_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
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
    } else {
      setSubmissions([]);
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
    if (!error) {
      await writeAppLog({
        action: "payment_submission_created",
        entityType: "student_payment_submission",
        message: `Created student payment submission for ${submission.feeMonth}`,
        details: {
          feeMonth: submission.feeMonth,
          amountSubmitted: submission.amountSubmitted,
          paymentMode: submission.paymentMode,
        },
      });
      await fetchSubmissions();
    }
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
    if (!error) {
      await writeAppLog({
        action: "payment_submission_updated",
        entityType: "student_payment_submission",
        entityId: id,
        message: `Updated student payment submission ${id}`,
        details: submission as Record<string, unknown>,
      });
      await fetchSubmissions();
    }
    return error;
  }, [fetchSubmissions]);

  return { submissions, loading, addSubmission, updateSubmission, fetchSubmissions };
}
