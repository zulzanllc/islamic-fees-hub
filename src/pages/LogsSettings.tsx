import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { FileClock, RefreshCw, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAppLogs, useAppLogSettings } from "@/hooks/useAppLogs";
import { useAuth } from "@/hooks/useAuth";
import { writeAppLog } from "@/lib/appLogger";
import { toast } from "sonner";

export default function LogsSettings() {
  const { logs, loading, fetchLogs } = useAppLogs();
  const { settings, loading: settingsLoading, updateSettings } = useAppLogSettings();
  const { user } = useAuth();
  const [retentionDays, setRetentionDays] = useState(String(settings.retentionDays));
  const [saving, setSaving] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setRetentionDays(String(settings.retentionDays));
  }, [settings.retentionDays]);

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (sourceFilter !== "all" && log.source !== sourceFilter) return false;
      if (severityFilter !== "all" && log.severity !== severityFilter) return false;
      if (!query) return true;
      return (
        log.message.toLowerCase().includes(query) ||
        (log.actorEmail ?? "").toLowerCase().includes(query) ||
        (log.entityType ?? "").toLowerCase().includes(query) ||
        (log.action ?? "").toLowerCase().includes(query)
      );
    });
  }, [logs, search, severityFilter, sourceFilter]);

  const handleSave = async () => {
    const nextRetention = Number(retentionDays);
    if (!Number.isFinite(nextRetention) || nextRetention < 1) {
      toast.error("Retention days must be at least 1");
      return;
    }

    setSaving(true);
    const error = await updateSettings(nextRetention, user?.id ?? null);
    setSaving(false);

    if (error) {
      toast.error("Failed to update log settings");
      return;
    }

    await writeAppLog({
      source: "admin",
      action: "log_settings_updated",
      entityType: "app_log_settings",
      entityId: "1",
      message: `Updated log retention to ${nextRetention} days`,
      details: { retentionDays: nextRetention },
    });
    toast.success("Log retention updated");
    fetchLogs();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileClock className="h-6 w-6" /> Logs Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Review audit logs and control how long they stay in the system.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchLogs()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-2">
            <Label>Retention Days</Label>
            <Input
              type="number"
              min={1}
              value={retentionDays}
              onChange={(event) => setRetentionDays(event.target.value)}
              disabled={settingsLoading || saving}
            />
            <p className="text-sm text-muted-foreground">
              Logs older than this will be cleared automatically during app activity.
            </p>
          </div>
          <Button onClick={handleSave} disabled={settingsLoading || saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Activity Log</CardTitle>
          <div className="flex flex-wrap gap-3 mt-3">
            <Input
              className="max-w-xs"
              placeholder="Search message, email, action..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="auth">Auth</SelectItem>
                <SelectItem value="navigation">Navigation</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading logs...</p>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No logs found.</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                      </TableCell>
                      <TableCell>{log.actorEmail || "System"}</TableCell>
                      <TableCell className="capitalize">{log.source}</TableCell>
                      <TableCell className="font-medium">{log.action}</TableCell>
                      <TableCell>
                        {log.entityType ? `${log.entityType}${log.entityId ? ` (${log.entityId})` : ""}` : "—"}
                      </TableCell>
                      <TableCell className="min-w-[320px]">{log.message}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.severity === "error"
                              ? "destructive"
                              : log.severity === "warning"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {log.severity}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
