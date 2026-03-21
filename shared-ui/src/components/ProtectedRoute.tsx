import React from "react";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  isAuthenticated: boolean;
  loginPath?: string;
  mustChangePassword?: boolean;
  changePasswordPath?: string;
  requiredRole?: string;
  userRole?: string;
}

export function ProtectedRoute({
  children,
  isAuthenticated,
  loginPath = "/login",
  mustChangePassword,
  changePasswordPath = "/change-password",
  requiredRole,
  userRole,
}: ProtectedRouteProps) {
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (mustChangePassword && location.pathname !== changePasswordPath) {
    return <Navigate to={changePasswordPath} replace />;
  }

  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to={loginPath} replace />;
  }

  return <>{children}</>;
}
