import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon } from "lucide-react";
import { useTeacherSalarySettings } from "@/store/useTeacherStore";
import { toast } from "sonner";

export default function TeacherSettings() {
  const { settings, loading, updateSettings } = useTeacherSalarySettings();
  const [annualIncrementPercentage, setAnnualIncrementPercentage] = useState("10");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAnnualIncrementPercentage(String(settings.annualIncrementPercentage));
  }, [settings.annualIncrementPercentage]);

  const handleSave = async () => {
    const nextPercentage = Number(annualIncrementPercentage);
    if (!Number.isFinite(nextPercentage) || nextPercentage < 0) {
      toast.error("Enter a valid increment percentage");
      return;
    }

    setSaving(true);
    const error = await updateSettings({ annualIncrementPercentage: nextPercentage });
    setSaving(false);

    if (error) {
      toast.error("Failed to save teacher salary settings");
      return;
    }

    toast.success("Teacher salary settings updated");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" /> Teacher Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage teacher salary and configuration settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Salary Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label>Annual Increment Percentage</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={annualIncrementPercentage}
              onChange={(e) => setAnnualIncrementPercentage(e.target.value)}
              disabled={loading || saving}
              placeholder="e.g. 10"
            />
          </div>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
            <p>Teachers receive this increment after each completed year of service.</p>
            <p>The increased salary starts from the salary month that contains the teacher&apos;s joining anniversary.</p>
            <p>Example: joining date <strong>15 April 2026</strong> with <strong>10%</strong> increment means the higher monthly salary applies from <strong>April 2027</strong>.</p>
          </div>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
