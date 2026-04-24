import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TeacherBonus {
  id: string;
  teacherId: string;
  month: string;
  amount: number;
  dateGiven: string;
  paymentMode: string;
  notes: string;
  proofImageUrl: string;
}

export function useTeacherBonuses() {
  const [bonuses, setBonuses] = useState<TeacherBonus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBonuses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("teacher_bonuses" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setBonuses(
        data.map((bonus: any) => ({
          id: bonus.id,
          teacherId: bonus.teacher_id,
          month: bonus.month,
          amount: Number(bonus.amount),
          dateGiven: bonus.date_given,
          paymentMode: bonus.payment_mode,
          notes: bonus.notes,
          proofImageUrl: bonus.proof_image_url || "",
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBonuses();
  }, [fetchBonuses]);

  const addBonus = useCallback(async (bonus: Omit<TeacherBonus, "id">) => {
    const { error } = await supabase.from("teacher_bonuses" as any).insert({
      teacher_id: bonus.teacherId,
      month: bonus.month,
      amount: bonus.amount,
      date_given: bonus.dateGiven,
      payment_mode: bonus.paymentMode,
      notes: bonus.notes,
      proof_image_url: bonus.proofImageUrl || "",
    } as any);
    if (!error) await fetchBonuses();
    return error;
  }, [fetchBonuses]);

  const deleteBonus = useCallback(async (id: string) => {
    const { error } = await supabase.from("teacher_bonuses" as any).delete().eq("id", id);
    if (!error) await fetchBonuses();
    return error;
  }, [fetchBonuses]);

  return { bonuses, loading, addBonus, deleteBonus, fetchBonuses };
}
