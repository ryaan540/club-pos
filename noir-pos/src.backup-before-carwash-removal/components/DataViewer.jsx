import { useMemo, useState } from "react";
import { useToast } from "./ToastProvider.jsx";
import { Database, Eye, Users, Package, Receipt, FileText, Lock, Trash2 } from "lucide-react";

function DataViewer({ users, setUsers, products, sales, expenses, closedDays, onClose }) {
  const [tab, setTab] = useState("users");

  const summary = useMemo(() => ({
    users: users.length,
    products: products.length,
    sales: sales.length,
    expenses: expenses.length,
    closedDays: Object.keys(closedDays).length,
  }), [users, products, sales, expenses, closedDays]);

  const tabs = [
    { key: "users", label: "Users", icon: Users },
    { key: "products", label: "Products", icon: Package },
    { key: "sales", label: "Sales", icon: Receipt },
    { key: "expenses", label: "Expenses", icon: FileText },
    { key: "days", label: "Closed Days", icon: Lock },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
      <div className="rounded-2xl flex flex-col overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--border)", width: "min(1000px, 96vw)", height: "min(88vh, 900px)", fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-3">
            <Database size={18} style={{ color: "var(--primary)" }} />
            <div>
              <p className="text-xl font-black uppercase tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>Stored Data</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>Browse app data without DevTools</p>
            </div>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>Close</button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex gap-2 px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: tab === key ? "var(--primary)" : "var(--secondary)", color: tab === key ? "var(--primary-foreground)" : "var(--muted-foreground)" }}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border-b" style={{ borderColor: "var(--border)" }}>
            {Object.entries(summary).map(([key, value]) => (
              <div key={key} className="rounded-xl p-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="text-[11px] uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{key}</p>
                <p className="text-lg font-black" style={{ color: "var(--foreground)" }}>{value}</p>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === "users" && (
              <div className="flex flex-col gap-2">
                {users.map((u) => (
                  <div key={u.id} className="rounded-xl p-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold" style={{ color: "var(--foreground)" }}>{u.name}</p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{u.role} · {u.email || "No email"}</p>
                      </div>
                      {setUsers && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            const newPin = window.prompt(`Enter new PIN for ${u.name} (4-6 digits):`);
                            if (newPin === null) return;
                            const val = String(newPin).trim();
                            if (val.length < 4) { showToast("PIN must be at least 4 digits.", "error"); return; }
                            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, pin: val } : x));
                            showToast(`PIN updated for ${u.name}.`, "success");
                          }} className="text-xs px-2 py-1.5 rounded-lg transition-all hover:brightness-110" style={{ background: "transparent", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                            <Lock size={14} />
                          </button>
                          {u.role !== "admin" && (
                            <button onClick={() => {
                              if (!window.confirm(`Delete ${u.name}? This cannot be undone.`)) return;
                              setUsers(prev => prev.filter(x => x.id !== u.id));
                            }} className="text-xs px-2 py-1.5 rounded-lg transition-all hover:brightness-110" style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--border)" }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "products" && (
              <div className="flex flex-col gap-2">
                {products.map((p) => (
                  <div key={p.id} className="rounded-xl p-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{p.category} · stock {p.stock} · KSh {p.price}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "sales" && (
              <div className="flex flex-col gap-2">
                {sales.slice(0, 50).map((s) => (
                  <div key={s.id} className="rounded-xl p-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>{s.servedBy} · {s.method}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{new Date(s.timestamp).toLocaleString("en-KE")} · KSh {s.total}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "expenses" && (
              <div className="flex flex-col gap-2">
                {expenses.map((e) => (
                  <div key={e.id} className="rounded-xl p-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>{e.desc}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{e.category} · {e.recordedBy} · KSh {e.amount}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === "days" && (
              <div className="flex flex-col gap-2">
                {Object.entries(closedDays).map(([date, entry]) => (
                  <div key={date} className="rounded-xl p-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <p className="font-semibold" style={{ color: "var(--foreground)" }}>{date}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{entry.closedBy} · revenue KSh {entry.totalRevenue || 0}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataViewer;
