import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { purgeExpiredLogs, writeAppLog } from "@/lib/appLogger";

export function ActivityMonitor() {
  const location = useLocation();
  const { user, session } = useAuth();
  const lastPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session) return;
    purgeExpiredLogs();
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const nextPath = `${location.pathname}${location.search}`;
    if (lastPathRef.current === nextPath) return;

    lastPathRef.current = nextPath;
    void writeAppLog({
      source: "navigation",
      action: "route_view",
      entityType: "route",
      entityId: location.pathname,
      message: `Visited ${location.pathname}`,
      details: {
        pathname: location.pathname,
        search: location.search,
      },
      actorEmail: user?.email ?? null,
      path: nextPath,
    });
  }, [location.pathname, location.search, session, user?.email]);

  useEffect(() => {
    if (!session) return;

    const handleError = (event: ErrorEvent) => {
      void writeAppLog({
        source: "error",
        severity: "error",
        action: "window_error",
        entityType: "client",
        message: event.message || "Unhandled window error",
        details: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        actorEmail: user?.email ?? null,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason =
        typeof event.reason === "string"
          ? event.reason
          : event.reason?.message || "Unhandled promise rejection";

      void writeAppLog({
        source: "error",
        severity: "error",
        action: "unhandled_rejection",
        entityType: "client",
        message: reason,
        details: {
          reason,
        },
        actorEmail: user?.email ?? null,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [session, user?.email]);

  return null;
}
