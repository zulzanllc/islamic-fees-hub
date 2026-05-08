import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppLogEntry, AppLogSettings } from "@/lib/appLogger";
import { purgeExpiredLogs } from "@/lib/appLogger";

function mapLogRow(row: any): AppLogEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    actorUserId: row.actor_user_id ?? null,
    actorEmail: row.actor_email ?? null,
    source: row.source,
    severity: row.severity,
    action: row.action,
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    message: row.message,
    details: row.details ?? {},
    path: row.path ?? null,
  };
}

export function useAppLogs(limit = 250) {
  const [logs, setLogs] = useState<AppLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    await purgeExpiredLogs();
    const { data } = await supabase
      .from("app_logs" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    setLogs((data ?? []).map(mapLogRow));
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, fetchLogs };
}

export function useAppLogSettings() {
  const [settings, setSettings] = useState<AppLogSettings>({ retentionDays: 90 });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_log_settings" as any)
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (data) {
      setSettings({
        retentionDays: Number(data.retention_days ?? 90),
        updatedAt: data.updated_at,
        updatedBy: data.updated_by ?? null,
      });
    } else {
      setSettings({ retentionDays: 90 });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (retentionDays: number, updatedBy?: string | null) => {
    const { error } = await supabase.from("app_log_settings" as any).upsert({
      id: 1,
      retention_days: retentionDays,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    } as any);

    if (!error) {
      await fetchSettings();
      await purgeExpiredLogs(true);
    }
    return error;
  }, [fetchSettings]);

  return { settings, loading, fetchSettings, updateSettings };
}
