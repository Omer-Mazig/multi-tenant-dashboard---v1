import { useEffect, useRef, useState } from "react";
import { tenantApi } from "../lib/api";

interface IdleTimeoutOptions {
  onIdle: () => void;
  idleTime: number; // in milliseconds
  tenantId: string | null; // Add tenant context
  pingInterval?: number; // Session ping interval (default: 10 minutes)
  activityWindow?: number; // How recent activity must be for pings to work (default: 30 seconds)
}

export function useIdleTimeout({
  onIdle,
  idleTime,
  tenantId,
  pingInterval = 10 * 60 * 1000, // 10 minutes by default
  activityWindow = 30 * 1000, // 30 seconds by default
}: IdleTimeoutOptions) {
  const idleTimeoutRef = useRef<number | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [isActive, setIsActive] = useState<boolean>(true);

  // Store the current tenant for comparison
  const tenantRef = useRef<string | null>(tenantId);

  // Tracks user activity
  const updateActivity = () => {
    lastActivityRef.current = Date.now();
    if (!isActive) {
      setIsActive(true);
    }
  };

  const resetIdleTimeout = () => {
    // Only reset if we're in the same tenant context
    if (tenantRef.current !== tenantId) {
      return;
    }

    // Update last activity timestamp
    updateActivity();

    if (idleTimeoutRef.current) {
      window.clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = window.setTimeout(() => {
      // Double-check tenant context before executing idle callback
      if (tenantRef.current === tenantId) {
        console.log(`User idle for ${idleTime}ms in tenant: ${tenantId}`);
        setIsActive(false);
        onIdle();
      }
    }, idleTime);
  };

  // Send session ping only if user has been active recently
  const attemptSessionPing = async () => {
    try {
      if (!tenantId) return; // Only ping for tenant domains

      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      // Only ping if user was active in the last activityWindow (30 seconds by default)
      if (timeSinceLastActivity <= activityWindow) {
        console.log(
          `Sending session ping (last activity: ${timeSinceLastActivity}ms ago)`
        );
        await tenantApi.ping();
      } else {
        console.log(
          `Skipping ping - user inactive for ${timeSinceLastActivity}ms`
        );
      }
    } catch (error) {
      console.error("Session ping failed:", error);
    }
  };

  useEffect(() => {
    // Update tenant reference if it changes
    tenantRef.current = tenantId;

    // Events that reset the idle timer
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
    ];

    // Reset the timer initially
    resetIdleTimeout();

    // Set up ping interval if we're in a tenant context
    if (tenantId) {
      console.log(`Setting up session ping interval: ${pingInterval}ms`);
      pingIntervalRef.current = window.setInterval(
        attemptSessionPing,
        pingInterval
      );

      // Initial ping
      attemptSessionPing();
    }

    // Add event listeners
    const eventListeners = events.map((event) => {
      const listener = () => resetIdleTimeout();
      window.addEventListener(event, listener);
      return { event, listener };
    });

    // Cleanup
    return () => {
      if (idleTimeoutRef.current) {
        window.clearTimeout(idleTimeoutRef.current);
      }

      if (pingIntervalRef.current) {
        window.clearInterval(pingIntervalRef.current);
      }

      eventListeners.forEach(({ event, listener }) => {
        window.removeEventListener(event, listener);
      });
    };
  }, [idleTime, onIdle, tenantId, pingInterval, activityWindow]);

  return {
    resetIdleTimeout,
    isActive,
    lastActivity: lastActivityRef.current,
  };
}
