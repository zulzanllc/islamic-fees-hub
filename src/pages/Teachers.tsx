import { useState } from "react";
import { useTeachers } from "@/store/useTeacherStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Teacher } from "@/types";
import { formatPKR } from "@/lib/currency";
import { useAuth } from "@/hooks/useAuth";
import { downloadCSV } from "@/lib/exportCsv";
import TeacherCsvImport from "@/components/TeacherCsvImport";

const emptyForm: Omit<Teacher, "id"> = { name: "", contact: "", cnic: "", joiningDate: new Date().toISOString().slice(0, 10), status: "active", monthlySalary: 0 };

export default function Teachers() {
  const navigate = useNavigate();
  const { teachers, loading, addTeacher, bulkAddTeachers, updateTeacher, deleteTeacher } = useTeachers();
  const { permissions } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const handleSubmit = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    if (editId) {
      await updateTeacher(editId, form);
      toast.success("Teacher updated");
    } else {
      await addTeacher(form);
      toast.success("Teacher added");
    }
    setForm(emptyForm);
    setEditId(null);
    setOpen(false);
  };

  const startEdit = (t: Teacher) => {
    setForm({ name: t.name, contact: t.contact, cnic: t.cnic, joiningDate: t.joiningDate, status: t.status as "active" | "inactive", monthlySalary: t.monthlySalary });
    setEditId(t.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deleteTeacher(id);
    toast.success("Teacher deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teachers</h1>
          <p className="text-sm text-muted-foreground">Manage teaching staff</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            const q = searchQuery.toLowerCase();
            const filtered = teachers.filter((teacher) =>
              (filterStatus === "all" || teacher.status === filterStatus) &&
              (!q || teacher.name.toLowerCase().includes(q) || teacher.contact.toLowerCase().includes(q) || teacher.cnic.toLowerCase().includes(q))
            );
            const headers = ["Name", "Contact", "CNIC", "Base Salary", "Joining Date", "Status"];
            const rows = filtered.map((teacher) => [teacher.name, teacher.contact, teacher.cnic, String(teacher.monthlySalary), teacher.joiningDate, teacher.status]);
            downloadCSV("teachers.csv", headers, rows);
            toast.success(`Exported ${filtered.length} teachers`);
          }}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          {permissions.canEditTeachers && (
            <TeacherCsvImport onImport={async (csvTeachers) => {
              const existingCnics = new Set(teachers.map((teacher) => teacher.cnic.trim().toLowerCase()).filter(Boolean));
              const seenCnics = new Set<string>();
              const newTeachers = csvTeachers.filter((teacher) => {
                const cnic = teacher.cnic.trim().toLowerCase();
                if (!cnic) return true;
                if (existingCnics.has(cnic) || seenCnics.has(cnic)) return false;
                seenCnics.add(cnic);
                return true;
              });
              if (newTeachers.length === 0) {
                toast.info("No new teachers to import");
                return null;
              }
              if (newTeachers.length < csvTeachers.length) {
                toast.info(`${csvTeachers.length - newTeachers.length} duplicate(s) skipped`);
              }
              return bulkAddTeachers(newTeachers);
            }} />
          )}
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setForm(emptyForm); setEditId(null); } }}>
            {permissions.canEditTeachers && (
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Teacher</Button>
              </DialogTrigger>
            )}
            <DialogContent>
              <DialogHeader><DialogTitle>{editId ? "Edit" : "Add"} Teacher</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Contact</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
                <div><Label>CNIC</Label><Input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} /></div>
                <div><Label>Base Monthly Salary</Label><Input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })} /></div>
                <div><Label>Joining Date</Label><Input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v: string) => setForm({ ...form, status: v as "active" | "inactive" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={handleSubmit}>{editId ? "Update" : "Add"} Teacher</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Teachers</CardTitle>
          <div className="flex flex-wrap gap-3 mt-3">
            <Input placeholder="Search by name, contact, CNIC..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-[250px]" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterStatus !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setFilterStatus("all"); }}>Clear</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> : (() => {
            const q = searchQuery.toLowerCase();
            const filtered = teachers.filter((t) =>
              (filterStatus === "all" || t.status === filterStatus) &&
              (!q || t.name.toLowerCase().includes(q) || t.contact.toLowerCase().includes(q) || t.cnic.toLowerCase().includes(q))
            );
            return filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No teachers found.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>CNIC</TableHead><TableHead>Joining Date</TableHead><TableHead>Base Salary</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.contact}</TableCell>
                      <TableCell>{t.cnic}</TableCell>
                      <TableCell>{t.joiningDate}</TableCell>
                      <TableCell>{formatPKR(t.monthlySalary)}</TableCell>
                      <TableCell><Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => navigate(`/teachers/${t.id}`)}><Eye className="h-4 w-4" /></Button>
                        {permissions.canEditTeachers && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => startEdit(t)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
