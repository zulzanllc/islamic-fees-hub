import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DashboardDateFilterValue } from "@/lib/dashboardDateRange";

interface DashboardDateFilterProps {
  value: DashboardDateFilterValue;
  onChange: (value: DashboardDateFilterValue) => void;
}

export function DashboardDateFilter({ value, onChange }: DashboardDateFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Filter</Label>
        <Select value={value.mode} onValueChange={(mode) => onChange({ ...value, mode: mode as DashboardDateFilterValue["mode"] })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="year">Yearly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.mode === "year" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Year</Label>
          <Input
            type="number"
            min={2000}
            max={2100}
            value={value.year}
            onChange={(event) => onChange({ ...value, year: event.target.value })}
            className="w-[120px]"
          />
        </div>
      )}

      {value.mode === "month" && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Month</Label>
          <Input
            type="month"
            value={value.month}
            onChange={(event) => onChange({ ...value, month: event.target.value })}
            className="w-[170px]"
          />
        </div>
      )}

      {value.mode === "custom" && (
        <>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={value.startDate}
              onChange={(event) => onChange({ ...value, startDate: event.target.value })}
              className="w-[155px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={value.endDate}
              onChange={(event) => onChange({ ...value, endDate: event.target.value })}
              className="w-[155px]"
            />
          </div>
        </>
      )}
    </div>
  );
}
