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

  // Set up session validation interval
  useEffect(() => {
    if (authService.isTenantDomain()) {
      const interval = setInterval(async () => {
        const isValid = await authService.validateSession();
        if (!isValid) {
          setUser(null);
          window.location.href = "http://login.lvh.me:3000";
        }
      }, 5 * 60 * 1000); // Check every 5 minutes

      return () => clearInterval(interval);
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
      window.location.href = "http://login.lvh.me:3000";
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
      return await authService.validateSession();
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
