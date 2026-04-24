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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { KeyRound, Pencil, Trash2, UserPlus } from "lucide-react";

type AppRole = "admin" | "manager" | "user";
type AccessLevel = "admin" | "both_edit" | "both_view" | "students_only" | "teachers_only";

interface UserRole {
  id: string;
  userId: string;
  role: AppRole;
  email?: string;
  accessLevel: AccessLevel;
}

type RoleRow = {
  id: string;
  user_id: string;
  role: AppRole;
};

type AuthUser = {
  id: string;
  email: string;
};

type PermissionRow = {
  user_id: string;
  can_view_students: boolean;
  can_edit_students: boolean;
  can_edit_fees: boolean;
  can_view_teachers: boolean;
  can_edit_teachers: boolean;
  can_edit_salaries: boolean;
  can_manage_roles: boolean;
};

const accessOptions: Array<{ value: AccessLevel; label: string; description: string }> = [
  {
    value: "admin",
    label: "Admin",
    description: "Full access to everything, including role management.",
  },
  {
    value: "both_edit",
    label: "Edit teachers and students",
    description: "Can view and edit records for both sections.",
  },
  {
    value: "both_view",
    label: "View teachers and students",
    description: "Can view both sections without editing records.",
  },
  {
    value: "students_only",
    label: "Students only",
    description: "Can manage student records and collect fees, but cannot edit fee structures or collected payments.",
  },
  {
    value: "teachers_only",
    label: "Teachers only",
    description: "Can only view Pending Salaries and pay pending salaries. Cannot edit salary records.",
  },
];

const accessFromPermissions = (permissions?: PermissionRow): AccessLevel => {
  if (!permissions) return "students_only";
  if (
    permissions.can_view_students &&
    permissions.can_edit_students &&
    permissions.can_edit_fees &&
    permissions.can_view_teachers &&
    permissions.can_edit_teachers &&
    permissions.can_edit_salaries &&
    permissions.can_manage_roles
  ) {
    return "admin";
  }
  if (
    permissions.can_view_students &&
    permissions.can_edit_students &&
    permissions.can_edit_fees &&
    permissions.can_view_teachers &&
    permissions.can_edit_teachers &&
    permissions.can_edit_salaries
  ) {
    return "both_edit";
  }
  if (
    permissions.can_view_students &&
    !permissions.can_edit_students &&
    permissions.can_view_teachers &&
    !permissions.can_edit_teachers
  ) {
    return "both_view";
  }
  if (permissions.can_view_teachers && !permissions.can_view_students) return "teachers_only";
  return "students_only";
};

export default function RoleManagement() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newAccessLevel, setNewAccessLevel] = useState<AccessLevel>("students_only");
  const [creating, setCreating] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingEmailUser, setEditingEmailUser] = useState<UserRole | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [editingPasswordUser, setEditingPasswordUser] = useState<UserRole | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [confirmEditPassword, setConfirmEditPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const isAccessLevel = (value: string): value is AccessLevel =>
    value === "admin" || value === "both_edit" || value === "both_view" || value === "students_only" || value === "teachers_only";

  const fetchAuthUsers = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      throw new Error(body?.error || `Could not load user emails (${response.status})`);
    }

    return (body?.users ?? []) as AuthUser[];
  };

  const createUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        accessLevel: newAccessLevel,
      }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      throw new Error(body?.error || `Failed to create user (${response.status})`);
    }

    return body;
  };

  const deleteUser = async (userId: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      throw new Error(body?.error || `Failed to delete user (${response.status})`);
    }
  };

  const updateUserEmail = async (userId: string, email: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, email }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      throw new Error(body?.error || `Failed to update email (${response.status})`);
    }

    return body;
  };

  const updateUserPassword = async (userId: string, password: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, password }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      throw new Error(body?.error || `Failed to update password (${response.status})`);
    }

    return body;
  };

  const updateUserAccess = async (userId: string, accessLevel: AccessLevel) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-access`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, accessLevel }),
    });

    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error) {
      throw new Error(body?.error || `Failed to update access (${response.status})`);
    }

    return body;
  };

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("user_roles").select("*");
    if (data) {
      let usersById = new Map<string, string>();
      try {
        const users = await fetchAuthUsers();
        usersById = new Map(
          users.map((user) => [user.id, user.email])
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load user emails";
        toast.error(message);
      }

      const { data: permissionsData } = await supabase
        .from("user_permissions")
        .select("user_id, can_view_students, can_edit_students, can_edit_fees, can_view_teachers, can_edit_teachers, can_edit_salaries, can_manage_roles");
      const permissionsById = new Map(
        (permissionsData ?? []).map((permission) => [permission.user_id, permission as PermissionRow])
      );

      setRoles(
        (data as RoleRow[]).map((r) => ({
          id: r.id,
          userId: r.user_id,
          role: r.role,
          email: usersById.get(r.user_id),
          accessLevel: r.role === "admin" ? "admin" : accessFromPermissions(permissionsById.get(r.user_id)),
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const handleUpdateAccess = async (userId: string, accessLevel: string) => {
    if (!isAccessLevel(accessLevel)) return;
    const previousRoles = roles;
    setRoles((current) => current.map((role) => role.userId === userId ? { ...role, accessLevel } : role));

    try {
      await updateUserAccess(userId, accessLevel);
      toast.success("Access updated");
      await fetchRoles();
    } catch (err) {
      setRoles(previousRoles);
      const message =
        err instanceof Error && err.message === "Failed to fetch"
          ? "Could not reach the update-user-access Edge Function. Deploy update-user-access in Supabase and disable Verify JWT."
          : err instanceof Error
            ? err.message
            : "Failed to update access";
      toast.error(message);
      await fetchRoles();
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) return;
    setCreating(true);
    try {
      await createUser();
      toast.success(`User ${newEmail} created successfully`);
      setNewEmail("");
      setNewPassword("");
      setNewAccessLevel("students_only");
      await fetchRoles();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      toast.error(message);
    }
    setCreating(false);
  };

  const handleDeleteUser = async (userId: string, email?: string) => {
    setDeletingUserId(userId);
    try {
      await deleteUser(userId);
      toast.success(`User ${email || userId.slice(0, 8)} deleted`);
      await fetchRoles();
    } catch (err) {
      const message =
        err instanceof Error && err.message === "Failed to fetch"
          ? "Could not reach the delete-user Edge Function. Deploy delete-user in Supabase and disable Verify JWT."
          : err instanceof Error
            ? err.message
            : "Failed to delete user";
      toast.error(message);
    } finally {
      setDeletingUserId(null);
    }
  };

  const openEditEmail = (role: UserRole) => {
    setEditingEmailUser(role);
    setEditEmail(role.email ?? "");
  };

  const openEditPassword = (role: UserRole) => {
    setEditingPasswordUser(role);
    setEditPassword("");
    setConfirmEditPassword("");
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmailUser || !editEmail.trim()) return;

    setUpdatingEmail(true);
    try {
      await updateUserEmail(editingEmailUser.userId, editEmail.trim());
      toast.success("Email updated");
      setEditingEmailUser(null);
      setEditEmail("");
      await fetchRoles();
    } catch (err) {
      const message =
        err instanceof Error && err.message === "Failed to fetch"
          ? "Could not reach the update-user-email Edge Function. Deploy update-user-email in Supabase and disable Verify JWT."
          : err instanceof Error
            ? err.message
            : "Failed to update email";
      toast.error(message);
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPasswordUser) return;

    if (editPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (editPassword !== confirmEditPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setUpdatingPassword(true);
    try {
      await updateUserPassword(editingPasswordUser.userId, editPassword);
      toast.success("Password updated");
      setEditingPasswordUser(null);
      setEditPassword("");
      setConfirmEditPassword("");
    } catch (err) {
      const message =
        err instanceof Error && err.message === "Failed to fetch"
          ? "Could not reach the update-user-password Edge Function. Deploy update-user-password in Supabase and disable Verify JWT."
          : err instanceof Error
            ? err.message
            : "Failed to update password";
      toast.error(message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const getAccessPermissions = (accessLevel: AccessLevel) => {
    switch (accessLevel) {
      case "admin":
        return {
          can_view_students: true,
          can_edit_students: true,
          can_edit_fees: true,
          can_view_teachers: true,
          can_edit_teachers: true,
          can_edit_salaries: true,
        };
      case "both_edit":
        return {
          can_view_students: true,
          can_edit_students: true,
          can_edit_fees: true,
          can_view_teachers: true,
          can_edit_teachers: true,
          can_edit_salaries: true,
        };
      case "both_view":
        return {
          can_view_students: true,
          can_edit_students: false,
          can_edit_fees: false,
          can_view_teachers: true,
          can_edit_teachers: false,
          can_edit_salaries: false,
        };
      case "teachers_only":
        return {
          can_view_students: false,
          can_edit_students: false,
          can_edit_fees: false,
          can_view_teachers: true,
          can_edit_teachers: true,
          can_edit_salaries: false,
        };
      default:
        return {
          can_view_students: true,
          can_edit_students: true,
          can_edit_fees: false,
          can_view_teachers: false,
          can_edit_teachers: false,
          can_edit_salaries: false,
        };
    }
  };

  const getAccessLabel = (accessLevel: AccessLevel) => {
    return accessOptions.find((option) => option.value === accessLevel)?.label ?? "Students only";
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
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="user@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label>Access</Label>
              <Select value={newAccessLevel} onValueChange={(value) => isAccessLevel(value) && setNewAccessLevel(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accessOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {accessOptions.find((option) => option.value === newAccessLevel)?.description}
              </p>
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Add User"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">User Roles</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground text-center py-8">Loading...</p> : roles.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No roles found.</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Current Access</TableHead><TableHead className="text-right">Change Access</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{r.email || "Email unavailable"}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditEmail(r)}
                          title="Edit email"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{r.userId.slice(0, 8)}...</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.accessLevel === "both_view" ? "secondary" : "default"}>
                        {getAccessLabel(r.accessLevel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Select value={r.accessLevel} onValueChange={(v) => handleUpdateAccess(r.userId, v)}>
                        <SelectTrigger className="w-64 ml-auto"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {accessOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditPassword(r)}
                        title="Change password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={deletingUserId === r.userId}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete {r.email || "this user"} and remove their login access. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(r.userId, r.email)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Access Options</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {accessOptions.map((option) => (
              <div key={option.value} className="flex items-start gap-3 p-3 bg-muted rounded-md">
                <Badge variant={option.value === "both_view" ? "secondary" : "default"}>{option.label}</Badge>
                <p className="text-muted-foreground">{option.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editingEmailUser)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEmailUser(null);
            setEditEmail("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Email</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
              {editingEmailUser && (
                <p className="text-xs text-muted-foreground">
                  User ID: {editingEmailUser.userId}
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={updatingEmail}>
              {updatingEmail ? "Updating..." : "Update Email"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingPasswordUser)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingPasswordUser(null);
            setEditPassword("");
            setConfirmEditPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>User</Label>
              <Input value={editingPasswordUser?.email ?? editingPasswordUser?.userId ?? ""} readOnly className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmEditPassword}
                onChange={(e) => setConfirmEditPassword(e.target.value)}
                placeholder="Re-enter password"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updatingPassword}>
              {updatingPassword ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
