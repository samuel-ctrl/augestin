import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout, ProtectedRoute } from "@shared";
import { sidebarItems } from "./config/sidebar";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/SelfStudy/Dashboard";
import SubjectBooks from "./pages/SelfStudy/SubjectBooks";
import BookForm from "./pages/SelfStudy/BookForm";
import BookAssign from "./pages/SelfStudy/BookAssign";
import BookQuestions from "./pages/SelfStudy/BookQuestions";
import QuestionForm from "./pages/SelfStudy/QuestionForm";
import BookPreview from "./pages/SelfStudy/BookPreview";
import BookRecap from "./pages/SelfStudy/BookRecap";
import BookTest from "./pages/SelfStudy/BookTest";
import StudentList from "./pages/Students/StudentList";
import StudentCreate from "./pages/Students/StudentCreate";
import StudentDetail from "./pages/Students/StudentDetail";
import DevComponents from "./pages/DevComponents";

function AuthenticatedApp() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <ProtectedRoute
      isAuthenticated={isAuthenticated}
      requiredRole="tutor"
      userRole={user?.user_type}
    >
      <AppLayout
        navItems={sidebarItems}
        userName={user?.name || ""}
        userRole="Tutor"
        onLogout={logout}
      >
        <Routes>
          <Route path="/self-study" element={<Dashboard />} />
          <Route path="/self-study/subjects/:id" element={<SubjectBooks />} />
          <Route path="/self-study/books/new" element={<BookForm />} />
          <Route path="/self-study/books/:id/edit" element={<BookForm />} />
          <Route path="/self-study/books/:id/preview" element={<BookPreview />} />
          <Route path="/self-study/books/:id/assign" element={<BookAssign />} />
          <Route path="/self-study/books/:id/recap" element={<BookRecap />} />
          <Route path="/self-study/books/:id/test" element={<BookTest />} />
          <Route path="/self-study/books/:id/questions" element={<BookQuestions />} />
          <Route path="/self-study/books/:bookId/questions/new" element={<QuestionForm />} />
          <Route path="/self-study/questions/:id/edit" element={<QuestionForm />} />
          <Route path="/students" element={<StudentList />} />
          <Route path="/students/new" element={<StudentCreate />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/" element={<Navigate to="/self-study" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dev/components" element={<DevComponents />} />
        <Route path="/*" element={<AuthenticatedApp />} />
      </Routes>
    </AuthProvider>
  );
}
