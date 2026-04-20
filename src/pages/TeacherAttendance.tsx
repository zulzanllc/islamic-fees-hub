import { useState } from "react";
import { useTeachers, useTeacherAttendance } from "@/store/useTeacherStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function TeacherAttendance() {
  const { teachers } = useTeachers();
  const { attendance, loading, addAttendance, updateAttendance } = useTeacherAttendance();
  const { permissions } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ teacherId: "", date: format(new Date(), "yyyy-MM-dd"), timeIn: "", timeOut: "", notes: "" });

  const handleSubmit = async () => {
    if (!form.teacherId) { toast.error("Select a teacher"); return; }
    await addAttendance({
      teacherId: form.teacherId, date: form.date,
      timeIn: form.timeIn || null, timeOut: form.timeOut || null, notes: form.notes,
    });
    toast.success("Attendance recorded");
    setOpen(false);
    setForm({ teacherId: "", date: format(new Date(), "yyyy-MM-dd"), timeIn: "", timeOut: "", notes: "" });
  };

  const getTeacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teacher Attendance</h1>
          <p className="text-sm text-muted-foreground">Record daily in/out timings</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {permissions.canEditTeachers && (
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record Attendance</Button></DialogTrigger>
          )}
          <DialogContent>
            <DialogHeader><DialogTitle>Record Attendance</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Teacher</Label>
                <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>{teachers.filter((t) => t.status === "active").map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Time In</Label><Input type="time" value={form.timeIn} onChange={(e) => setForm({ ...form, timeIn: e.target.value })} /></div>
              <div><Label>Time Out</Label><Input type="time" value={form.timeOut} onChange={(e) => setForm({ ...form, timeOut: e.target.value })} /></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <Button className="w-full" onClick={handleSubmit}>Save Attendance</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Attendance Log</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> : attendance.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No attendance recorded.</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Teacher</TableHead><TableHead>Date</TableHead><TableHead>Time In</TableHead><TableHead>Time Out</TableHead><TableHead>Notes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {attendance.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{getTeacherName(a.teacherId)}</TableCell>
                    <TableCell>{a.date}</TableCell>
                    <TableCell>{a.timeIn ?? "—"}</TableCell>
                    <TableCell>{a.timeOut ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{a.notes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
