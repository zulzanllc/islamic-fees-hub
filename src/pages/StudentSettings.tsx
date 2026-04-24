import { useState } from "react";
import { useStudents } from "@/store/useStore";
import { useClasses } from "@/hooks/useClasses";
import { formatPKR } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, TrendingUp, Plus, Trash2, GraduationCap, Pencil } from "lucide-react";

export default function Settings() {
  const { students, updateStudent } = useStudents();
  const { classes, classNames, addClass, deleteClass, updateClass } = useClasses();
  const [increaseType, setIncreaseType] = useState<"percentage" | "fixed">("percentage");
  const [increaseValue, setIncreaseValue] = useState("");
  const [effectiveMonth, setEffectiveMonth] = useState("");
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editClassName, setEditClassName] = useState("");

  const studentsWithFees = students.filter((student) => student.monthlyFee > 0);

  const toggleClass = (grade: string) => {
    setSelectedClasses((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  const getNewAmount = (currentAmount: number) => {
    const val = parseFloat(increaseValue) || 0;
    if (increaseType === "percentage") {
      return Math.round(currentAmount + currentAmount * (val / 100));
    }
    return currentAmount + val;
  };

  const affectedStudents = studentsWithFees.filter((student) => {
    if (scope === "all") return true;
    return selectedClasses.includes(student.classGrade);
  });

  const handleApply = async () => {
    const val = parseFloat(increaseValue);
    if (!val || val <= 0) {
      toast({ title: "Invalid value", description: "Please enter a valid increase amount.", variant: "destructive" });
      return;
    }
    if (!effectiveMonth) {
      toast({ title: "Select month", description: "Please select the effective month.", variant: "destructive" });
      return;
    }
    if (scope === "selected" && selectedClasses.length === 0) {
      toast({ title: "No classes selected", description: "Please select at least one class.", variant: "destructive" });
      return;
    }

    for (const student of affectedStudents) {
      const newAmount = getNewAmount(student.monthlyFee);
      await updateStudent(student.id, { monthlyFee: newAmount });
    }

    toast({
      title: "Fees updated",
      description: `${affectedStudents.length} student fee(s) increased effective from ${effectiveMonth}.`,
    });
    setIncreaseValue("");
    setEffectiveMonth("");
    setSelectedClasses([]);
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) return;
    const error = await addClass(newClassName);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Class added", description: `"${newClassName.trim()}" added successfully.` });
      setNewClassName("");
    }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    if (!window.confirm(`Delete class "${name}"? Students in this class won't be affected.`)) return;
    const error = await deleteClass(id);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Class deleted", description: `"${name}" removed.` });
    }
  };

  const handleUpdateClass = async (id: string) => {
    if (!editClassName.trim()) return;
    const error = await updateClass(id, editClassName);
    if (error) {
      toast({ title: "Error", description: error, variant: "destructive" });
    } else {
      toast({ title: "Class updated" });
      setEditingClassId(null);
      setEditClassName("");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6" /> Student Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage classes and fee increases
        </p>
      </div>

      {/* Class Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Class Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. Grade 11 or Nazra Program"
              onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
            />
            <Button onClick={handleAddClass} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Class Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                    No classes added yet.
                  </TableCell>
                </TableRow>
              ) : (
                classes.map((c, i) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      {editingClassId === c.id ? (
                        <div className="flex gap-2">
                          <Input
                            value={editClassName}
                            onChange={(e) => setEditClassName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateClass(c.id)}
                            className="h-8"
                          />
                          <Button size="sm" variant="outline" onClick={() => handleUpdateClass(c.id)}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingClassId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <span className="font-medium">{c.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => { setEditingClassId(c.id); setEditClassName(c.name); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteClass(c.id, c.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bulk Fee Increase */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Bulk Fee Increase
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Increase Type</Label>
              <Select value={increaseType} onValueChange={(v) => setIncreaseType(v as "percentage" | "fixed")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (PKR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{increaseType === "percentage" ? "Percentage (%)" : "Amount (PKR)"}</Label>
              <Input
                type="number"
                min={0}
                value={increaseValue}
                onChange={(e) => setIncreaseValue(e.target.value)}
                placeholder={increaseType === "percentage" ? "e.g. 10" : "e.g. 500"}
              />
            </div>
            <div>
              <Label>Effective From Month</Label>
              <Input
                type="month"
                value={effectiveMonth}
                onChange={(e) => setEffectiveMonth(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Apply To</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "all" | "selected")}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                <SelectItem value="selected">Select Specific Classes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "selected" && (
            <div className="flex flex-wrap gap-3">
              {classNames.map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedClasses.includes(g)}
                    onCheckedChange={() => toggleClass(g)}
                  />
                  {g}
                </label>
              ))}
            </div>
          )}

          {increaseValue && parseFloat(increaseValue) > 0 && affectedStudents.length > 0 && (
            <div>
              <Label className="mb-2 block">Preview</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Current Fee</TableHead>
                    <TableHead>New Fee</TableHead>
                    <TableHead>Increase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {affectedStudents.map((student) => {
                    const newAmt = getNewAmount(student.monthlyFee);
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>{student.classGrade}</TableCell>
                        <TableCell>{formatPKR(student.monthlyFee)}</TableCell>
                        <TableCell className="font-semibold text-primary">{formatPKR(newAmt)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">+{formatPKR(newAmt - student.monthlyFee)}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <Button onClick={handleApply} disabled={affectedStudents.length === 0}>
            Apply Fee Increase
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
