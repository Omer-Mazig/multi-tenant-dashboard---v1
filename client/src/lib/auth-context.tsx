import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { authApi, userApi } from "./api";
import type { User } from "../schemas/user";

// Constants for browser-wide security
const ACTIVE_USER_KEY = "secure-dashboard-active-user";
const BROWSER_LOCK_KEY = "secure-dashboard-browser-lock";

interface LogoutOptions {
  isIdle?: boolean;
  notifyOtherTabs?: boolean;
  forceLogout?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Check if we're on the login page to prevent unnecessary API calls

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if another user is logged in (security check)
  const checkForExistingUser = (currentUser: User) => {
    try {
      const activeUserStr = localStorage.getItem(ACTIVE_USER_KEY);
      if (!activeUserStr) return false;

      const activeUser = JSON.parse(activeUserStr);

      // If different user, return true (conflict exists)
      if (activeUser && activeUser.id && activeUser.id !== currentUser.id) {
        console.error(
          "Security Alert: Another user is already logged in to this browser"
        );
        return true;
      }

      return false;
    } catch (e) {
      console.error("Error checking for existing user:", e);
      return false;
    }
  };

  // Set this user as the active browser user
  const setActiveUser = (currentUser: User) => {
    try {
      // Store minimal user data - only what's needed for identification
      localStorage.setItem(
        ACTIVE_USER_KEY,
        JSON.stringify({
          id: currentUser.id,
          email: currentUser.email,
        })
      );

      // Set browser lock with timestamp
      localStorage.setItem(
        BROWSER_LOCK_KEY,
        JSON.stringify({
          timestamp: Date.now(),
          id: currentUser.id,
        })
      );
    } catch (e) {
      console.error("Error setting active user:", e);
    }
  };

  // Clear active user data
  const clearActiveUser = () => {
    try {
      localStorage.removeItem(ACTIVE_USER_KEY);
      localStorage.removeItem(BROWSER_LOCK_KEY);
    } catch (e) {
      console.error("Error clearing active user:", e);
    }
  };

  // Extract tenant ID from hostname
  useEffect(() => {
    const hostname = window.location.hostname;
    console.log("Current hostname:", hostname);

    // Handle different hostname patterns
    if (hostname === "localhost") {
      // Default tenant for localhost without subdomain
      console.log("Using default tenant 'acme' for localhost");
    } else if (hostname.includes(".")) {
      // Extract subdomain from hostname with dots
      const subdomain = hostname.split(".")[0];
      console.log("Extracted subdomain:", subdomain);

      if (subdomain && subdomain !== "www") {
        console.log("Setting tenant ID to:", subdomain);
      } else {
        // Default for www or no subdomain
        console.log("No valid subdomain found, using default 'acme'");
      }
    } else {
      // Fallback for any other case
      console.log("Using default tenant 'acme' for unknown hostname format");
    }
  }, []);

  // Listen for storage events that might indicate another tab logged in
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // If browser lock changed and we have a user
      if (event.key === BROWSER_LOCK_KEY && user) {
        try {
          const lockData = JSON.parse(event.newValue || "{}");

          // If lock is for a different user, force logout
          if (lockData.id && lockData.id !== user.id) {
            console.warn(
              "Security Alert: Another user has logged in to this browser"
            );
            logout({
              forceLogout: true,
              notifyOtherTabs: false, // Don't notify to avoid loops
            });
          }
        } catch (e) {
          console.error("Error handling storage event:", e);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [user]);

  // Check for existing session on component mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Fetch CSRF token first
        await authApi.getCsrfToken();

        // Then check for session
        const userData = await userApi.getMe();

        // If user data exists, update the active user
        if (userData) {
          setActiveUser(userData);
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error: unknown) {
        console.error("Error checking session:", error);
        console.log("No active session found");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      // Fetch CSRF token before login
      await authApi.getCsrfToken();

      const response = await authApi.login({ email, password });

      // SECURITY CHECK: If another user is already logged in, force logout all
      if (checkForExistingUser(response.user)) {
        // Force logout any existing users in other tabs first
        broadcastForcedLogout();

        // Small delay to ensure other tabs have time to process
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Set this user as the active browser user
      setActiveUser(response.user);
      setUser(response.user);

      return response.user; // Return the user data for additional handling
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Broadcast a forced logout event to all tabs
  const broadcastForcedLogout = () => {
    try {
      localStorage.setItem(
        "secure-dashboard-forced-logout",
        JSON.stringify({
          timestamp: Date.now(),
          reason: "security_policy",
          message: "Another user is logging in to this browser",
        })
      );
    } catch (e) {
      console.error("Error broadcasting forced logout:", e);
    }
  };

  const logout = async (options: LogoutOptions = {}) => {
    const {
      isIdle = false,
      notifyOtherTabs = true,
      forceLogout = false,
    } = options;
    setIsLoading(true);
    try {
      await authApi.logout();
      setUser(null);

      // Clear active user data
      clearActiveUser();

      // For Option #2 (Tenant-Wide Security): Notify other tabs for ALL logout events
      if (notifyOtherTabs) {
        const hostname = window.location.hostname;
        const tenantId = hostname.split(".")[0];

        try {
          // Notify other tabs for THIS USER ONLY in the same tenant about logout
          const eventKey = user?.id
            ? `${tenantId}-${user.id}-app-logout-event`
            : `${tenantId}-app-logout-event`;

          localStorage.setItem(
            eventKey,
            JSON.stringify({
              timestamp: Date.now(),
              reason: forceLogout ? "forced" : isIdle ? "idle" : "explicit",
              isIdle: isIdle,
              forced: forceLogout,
              id: user?.id || null,
            })
          );
        } catch (e) {
          console.error("Failed to set logout event in localStorage", e);
        }
      }

      if (forceLogout) {
        // Add a notification message
        const message =
          "You've been logged out because another user logged in to this browser. For security reasons, only one user can be active at a time.";
        // You could set this in localStorage or state to show a notification
        try {
          localStorage.setItem("logout-message", message);
        } catch (e) {
          console.error("Failed to set logout message:", e);
        }
      }

      // Redirect to login page on the same tenant subdomain
      // This ensures we maintain tenant context during logout
      const loginPath = "/login";

      // Keep the same hostname (tenant subdomain) but change path to login
      window.location.href = loginPath;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login: handleLogin, logout }}
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
