import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { writeAppLog } from "@/lib/appLogger";

export interface ClassItem {
  id: string;
  name: string;
  sortOrder: number;
}

export function useClasses() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("classes")
      .select("*")
      .order("sort_order", { ascending: true });
    if (data) {
      setClasses(
        data.map((c: any) => ({
          id: c.id,
          name: c.name,
          sortOrder: c.sort_order,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const addClass = useCallback(async (name: string) => {
    const maxOrder = classes.length > 0 ? Math.max(...classes.map((c) => c.sortOrder)) : 0;
    const { error } = await supabase.from("classes").insert({
      name: name.trim(),
      sort_order: maxOrder + 1,
    });
    if (error) return error.message;
    await writeAppLog({
      action: "class_created",
      entityType: "class",
      message: `Created class ${name.trim()}`,
      details: { name: name.trim() },
    });
    await fetchClasses();
    return null;
  }, [classes, fetchClasses]);

  const deleteClass = useCallback(async (id: string) => {
    const { error } = await supabase.from("classes").delete().eq("id", id);
    if (error) return error.message;
    await writeAppLog({
      action: "class_deleted",
      entityType: "class",
      entityId: id,
      message: `Deleted class ${id}`,
    });
    await fetchClasses();
    return null;
  }, [fetchClasses]);

  const updateClass = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from("classes").update({ name: name.trim() }).eq("id", id);
    if (error) return error.message;
    await writeAppLog({
      action: "class_updated",
      entityType: "class",
      entityId: id,
      message: `Updated class ${id}`,
      details: { name: name.trim() },
    });
    await fetchClasses();
    return null;
  }, [fetchClasses]);

  // Helper: just the names for dropdowns
  const classNames = classes.map((c) => c.name);

  return { classes, classNames, loading, addClass, deleteClass, updateClass, fetchClasses };
}
