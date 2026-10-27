import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return showToast;
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type };
    setToasts((prev) => [toast, ...prev]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  };

  const providerValue = useMemo(() => showToast, []);

  return (
    <ToastContext.Provider value={providerValue}>
      {children}
      <div style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        zIndex: 9999,
        maxWidth: 320,
      }}>
        {toasts.map((toast) => (
          <div key={toast.id} style={{
            boxShadow: "0 16px 40px rgba(0,0,0,0.15)",
            borderRadius: 16,
            padding: "14px 16px",
            background: "rgba(15,23,42,0.95)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.08)",
            opacity: 0.98,
            fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.4,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, textTransform: "capitalize" }}>{toast.type}</div>
            <div style={{ fontSize: 14 }}>{toast.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
