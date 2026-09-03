import { useState, useEffect, useCallback } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { WebSocketProvider, useWS } from "./context/WebSocketContext";
import { StreakProvider } from "./context/StreakContext";
import { AppLayout, ProtectedRoute, NotificationToast, NotificationsPage, AuthStatusPage } from "@shared";
import { sidebarItems } from "./config/sidebar";
import api from "./api/client";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";
import DevComponents from "./pages/DevComponents";
import HomeDashboard from "./pages/Home/HomeDashboard";
import Dashboard from "./pages/SelfStudy/Dashboard";
import SubjectView from "./pages/SelfStudy/SubjectView";
import BookView from "./pages/SelfStudy/BookView";
import TopicView from "./pages/SelfStudy/TopicView";
import QuizSetDashboard from "./pages/QuizSets/QuizSetDashboard";
import QuizSetView from "./pages/QuizSets/QuizSetView";
import LiveQuizJoin from "./pages/QuizSets/LiveQuizJoin";
import LiveQuizRoom from "./pages/QuizSets/LiveQuizRoom";
import TestSetDashboard from "./pages/TestSets/TestSetDashboard";
import TestSetView from "./pages/TestSets/TestSetView";
import DoubtList from "./pages/Doubts/DoubtList";
import DoubtCreate from "./pages/Doubts/DoubtCreate";
import DoubtDetail from "./pages/Doubts/DoubtDetail";
import Profile from "./pages/Profile";

function AppShell() {
  const { user, logout } = useAuth();
  const { on, status: wsStatus } = useWS();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const handleLogout = useCallback(() => {
    logout();
    navigate("/logout");
  }, [logout, navigate]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    api.get<{ count: number }>("/notifications/unread-count")
      .then(({ data }) => setUnreadCount(data.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    return on("notification:created", () => {
      setUnreadCount((c) => c + 1);
    });
  }, [on]);

  const handleCountChange = useCallback((count: number) => {
    setUnreadCount(count);
  }, []);

  return (
    <>
      <NotificationToast on={on} />
      <AppLayout
        navItems={sidebarItems}
        userName={user?.name || ""}
        userRole="Student"
        onLogout={handleLogout}
        notificationCount={unreadCount}
        onNotificationClick={() => navigate("/notifications")}
        wsStatus={wsStatus}
        hideCredit
        showDateTime
        isDark={isDark}
        onThemeToggle={toggleTheme}
      >
        <Routes>
          <Route path="/" element={<HomeDashboard />} />
          <Route path="/self-study" element={<Dashboard />} />
          <Route path="/self-study/subjects/:id" element={<SubjectView />} />
          <Route path="/self-study/books/:id" element={<BookView />} />
          <Route path="/self-study/topics/:topicId" element={<TopicView />} />
          <Route path="/quiz-sets" element={<QuizSetDashboard />} />
          <Route path="/quiz-sets/live" element={<LiveQuizJoin />} />
          <Route path="/quiz-sets/:id/live/:code" element={<LiveQuizRoom />} />
          <Route path="/quiz-sets/:id" element={<QuizSetView />} />
          <Route path="/test-sets" element={<TestSetDashboard />} />
          <Route path="/test-sets/:id" element={<TestSetView />} />
          <Route path="/doubts" element={<DoubtList />} />
          <Route path="/doubts/new" element={<DoubtCreate />} />
          <Route path="/doubts/:id" element={<DoubtDetail />} />
          <Route path="/notifications" element={<NotificationsPage api={api} navigate={navigate} onCountChange={handleCountChange} on={on} />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </>
  );
}

function AuthenticatedApp() {
  const { user, isAuthenticated } = useAuth();

  return (
    <WebSocketProvider>
    <ProtectedRoute
      isAuthenticated={isAuthenticated}
      requiredRole="student"
      userRole={user?.user_type}
      mustChangePassword={user?.must_change_password}
      changePasswordPath="/change-password"
    >
      {/* Inside ProtectedRoute: the streak sync and heartbeat must only run
          for an authenticated student who is past the forced-password-change
          gate, which is exactly what this position guarantees. */}
      <StreakProvider>
        <AppShell />
      </StreakProvider>
    </ProtectedRoute>
    </WebSocketProvider>
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
    <ThemeProvider>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/session-expired" element={<AuthStatusPage variant="session-expired" />} />
        <Route path="/logout" element={<AuthStatusPage variant="logged-out" />} />
        <Route path="/change-password" element={<ChangePasswordGuard />} />
        <Route path="/dev/components" element={<DevComponents />} />
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </AuthProvider>
    </ThemeProvider>
  );
}
