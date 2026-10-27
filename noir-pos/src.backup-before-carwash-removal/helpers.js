import { useCallback, useEffect, useState } from "react";

export const STORAGE_KEYS = {
  USERS: "noir_users",
  PRODUCTS: "noir_products",
  SALES: "noir_sales",
  EXPENSES: "noir_expenses",
  CATEGORIES: "noir_categories",
  CLOSED_DAYS: "noir_closed_days",
  PENDING_SYNC: "noir_pending_sync",
};

const PENDING_SYNC_KEY = STORAGE_KEYS.PENDING_SYNC;
const SYNC_ENDPOINT = import.meta.env.VITE_SYNC_URL || "";

export function formatPrice(n) {
  return `KSh ${Math.round(n).toLocaleString()}`;
}

export function now() {
  return new Date().toISOString();
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readStoredValue(key, initial) {
  try {
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s);
    const initialValue = typeof initial === "function" ? initial() : initial;
    localStorage.setItem(key, JSON.stringify(initialValue));
    return initialValue;
  } catch {
    return typeof initial === "function" ? initial() : initial;
  }
}

function writeStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures so the app keeps working in restricted browsers.
  }
}

function readPendingSyncs() {
  try {
    const s = localStorage.getItem(PENDING_SYNC_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

function writePendingSyncs(queue) {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage failures so the app keeps working in restricted browsers.
  }
}

function enqueuePendingSync(key, value) {
  const queue = readPendingSyncs();
  queue[key] = { key, payload: value, updatedAt: new Date().toISOString() };
  writePendingSyncs(queue);
}

export async function flushPendingSyncs() {
  if (typeof navigator === "undefined" || !navigator.onLine || !SYNC_ENDPOINT) {
    return false;
  }

  const pending = readPendingSyncs();
  const changes = Object.values(pending);
  if (!changes.length) {
    return false;
  }

  try {
    const response = await fetch(SYNC_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestamp: new Date().toISOString(), changes }),
    });

    if (!response.ok) {
      throw new Error(`sync failed with status ${response.status}`);
    }

    writePendingSyncs({});
    return true;
  } catch {
    return false;
  }
}

export function useLocalState(key, initial) {
  const [val, setValState] = useState(() => readStoredValue(key, initial));

  const setVal = useCallback((next) => {
    setValState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      writeStoredValue(key, resolved);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueuePendingSync(key, resolved);
      }

      return resolved;
    });
  }, [key]);

  useEffect(() => {
    writeStoredValue(key, val);

    if (typeof navigator !== "undefined" && navigator.onLine) {
      void flushPendingSyncs();
    }
  }, [key, val]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleConnectionChange = () => {
      if (navigator.onLine) {
        void flushPendingSyncs();
      }
    };

    window.addEventListener("online", handleConnectionChange);
    window.addEventListener("offline", handleConnectionChange);

    return () => {
      window.removeEventListener("online", handleConnectionChange);
      window.removeEventListener("offline", handleConnectionChange);
    };
  }, []);

  return [val, setVal];
}

async function checkOnlineStatus() {
  if (typeof window === "undefined") {
    return true;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 3000);
    const url = `${window.location.origin}/favicon.ico?__online_check=${Date.now()}`;
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    window.clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let mounted = true;
    const updateStatus = async () => {
      const online = await checkOnlineStatus();
      if (mounted) setIsOnline(online);
    };

    const handleConnectionChange = () => {
      void updateStatus();
    };

    window.addEventListener("online", handleConnectionChange);
    window.addEventListener("offline", handleConnectionChange);
    void updateStatus();

    const intervalId = window.setInterval(() => {
      void updateStatus();
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      window.removeEventListener("online", handleConnectionChange);
      window.removeEventListener("offline", handleConnectionChange);
    };
  }, []);

  return isOnline;
}

export function downloadCSV(filename, rows) {
  const csv = rows
    .map(r => r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
