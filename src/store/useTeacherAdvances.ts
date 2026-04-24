import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeacherAdvance {
  id: string;
  teacherId: string;
  month: string;
  amount: number;
  dateGiven: string;
  paymentMode: string;
  notes: string;
  proofImageUrl: string;
}

export function useTeacherAdvances() {
  const [advances, setAdvances] = useState<TeacherAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdvances = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("teacher_advances" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setAdvances(
        data.map((advance: any) => ({
          id: advance.id,
          teacherId: advance.teacher_id,
          month: advance.month,
          amount: Number(advance.amount),
          dateGiven: advance.date_given,
          paymentMode: advance.payment_mode,
          notes: advance.notes,
          proofImageUrl: advance.proof_image_url || "",
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  const addAdvance = useCallback(async (advance: Omit<TeacherAdvance, "id">) => {
    const { error } = await supabase.from("teacher_advances" as any).insert({
      teacher_id: advance.teacherId,
      month: advance.month,
      amount: advance.amount,
      date_given: advance.dateGiven,
      payment_mode: advance.paymentMode,
      notes: advance.notes,
      proof_image_url: advance.proofImageUrl || "",
    } as any);
    if (!error) await fetchAdvances();
    return error;
  }, [fetchAdvances]);

  const deleteAdvance = useCallback(async (id: string) => {
    const { error } = await supabase.from("teacher_advances" as any).delete().eq("id", id);
    if (!error) await fetchAdvances();
    return error;
  }, [fetchAdvances]);

  return { advances, loading, addAdvance, deleteAdvance, fetchAdvances };
}
