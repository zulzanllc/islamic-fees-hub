import { useState } from "react";
import { useFeeStructures } from "@/store/useStore";
import { useClasses } from "@/hooks/useClasses";
import { formatPKR } from "@/lib/currency";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const emptyForm = { classGrade: "", feeType: "tuition" as "tuition" | "registration", amount: 0 };

export default function FeeStructurePage() {
  const { fees, addFee, updateFee, deleteFee } = useFeeStructures();
  const { classNames } = useClasses();
  const { permissions } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const handleSubmit = () => {
    if (!form.classGrade || form.amount <= 0) return;
    if (editingId) {
      updateFee(editingId, form);
    } else {
      addFee(form);
    }
    setForm(emptyForm);
    setEditingId(null);
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fee Structure</h1>
          <p className="text-sm text-muted-foreground">
            Define fees per class and type
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingId(null);
              setForm(emptyForm);
            }
          }}
        >
          {permissions.canEditStudents && (
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Fee
              </Button>
            </DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Fee" : "Add Fee"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Class/Grade *</Label>
                <Select
                  value={form.classGrade}
                  onValueChange={(v) => setForm({ ...form, classGrade: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classNames.map((g) => (
                      <SelectItem key={g} value={g}>
                        {g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fee Type *</Label>
                <Select
                  value={form.feeType}
                  onValueChange={(v: "tuition" | "registration") =>
                    setForm({ ...form, feeType: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tuition">Tuition (Monthly)</SelectItem>
                    <SelectItem value="registration">Registration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (PKR) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.amount || ""}
                  onChange={(e) =>
                    setForm({ ...form, amount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingId ? "Update" : "Add"} Fee
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class/Grade</TableHead>
                <TableHead>Fee Type</TableHead>
                <TableHead>Amount</TableHead>
                {permissions.canEditStudents && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {fees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={permissions.canEditStudents ? 4 : 3} className="text-center py-8 text-muted-foreground">
                    No fee structures defined yet.
                  </TableCell>
                </TableRow>
              ) : (
                fees.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.classGrade}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {f.feeType}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPKR(f.amount)}</TableCell>
                    {permissions.canEditStudents && (
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(f.id);
                            setForm({
                              classGrade: f.classGrade,
                              feeType: f.feeType,
                              amount: f.amount,
                            });
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteFee(f.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
