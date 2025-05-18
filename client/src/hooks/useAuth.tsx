import React, { createContext, useContext, useEffect, useState } from "react";
import { authService } from "../lib/auth";
import type { User } from "../schemas/user";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginToTenant: (tenantId: string) => Promise<void>;
  validateSession: () => Promise<boolean>;
}

// Define a type for API errors
interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const isValid = await authService.validateSession();
        if (isValid) {
          const userData = await authService.getMe();
          setUser(userData);
        }
      } catch (err: unknown) {
        console.error("Auth initialization error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Set up a simple session check for tenant domains, but let server handle redirects
  useEffect(() => {
    if (authService.isTenantDomain()) {
      console.log("On tenant domain, loading user data");

      // Just try to load user data, let server handle auth
      const loadUserData = async () => {
        try {
          const userData = await authService.getMe();
          console.log("User data loaded:", userData);
          setUser(userData);
        } catch (error) {
          console.error(
            "Failed to get user data, server should handle redirect:",
            error
          );
          // Don't redirect here, let the server API response trigger a redirect if needed
        } finally {
          // Always set loading to false to avoid infinite loading state
          setIsLoading(false);
        }
      };

      loadUserData();
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      const response = await authService.login(email, password);
      setUser(response.user);
    } catch (err: unknown) {
      console.error("Failed to login", err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await authService.logout();
      setUser(null);

      // Use current protocol and port
      const protocol = window.location.protocol;
      const port = window.location.port || "3000";
      window.location.href = `${protocol}//login.lvh.me:${port}`;
    } catch (err: unknown) {
      console.error("Failed to logout", err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || "Logout failed");
      throw err;
    }
  };

  const loginToTenant = async (tenantId: string) => {
    try {
      setError(null);
      await authService.loginToTenant(tenantId);
    } catch (err: unknown) {
      console.error("Failed to login to tenant", err);
      const apiError = err as ApiError;
      setError(apiError.response?.data?.message || "Tenant login failed");
      throw err;
    }
  };

  const validateSession = async () => {
    try {
      // Add timeout to prevent hanging forever
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.warn("Session validation timed out");
          resolve(false);
        }, 5000); // 5 second timeout
      });

      // Race the validation against timeout
      return await Promise.race([
        authService.validateSession(),
        timeoutPromise,
      ]);
    } catch (err: unknown) {
      console.error("Failed to validate session", err);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        loginToTenant,
        validateSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
