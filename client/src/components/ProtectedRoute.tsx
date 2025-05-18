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

      // Get current protocol and port
      const protocol = window.location.protocol;
      const port = window.location.port || "3000";
      console.log("Current protocol:", protocol, "port:", port);

      if (requireTenant && !isTenantDomain) {
        console.log(
          "Redirecting to login domain - tenant required but not on tenant domain"
        );
        window.location.href = `${protocol}//login.lvh.me:${port}`;
      } else if (!requireTenant && !isLoginDomain && user) {
        // If user has tenants, redirect to the first one
        if (user.tenants && user.tenants.length > 0) {
          console.log("Redirecting to tenant domain:", user.tenants[0]);
          window.location.href = `${protocol}//${user.tenants[0]}.lvh.me:${port}`;
        } else {
          console.log("No tenants available for user");
        }
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
