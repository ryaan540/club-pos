import { X, Lock } from "lucide-react";
import { formatPrice, todayKey } from "../helpers.js";

function CloseDayModal({ products, sales, expenses, onClose, onConfirm, closedDays }) {
  const today = todayKey();
  const alreadyClosed = closedDays[today];
  const todaySales = sales.filter(s => s.timestamp.slice(0, 10) === today);
  const todayExpenses = expenses.filter(e => e.timestamp.slice(0, 10) === today);
  const totalRevenue = todaySales.reduce((s, x) => s + x.total, 0);
  const cashRevenue = todaySales.filter(s => s.method === "cash").reduce((s, x) => s + x.total, 0);
  const mpesaRevenue = todaySales.filter(s => s.method === "mpesa").reduce((s, x) => s + x.total, 0);
  const totalExpenses = todayExpenses.reduce((s, e) => s + e.amount, 0);
  const netRevenue = totalRevenue - totalExpenses;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="rounded-2xl p-7 w-[480px] flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--card)", border: "1px solid var(--border)", fontFamily: "'DM Sans', sans-serif" }}>
        <button onClick={onClose} className="absolute top-5 right-5" style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
        
        <div>
          <p className="text-2xl font-black uppercase tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: alreadyClosed ? "#f87171" : "var(--foreground)" }}>
            {alreadyClosed ? "Day Already Closed" : "Close Day"}
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{today}</p>
        </div>

        {alreadyClosed ? (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}>
            <Lock size={16} style={{ color: "#f87171" }} />
            <p className="text-sm" style={{ color: "#f87171" }}>This day has already been closed at {new Date(alreadyClosed.closedAt).toLocaleTimeString("en-KE")}.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <p className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Day Summary</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Total Revenue", formatPrice(totalRevenue), "var(--primary)"],
                  ["Transactions", todaySales.length, "#a78bfa"],
                  ["Cash", formatPrice(cashRevenue), "#34d399"],
                  ["M-Pesa", formatPrice(mpesaRevenue), "#38bdf8"],
                  ["Total Expenses", formatPrice(totalExpenses), "#f87171"],
                ].map(([label, val, color]) => (
                  <div key={label} className="rounded-lg p-3" style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{label}</p>
                    <p className="text-lg font-black mt-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", color }}>{val}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>Net Revenue</p>
                <p className="text-xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#22c55e" }}>{formatPrice(netRevenue)}</p>
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
              <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Closing Stock Snapshot</p>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                {products.filter(p => p.stock < 99).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--foreground)" }}>{p.name}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: p.stock < 10 ? "#f87171" : "var(--muted-foreground)" }}>{p.stock} units</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Closing the day will snapshot the current stock as tomorrow's opening stock and lock today's records.
              </p>
              <button onClick={() => onConfirm(today, products, todaySales, todayExpenses)}
                className="py-3 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110 active:scale-95"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#f5a623", color: "#0d0c0f" }}>
                <Lock size={16} /> Confirm Close Day
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CloseDayModal;

// ─── DAILY CLOSING REPORT ────────────────────────────────────────────────────

