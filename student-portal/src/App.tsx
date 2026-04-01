import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout, ProtectedRoute } from "@shared";
import { sidebarItems } from "./config/sidebar";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import DevComponents from "./pages/DevComponents";
import HomeDashboard from "./pages/Home/HomeDashboard";
import Dashboard from "./pages/SelfStudy/Dashboard";
import SubjectView from "./pages/SelfStudy/SubjectView";
import BookView from "./pages/SelfStudy/BookView";
import QuizSetDashboard from "./pages/QuizSets/QuizSetDashboard";
import QuizSetView from "./pages/QuizSets/QuizSetView";
import TestSetDashboard from "./pages/TestSets/TestSetDashboard";
import TestSetView from "./pages/TestSets/TestSetView";
import DoubtList from "./pages/Doubts/DoubtList";
import DoubtCreate from "./pages/Doubts/DoubtCreate";
import DoubtDetail from "./pages/Doubts/DoubtDetail";
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
          <Route path="/" element={<HomeDashboard />} />
          <Route path="/self-study" element={<Dashboard />} />
          <Route path="/self-study/subjects/:id" element={<SubjectView />} />
          <Route path="/self-study/books/:id" element={<BookView />} />
          <Route path="/quiz-sets" element={<QuizSetDashboard />} />
          <Route path="/quiz-sets/:id" element={<QuizSetView />} />
          <Route path="/test-sets" element={<TestSetDashboard />} />
          <Route path="/test-sets/:id" element={<TestSetView />} />
          <Route path="/doubts" element={<DoubtList />} />
          <Route path="/doubts/new" element={<DoubtCreate />} />
          <Route path="/doubts/:id" element={<DoubtDetail />} />
          <Route path="/profile" element={<Profile />} />
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
        <Route path="/dev/components" element={<DevComponents />} />
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </AuthProvider>
  );
}
