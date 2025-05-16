import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { authService } from "../lib/auth";

export interface ProtectedRouteProps {
  requireLogin?: boolean;
  requireTenant?: boolean;
  children: ReactNode;
}

export function ProtectedRoute({
  requireLogin = true,
  requireTenant = false,
  children,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Validate the current domain matches the session type
    if (!isLoading) {
      const isTenantDomain = authService.isTenantDomain();
      const isLoginDomain = authService.isLoginDomain();

      if (requireTenant && !isTenantDomain) {
        window.location.href = "http://login.lvh.me:3000";
      } else if (!requireTenant && !isLoginDomain && user) {
        window.location.href = `http://${user.tenants[0]}.lvh.me:3000`;
      }
    }
  }, [isLoading, user, requireTenant]);

  // Show loading state only briefly to prevent flash
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-lg font-medium">Loading...</div>
          <div className="mt-2 text-sm text-gray-500">
            Please wait while we verify your session
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated and login required, redirect to login
  if (requireLogin && !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // If tenant is required but user has no tenants, redirect to select-tenant
  if (requireTenant && user && !user.tenants?.length) {
    return (
      <Navigate
        to="/select-tenant"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return <>{children}</>;
}
