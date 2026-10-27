import { useEffect, useState } from "react";
import { Calendar, Clock, LogOut, Wifi, WifiOff } from "lucide-react";
import { todayKey, useNetworkStatus } from "../helpers.js";

function Topbar({ user, onLogout, title, subtitle }) {
  const [time, setTime] = useState(new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }));
  const isOnline = useNetworkStatus();
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })), 30000);
    return () => clearInterval(t);
  }, []);
  const roleLabel = user.role === "admin" ? "Owner" : user.role === "manager" ? "Manager" : "Bartender";
  const roleColor = user.role === "admin" ? "#f5a623" : user.role === "manager" ? "#a78bfa" : "#34d399";

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b shrink-0 glass-card"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(90deg, rgba(245,166,35,0.18), rgba(139,92,246,0.10))" }}>
      <div className="flex items-center gap-4">
        <div className="text-2xl font-black tracking-widest uppercase"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)", letterSpacing: "0.18em" }}>
          NOIR&nbsp;<span style={{ color: "var(--foreground)", opacity: 0.4 }}>|</span>&nbsp;POS
        </div>
        {title && (
          <span className="text-sm font-semibold" style={{ color: "var(--muted-foreground)" }}>
            / {title}{subtitle ? ` — ${subtitle}` : ""}
          </span>
        )}
      </div>
      <div className="flex items-center gap-5 text-sm" style={{ color: "var(--muted-foreground)" }}>
        <div className="flex items-center gap-1.5">
          <Calendar size={13} />
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.75rem" }}>{todayKey()}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={13} />
          <span style={{ fontFamily: "'DM Mono', monospace" }}>{time}</span>
        </div>
        <div className="flex items-center gap-1.5" style={{ color: isOnline ? "#34d399" : "#f87171" }}>
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span className="text-xs font-semibold">{isOnline ? "Online" : "Offline"}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: roleColor + "22", color: roleColor, border: `1px solid ${roleColor}44` }}>
            {user.name[0]}
          </div>
          <div>
            <p className="text-xs font-semibold leading-none" style={{ color: "var(--foreground)" }}>{user.name}</p>
            <p className="text-xs leading-none mt-0.5" style={{ color: roleColor, fontFamily: "'DM Mono', monospace" }}>{roleLabel}</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-opacity hover:opacity-80"
          style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
          <LogOut size={12} /> Logout
        </button>
      </div>
    </header>
  );
}

export default Topbar;

// ─── LOGIN ───────────────────────────────────────────────────────────────────

