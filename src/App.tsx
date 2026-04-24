import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import StudentDetail from "@/pages/StudentDetail";
import Payments from "@/pages/Payments";
import Receipts from "@/pages/Receipts";
import Teachers from "@/pages/Teachers";
import TeacherSalaries from "@/pages/TeacherSalaries";
import TeacherLoans from "@/pages/TeacherLoans";
import TeacherAttendance from "@/pages/TeacherAttendance";
import TeacherDashboard from "@/pages/TeacherDashboard";
import TeacherDetail from "@/pages/TeacherDetail";
import RoleManagement from "@/pages/RoleManagement";
import StudentSettings from "@/pages/StudentSettings";
import StudentLeaving from "@/pages/StudentLeaving";
import PendingFees from "@/pages/PendingFees";
import SubmitPayment from "@/pages/SubmitPayment";
import TeacherSettings from "@/pages/TeacherSettings";
import PendingSalaries from "@/pages/PendingSalaries";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, userRole, permissions, loading } = useAuth();
  const teachersOnlyAccess =
    permissions.canViewTeachers &&
    permissions.canPaySalaries &&
    !permissions.canViewStudents &&
    !permissions.canManageRoles;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route
          path="/"
          element={
            permissions.canViewStudents ? (
              <Dashboard />
            ) : permissions.canViewTeachers ? (
              <Navigate to={teachersOnlyAccess ? "/pending-salaries" : "/teacher-dashboard"} replace />
            ) : (
              <NotFound />
            )
          }
        />

        {permissions.canViewStudents && (
          <>
            <Route path="/pending-fees" element={<PendingFees />} />
            <Route path="/students" element={<Students />} />
            <Route path="/students/:id" element={<StudentDetail />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/receipts" element={<Receipts />} />
            <Route path="/submit-payment" element={<SubmitPayment />} />
            {permissions.canEditStudents && <Route path="/student-leaving" element={<StudentLeaving />} />}
            {permissions.canEditStudents && <Route path="/student-settings" element={<StudentSettings />} />}
          </>
        )}

        {permissions.canViewTeachers && (
          <>
            <Route path="/pending-salaries" element={<PendingSalaries />} />
            {!teachersOnlyAccess && (
              <>
                <Route path="/teachers" element={<Teachers />} />
                <Route path="/teachers/:id" element={<TeacherDetail />} />
                <Route path="/teacher-salaries" element={<TeacherSalaries />} />
                <Route path="/teacher-loans" element={<TeacherLoans />} />
                <Route path="/teacher-attendance" element={<TeacherAttendance />} />
                <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
                {permissions.canEditSalaries && <Route path="/teacher-settings" element={<TeacherSettings />} />}
              </>
            )}
          </>
        )}

        {permissions.canManageRoles && <Route path="/roles" element={<RoleManagement />} />}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
