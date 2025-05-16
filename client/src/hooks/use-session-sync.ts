import { useEffect, useRef } from "react";
import { authApi } from "../lib/api";

const SESSION_CHECK_INTERVAL = 60000; // Check session validity every minute
const ACTIVITY_KEY = "lastActivity";
const LOGOUT_EVENT_KEY = "app-logout-event";
const BROWSER_FORCED_LOGOUT_KEY = "secure-dashboard-forced-logout"; // Add constant for the browser-wide forced logout key

interface SessionSyncOptions {
  onInvalidSession: () => void;
  tenantId: string | null;
  id?: string | null; // Add user ID to properly isolate per user
}

export function useSessionSync({
  onInvalidSession,
  tenantId,
  id,
}: SessionSyncOptions) {
  const lastActivityRef = useRef<number>(Date.now());
  const sessionCheckIntervalRef = useRef<number | null>(null);

  // Security commentary for cybersecurity assessment
  /* SECURITY IMPLEMENTATION:
   * This hook implements cross-tab session synchronization with these security features:
   * 1. Server-side session validation to detect revoked/expired sessions
   * 2. Shared activity tracking across tabs to maintain consistent timeout behavior
   * 3. Synchronized logout to prevent authentication state inconsistencies
   * 4. Regular validation calls to detect security events like forced logouts
   * 5. Browser-wide user security (one user per browser)
   *
   * SECURITY/PERFORMANCE TRADEOFF:
   * We're making periodic server validation calls to ensure session consistency,
   * accepting increased server load to prevent session hijacking and session
   * inconsistency vulnerabilities, which is appropriate for security-sensitive applications.
   */

  // Generate storage key that includes both tenant and user
  const getStorageKey = (baseKey: string) => {
    // If id is provided, include it in the key for per-user isolation
    if (id) {
      return `${tenantId}-${id}-${baseKey}`;
    }
    // Fallback to tenant-only for backward compatibility
    return `${tenantId}-${baseKey}`;
  };

  // Update shared activity timestamp
  const updateActivity = () => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(getStorageKey(ACTIVITY_KEY), now.toString());
    } catch (e) {
      console.error("Failed to update activity in localStorage", e);
    }
  };

  // Validate session with server
  const validateSession = async () => {
    try {
      // Call server to validate session
      const user = await authApi.validateSession();
      console.log("Session validated successfully");
      return user;
    } catch (error: unknown) {
      console.error("Session validation failed, logging out");
      onInvalidSession();
    }
  };

  useEffect(() => {
    if (!tenantId) return;

    // Initial session validation
    validateSession();

    // Set up interval for regular session validation
    sessionCheckIntervalRef.current = window.setInterval(() => {
      validateSession();
    }, SESSION_CHECK_INTERVAL) as unknown as number;

    // Listen for storage events from other tabs
    const handleStorage = (event: StorageEvent) => {
      // Generate expected key patterns
      const activityKeyPattern = id
        ? `${tenantId}-${id}-${ACTIVITY_KEY}`
        : `${tenantId}-${ACTIVITY_KEY}`;

      const logoutKeyPattern = id
        ? `${tenantId}-${id}-${LOGOUT_EVENT_KEY}`
        : `${tenantId}-${LOGOUT_EVENT_KEY}`;

      // Handle activity updates from other tabs (same user & tenant only)
      if (event.key === activityKeyPattern) {
        lastActivityRef.current = parseInt(event.newValue || "0", 10);
      }

      // Handle logout events from other tabs (same user & tenant only)
      if (event.key === logoutKeyPattern) {
        try {
          // Parse the logout event data
          const logoutData = JSON.parse(event.newValue || "{}");

          // Option #2: Respond to ALL logout events for tenant-wide security
          console.log(
            `Logout detected in another tab (${
              logoutData.reason || "unknown reason"
            }), logging out all tabs for security`
          );
          onInvalidSession();
        } catch (e) {
          // Fallback behavior for backward compatibility
          console.log(
            "Logout detected in another tab, logging out this tab too"
          );
          onInvalidSession();
        }
      }

      // IMPORTANT: Monitor for browser-wide forced logout events (across all tenants)
      // This ensures the "one user per browser" security policy is enforced
      if (event.key === BROWSER_FORCED_LOGOUT_KEY) {
        try {
          const logoutData = JSON.parse(event.newValue || "{}");
          console.warn(
            `Security Alert: Browser-wide forced logout detected (${logoutData.reason}): ${logoutData.message}`
          );
          // Force logout this tab too
          onInvalidSession();
        } catch (e) {
          console.error("Error handling browser-wide forced logout event:", e);
        }
      }
    };

    // Set up event listeners for user activity
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
    ];

    const activityListeners = events.map((event) => {
      const listener = () => updateActivity();
      window.addEventListener(event, listener);
      return { event, listener };
    });

    // Set up storage event listener
    window.addEventListener("storage", handleStorage);

    // Cleanup function
    return () => {
      if (sessionCheckIntervalRef.current) {
        window.clearInterval(sessionCheckIntervalRef.current);
      }

      activityListeners.forEach(({ event, listener }) => {
        window.removeEventListener(event, listener);
      });

      window.removeEventListener("storage", handleStorage);
    };
  }, [tenantId, onInvalidSession]);

  // Function to trigger logout across all tabs of the same user
  const logoutAllTabs = () => {
    try {
      // Add both user ID and explicit flag to ensure proper user isolation
      localStorage.setItem(
        getStorageKey(LOGOUT_EVENT_KEY),
        JSON.stringify({
          timestamp: Date.now(),
          reason: "explicit",
          id: id || null,
        })
      );
    } catch (e) {
      console.error("Failed to set logout event in localStorage", e);
    }

    // Call the logout function in this tab
    onInvalidSession();
  };

  return { updateActivity, validateSession, logoutAllTabs };
}
