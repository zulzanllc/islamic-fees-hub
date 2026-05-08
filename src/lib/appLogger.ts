import { supabase } from "@/integrations/supabase/client";

export type AppLogSeverity = "info" | "warning" | "error";
export type AppLogSource = "user" | "system" | "auth" | "navigation" | "error" | "admin";

export interface AppLogEntry {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorEmail: string | null;
  source: AppLogSource;
  severity: AppLogSeverity;
  action: string;
  entityType: string | null;
  entityId: string | null;
  message: string;
  details: Record<string, unknown>;
  path: string | null;
}

export interface AppLogSettings {
  retentionDays: number;
  updatedAt?: string;
  updatedBy?: string | null;
}

export interface WriteAppLogInput {
  source?: AppLogSource;
  severity?: AppLogSeverity;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  message: string;
  details?: Record<string, unknown>;
  actorEmail?: string | null;
  path?: string | null;
}

let cleanupPromise: Promise<void> | null = null;
let lastCleanupAt = 0;

function getCurrentPath() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}`;
}

function sanitizeDetails(details?: Record<string, unknown>) {
  if (!details) return {};

  try {
    return JSON.parse(
      JSON.stringify(details, (_key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }
        return value;
      })
    ) as Record<string, unknown>;
  } catch {
    return { note: "Unable to serialize log details safely." };
  }
}

export async function writeAppLog(input: WriteAppLogInput) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    await supabase.from("app_logs" as any).insert({
      actor_user_id: user?.id ?? null,
      actor_email: input.actorEmail ?? user?.email ?? null,
      source: input.source ?? "user",
      severity: input.severity ?? "info",
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      message: input.message,
      details: sanitizeDetails(input.details),
      path: input.path ?? getCurrentPath(),
    } as any);
  } catch {
    // Logging should never interrupt the main user action.
  }
}

export async function purgeExpiredLogs(force = false) {
  const now = Date.now();
  if (!force && now - lastCleanupAt < 5 * 60 * 1000) {
    return cleanupPromise ?? Promise.resolve();
  }

  if (cleanupPromise) return cleanupPromise;

  cleanupPromise = (async () => {
    try {
      await supabase.from("app_logs" as any).delete().lt("created_at", new Date().toISOString());
      lastCleanupAt = Date.now();
    } catch {
      // Ignore cleanup failures silently.
    } finally {
      cleanupPromise = null;
    }
  })();

  return cleanupPromise;
}
