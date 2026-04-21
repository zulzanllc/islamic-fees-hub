import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  DollarSign,
  LogOut,
  GraduationCap,
  Wallet,
  HandCoins,
  Clock,
  Shield,
  Settings,
  AlertCircle,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const studentNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: Users },
  { title: "Fee Structure", url: "/fees", icon: DollarSign },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Pending Fees", url: "/pending-fees", icon: AlertCircle },
  { title: "Submit Payment", url: "/submit-payment", icon: Send, adminOnly: true },
  { title: "Receipts", url: "/receipts", icon: Receipt },
  { title: "Settings", url: "/student-settings", icon: Settings },
];

const teacherNav = [
  { title: "Dashboard", url: "/teacher-dashboard", icon: LayoutDashboard },
  { title: "Teachers", url: "/teachers", icon: GraduationCap },
  { title: "Salaries", url: "/teacher-salaries", icon: Wallet },
  { title: "Pending Salaries", url: "/pending-salaries", icon: AlertCircle },
  { title: "Loans", url: "/teacher-loans", icon: HandCoins },
  { title: "Attendance", url: "/teacher-attendance", icon: Clock },
  { title: "Settings", url: "/teacher-settings", icon: Settings },
];

const adminNav = [
  { title: "Role Management", url: "/roles", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user, permissions } = useAuth();
  const teachersOnlyAccess =
    permissions.canViewTeachers &&
    permissions.canPaySalaries &&
    !permissions.canViewStudents &&
    !permissions.canManageRoles;
  const visibleStudentNav = studentNav.filter((item) => {
    if (item.url === "/student-settings") return permissions.canEditStudents;
    if ("adminOnly" in item && item.adminOnly) return permissions.canManageRoles;
    return true;
  });
  const visibleTeacherNav = teacherNav.filter((item) => {
    if (teachersOnlyAccess) return item.url === "/pending-salaries";
    return item.url !== "/teacher-settings" || permissions.canEditSalaries;
  });

  return (
    <Sidebar collapsible="icon">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shrink-0">
          ☪
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-sidebar-foreground truncate">
              Islamic Education Center
            </h2>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              Fees Management
            </p>
          </div>
        )}
      </div>
      <SidebarContent>
        {permissions.canViewStudents && (
          <SidebarGroup>
            <SidebarGroupLabel>Students</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleStudentNav.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="h-4 w-4" /><span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {permissions.canViewTeachers && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Teachers</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleTeacherNav.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {permissions.canManageRoles && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNav.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink to={item.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                          <item.icon className="h-4 w-4" /><span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <div className="mt-auto border-t border-sidebar-border p-3">
        {!collapsed && user && (
          <p className="text-xs text-sidebar-foreground/60 truncate mb-2 px-1">
            {user.email}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && "Sign Out"}
        </Button>
      </div>
    </Sidebar>
  );
}
