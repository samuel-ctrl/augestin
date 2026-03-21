import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout, ProtectedRoute } from "@shared";
import { sidebarItems } from "./config/sidebar";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/SelfStudy/Dashboard";
import SubjectView from "./pages/SelfStudy/SubjectView";
import BookView from "./pages/SelfStudy/BookView";
import Profile from "./pages/Profile";

function AuthenticatedApp() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <ProtectedRoute
      isAuthenticated={isAuthenticated}
      requiredRole="student"
      userRole={user?.user_type}
      mustChangePassword={user?.must_change_password}
      changePasswordPath="/change-password"
    >
      <AppLayout
        navItems={sidebarItems}
        userName={user?.name || ""}
        userRole="Student"
        onLogout={logout}
      >
        <Routes>
          <Route path="/self-study" element={<Dashboard />} />
          <Route path="/self-study/subjects/:id" element={<SubjectView />} />
          <Route path="/self-study/books/:id" element={<BookView />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/" element={<Navigate to="/self-study" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </ProtectedRoute>
  );
}

function ChangePasswordGuard() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.must_change_password) {
    return <Navigate to="/self-study" replace />;
  }

  return <ChangePassword />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ChangePasswordGuard />} />
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </AuthProvider>
  );
}
