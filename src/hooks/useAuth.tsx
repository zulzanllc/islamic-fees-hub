import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface ManagerPermissions {
  canAccessStudents: boolean;
  canAccessTeachers: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  userRole: "admin" | "manager" | "user" | null;
  managerPermissions: ManagerPermissions;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [managerPermissions, setManagerPermissions] = useState<ManagerPermissions>({ canAccessStudents: true, canAccessTeachers: false });
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
          const roles = data.map((r: any) => r.role);
          setIsAdmin(roles.includes("admin"));
          if (roles.includes("admin")) setUserRole("admin");
          else if (roles.includes("manager")) setUserRole("manager");
          else setUserRole("user");
        } else if (isMounted) {
          setIsAdmin(false);
          setUserRole("user");
        }
      } catch {
        if (isMounted) {
          setIsAdmin(false);
          setUserRole("user");
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
  };

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, userRole, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
