import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserPlus, Pencil } from "lucide-react";

interface UserRole {
  id: string;
  userId: string;
  role: string;
  email?: string;
  canAccessStudents?: boolean;
  canAccessTeachers?: boolean;
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newCanStudents, setNewCanStudents] = useState(true);
  const [newCanTeachers, setNewCanTeachers] = useState(false);
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    const [rolesRes, usersRes, permsRes] = await Promise.all([
      supabase.from("user_roles").select("*"),
      supabase.functions.invoke("list-users"),
      supabase.from("manager_permissions").select("*"),
    ]);
    const emailMap: Record<string, string> = usersRes.data?.emailMap ?? {};
    const permsMap: Record<string, { s: boolean; t: boolean }> = {};
    if (permsRes.data) {
      for (const p of permsRes.data as any[]) {
        permsMap[p.user_id] = { s: p.can_access_students, t: p.can_access_teachers };
      }
    }
    if (rolesRes.data) {
      setRoles(rolesRes.data.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        role: r.role,
        email: emailMap[r.user_id] || "",
        canAccessStudents: permsMap[r.user_id]?.s ?? true,
        canAccessTeachers: permsMap[r.user_id]?.t ?? false,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleUpdateRole = async (userId: string, role: string) => {
    await supabase.from("user_roles").update({ role: role as any }).eq("user_id", userId);
    if (role === "manager") {
      await supabase.from("manager_permissions").upsert({
        user_id: userId,
        can_access_students: true,
        can_access_teachers: false,
      }, { onConflict: "user_id" });
    }
    toast.success("Role updated");
    await fetchRoles();
  };

  const handleUpdatePermission = async (userId: string, field: "can_access_students" | "can_access_teachers", value: boolean) => {
    await supabase.from("manager_permissions").upsert({
      user_id: userId,
      [field]: value,
    }, { onConflict: "user_id" });
    toast.success("Permission updated");
    await fetchRoles();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setCreating(true);
    try {
      const res = await supabase.functions.invoke("create-user", {
        body: { email: newEmail, password: newPassword, role: newRole },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || "Failed to create user");
      } else {
        const createdUserId = res.data?.user?.id;
        if (newRole === "manager" && createdUserId) {
          await supabase.from("manager_permissions").upsert({
            user_id: createdUserId,
            can_access_students: newCanStudents,
            can_access_teachers: newCanTeachers,
          }, { onConflict: "user_id" });
        }
        toast.success(`User ${newEmail} created successfully`);
        setNewEmail("");
        setNewPassword("");
        setNewRole("user");
        setNewCanStudents(true);
        setNewCanTeachers(false);
        await fetchRoles();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    }
    setCreating(false);
  };

  const openEditEmail = (userId: string, currentEmail: string) => {
    setEditUserId(userId);
    setEditEmail(currentEmail);
    setEditOpen(true);
  };

  const handleEditEmail = async () => {
    if (!editEmail) { toast.error("Enter a new email"); return; }
    setEditingEmail(true);
    try {
      const res = await supabase.functions.invoke("update-user-email", {
        body: { userId: editUserId, newEmail: editEmail },
      });
      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || "Failed to update email");
      } else {
        toast.success("Email updated successfully");
        setEditOpen(false);
        await fetchRoles();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update email");
    }
    setEditingEmail(false);
  };

  const roleBadgeVariant = (role: string) => {
    if (role === "admin") return "default" as const;
    if (role === "manager") return "secondary" as const;
    return "outline" as const;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Role Management</h1>
        <p className="text-sm text-muted-foreground">Manage user roles and permissions</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><UserPlus className="h-5 w-5" /> Add New User</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" placeholder="user@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Add User"}
              </Button>
            </div>
            {newRole === "manager" && (
              <div className="flex items-center gap-6 p-3 bg-muted rounded-md">
                <span className="text-sm font-medium text-foreground">Manager Access:</span>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={newCanStudents} onCheckedChange={(v) => setNewCanStudents(!!v)} />
                  Students
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={newCanTeachers} onCheckedChange={(v) => setNewCanTeachers(!!v)} />
                  Teachers
                </label>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">User Roles</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> : roles.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No roles found.</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Edit Email</TableHead>
                <TableHead className="text-right">Change Role</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.email || <span className="text-muted-foreground font-mono text-xs">{r.userId.slice(0, 8)}...</span>}</TableCell>
                    <TableCell><Badge variant={roleBadgeVariant(r.role)}>{r.role}</Badge></TableCell>
                    <TableCell>
                      {r.role === "manager" ? (
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 text-xs">
                            <Checkbox
                              checked={r.canAccessStudents}
                              onCheckedChange={(v) => handleUpdatePermission(r.userId, "can_access_students", !!v)}
                            />
                            Students
                          </label>
                          <label className="flex items-center gap-1.5 text-xs">
                            <Checkbox
                              checked={r.canAccessTeachers}
                              onCheckedChange={(v) => handleUpdatePermission(r.userId, "can_access_teachers", !!v)}
                            />
                            Teachers
                          </label>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{r.role === "admin" ? "Full access" : "Students only"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEditEmail(r.userId, r.email || "")} title="Edit Email">
                        <Pencil className="h-4 w-4 mr-1" /> Edit Email
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select value={r.role} onValueChange={(v) => handleUpdateRole(r.userId, v)}>
                        <SelectTrigger className="w-32 ml-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User Email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New Email</Label>
              <Input type="email" placeholder="newemail@example.com" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </div>
            <Button className="w-full" onClick={handleEditEmail} disabled={editingEmail}>
              {editingEmail ? "Updating..." : "Update Email"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle className="text-lg">Role Permissions</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
              <Badge>Admin</Badge>
              <p className="text-muted-foreground">Full access to all features: students, teachers, payments, salaries, loans, attendance, role management.</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
              <Badge variant="secondary">Manager</Badge>
              <p className="text-muted-foreground">Read-only access to assigned sections (students, teachers, or both) based on permissions set by admin.</p>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
              <Badge variant="outline">User</Badge>
              <p className="text-muted-foreground">Access to student management only. No access to teacher management features.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
