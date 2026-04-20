import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface UserPermissions {
  canViewStudents: boolean;
  canEditStudents: boolean;
  canViewTeachers: boolean;
  canEditTeachers: boolean;
  canManageRoles: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  userRole: "admin" | "manager" | "user" | null;
  permissions: UserPermissions;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const emptyPermissions: UserPermissions = {
  canViewStudents: false,
  canEditStudents: false,
  canViewTeachers: false,
  canEditTeachers: false,
  canManageRoles: false,
};

const permissionsFromRole = (role: "admin" | "manager" | "user" | null): UserPermissions => {
  if (role === "admin") {
    return {
      canViewStudents: true,
      canEditStudents: true,
      canViewTeachers: true,
      canEditTeachers: true,
      canManageRoles: true,
    };
  }
  if (role === "manager") {
    return {
      canViewStudents: true,
      canEditStudents: false,
      canViewTeachers: true,
      canEditTeachers: false,
      canManageRoles: false,
    };
  }
  return {
    canViewStudents: true,
    canEditStudents: true,
    canViewTeachers: false,
    canEditTeachers: false,
    canManageRoles: false,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>(emptyPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkUserRole = async (userId: string) => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .order("role");
        if (isMounted && data && data.length > 0) {
          const roles = data.map((r) => r.role);
          const nextRole = roles.includes("admin") ? "admin" : roles.includes("manager") ? "manager" : "user";
          const nextIsAdmin = roles.includes("admin");
          setIsAdmin(nextIsAdmin);
          setUserRole(nextRole);

          const { data: permissionData } = await supabase
            .from("user_permissions")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

          if (!isMounted) return;
          if (nextIsAdmin) {
            setPermissions(permissionsFromRole("admin"));
          } else if (permissionData) {
            setPermissions({
              canViewStudents: permissionData.can_view_students,
              canEditStudents: permissionData.can_edit_students,
              canViewTeachers: permissionData.can_view_teachers,
              canEditTeachers: permissionData.can_edit_teachers,
              canManageRoles: permissionData.can_manage_roles,
            });
          } else {
            setPermissions(permissionsFromRole(nextRole));
          }
        } else if (isMounted) {
          setIsAdmin(false);
          setUserRole("user");
          setPermissions(permissionsFromRole("user"));
        }
      } catch {
        if (isMounted) {
          setIsAdmin(false);
          setUserRole("user");
          setPermissions(permissionsFromRole("user"));
        }
      }
    };

    // Listener for ONGOING auth changes (does NOT control isLoading)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => checkUserRole(session.user.id), 0);
        } else {
          setIsAdmin(false);
          setUserRole(null);
          setPermissions(emptyPermissions);
        }
      }
    );

    // INITIAL load (controls isLoading)
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await checkUserRole(session.user.id);
        } else {
          setUserRole(null);
          setPermissions(emptyPermissions);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };



  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setUserRole(null);
    setPermissions(emptyPermissions);
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, userRole, permissions, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
