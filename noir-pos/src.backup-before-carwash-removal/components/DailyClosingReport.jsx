import { useEffect, useMemo, useState } from "react";
import { Activity, Calendar, Download, FileText, Users, X } from "lucide-react";
import { formatPrice, downloadCSV } from "../helpers.js";

function DailyClosingReport({ closedDays, sales, products, expenses, users, onClose }) {
  const sortedDays = Object.keys(closedDays).sort().reverse();
  const [selectedDate, setSelectedDate] = useState(sortedDays[0] || "");

  const report = selectedDate ? closedDays[selectedDate] : null;

  const daySales = useMemo(() => sales.filter(s => s.timestamp.slice(0, 10) === selectedDate), [sales, selectedDate]);
  const dayExpenses = useMemo(() => expenses.filter(e => e.timestamp.slice(0, 10) === selectedDate), [expenses, selectedDate]);

  const totalRevenue = daySales.reduce((s, x) => s + x.total, 0);
  const cashRev = daySales.filter(s => s.method === "cash").reduce((s, x) => s + x.total, 0);
  const mpesaRev = daySales.filter(s => s.method === "mpesa").reduce((s, x) => s + x.total, 0);
  const totalExp = dayExpenses.reduce((s, e) => s + e.amount, 0);

  const staffPerf = useMemo(() => {
    const map = {};
    daySales.forEach(s => {
      if (!map[s.servedBy]) map[s.servedBy] = { name: s.servedBy, sales: 0, txCount: 0 };
      map[s.servedBy].sales += s.total;
      map[s.servedBy].txCount++;
    });
    return Object.values(map).sort((a, b) => b.sales - a.sales);
  }, [daySales]);

  const itemFreq = useMemo(() => {
    const freq = {};
    daySales.forEach(s => s.items.forEach(i => { freq[i.name] = (freq[i.name] || 0) + i.qty; }));
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [daySales]);

  // Stock changes
  const stockChanges = useMemo(() => {
    if (!report || !report.openingStock) return [];
    return report.closingStock
      .map(cs => {
        const os = report.openingStock.find(o => o.id === cs.id);
        if (!os) return null;
        const sold = os.stock - cs.stock;
        return sold !== 0 ? { id: cs.id, name: cs.name, opening: os.stock, closing: cs.stock, sold } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.sold - a.sold);
  }, [report]);

  const exportReport = () => {
    if (!selectedDate) return;
    const rows = [
      ["NOIR POS — Daily Closing Report", selectedDate],
      [],
      ["REVENUE SUMMARY"],
      ["Total Revenue", totalRevenue],
      ["Cash", cashRev],
      ["M-Pesa", mpesaRev],
      ["Total Expenses", totalExp],
      ["Net Revenue", totalRevenue - totalExp],
      [],
      ["TRANSACTIONS"],
      ["Time", "Served By", "Items", "Method", "Total"],
      ...daySales.map(s => [
        new Date(s.timestamp).toLocaleTimeString("en-KE"),
        s.servedBy,
        s.items.map(i => `${i.name}×${i.qty}`).join("; "),
        s.method,
        s.total
      ]),
      [],
      ["EXPENSES"],
      ["Time", "Description", "Category", "Amount", "Recorded By"],
      ...dayExpenses.map(e => [
        new Date(e.timestamp).toLocaleTimeString("en-KE"),
        e.desc, e.category, e.amount, e.recordedBy
      ]),
      [],
      ["STOCK MOVEMENTS"],
      ["Product", "Opening Stock", "Closing Stock", "Units Sold"],
      ...stockChanges.map(sc => [sc.name, sc.opening, sc.closing, sc.sold]),
      [],
      ["STAFF PERFORMANCE"],
      ["Staff", "Transactions", "Revenue"],
      ...staffPerf.map(sp => [sp.name, sp.txCount, sp.sales]),
    ];
    downloadCSV(`NOIR_Report_${selectedDate}.csv`, rows);
  };

  const exportSalesCSV = () => {
    const rows = [
      ["Receipt ID", "Date", "Time", "Served By", "Items", "Method", "Total (KSh)"],
      ...daySales.map(s => [
        s.id,
        s.timestamp.slice(0, 10),
        new Date(s.timestamp).toLocaleTimeString("en-KE"),
        s.servedBy,
        s.items.map(i => `${i.name} x${i.qty}`).join(" | "),
        s.method.toUpperCase(),
        s.total
      ])
    ];
    downloadCSV(`NOIR_Sales_${selectedDate}.csv`, rows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)" }}>
      <div className="rounded-2xl flex flex-col overflow-hidden" style={{
        background: "var(--background)", border: "1px solid var(--border)",
        width: "min(900px, 96vw)", height: "min(88vh, 900px)", fontFamily: "'DM Sans', sans-serif"
      }}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 glass-card" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-4">
            <p className="text-xl font-black uppercase tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>
              Daily Reports
            </p>
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "'DM Mono', monospace", outline: "none" }}>
              {sortedDays.map(d => <option key={d} value={d}>{d}</option>)}
              {sortedDays.length === 0 && <option value="">No closed days yet</option>}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {selectedDate && (
              <>
                <button onClick={exportSalesCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                  style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
                  <Download size={12} /> Sales CSV
                </button>
                <button onClick={exportReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110"
                  style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  <Download size={12} /> Full Report
                </button>
              </>
            )}
            <button onClick={onClose} className="ml-2" style={{ color: "var(--muted-foreground)" }}><X size={18} /></button>
          </div>
        </div>

        {!selectedDate ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: "var(--muted-foreground)" }}>
            <p className="text-sm">No closed days on record. Close a day first.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex flex-col gap-6">

              {/* Revenue breakdown */}
              <div>
                <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Revenue Breakdown</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    ["Cash", cashRev, "#34d399"],
                    ["M-Pesa", mpesaRev, "#38bdf8"],
                  ].map(([label, val, color]) => (
                    <div key={label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                      <p className="text-xs mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{label}</p>
                      <p className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif", color }}>{formatPrice(val)}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>
                        {totalRevenue ? ((val / totalRevenue) * 100).toFixed(0) : 0}% of total
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[
                    ["Total Revenue", formatPrice(totalRevenue), "var(--primary)"],
                    ["Total Expenses", formatPrice(totalExp), "#f87171"],
                    ["Net Revenue", formatPrice(totalRevenue - totalExp), "#22c55e"],
                  ].map(([label, val, color]) => (
                    <div key={label} className="rounded-xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                      <p className="text-xs mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{label}</p>
                      <p className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif", color }}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top items + Staff performance */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <p className="text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Top Selling Items</p>
                  {itemFreq.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No sales data</p>
                  ) : itemFreq.map(([name, qty], i) => (
                    <div key={name} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-5 text-right" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{i + 1}</span>
                        <span className="text-sm" style={{ color: "var(--foreground)" }}>{name}</span>
                      </div>
                      <span className="text-xs font-semibold" style={{ fontFamily: "'DM Mono', monospace", color: "var(--primary)" }}>{qty} sold</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <p className="text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Staff Performance</p>
                  {staffPerf.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No data</p>
                  ) : staffPerf.map((sp, i) => (
                    <div key={sp.name} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{ background: "#a78bfa22", color: "#a78bfa", border: "1px solid #a78bfa44" }}>
                          {sp.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{sp.name}</p>
                          <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{sp.txCount} tx</p>
                        </div>
                      </div>
                      <span className="font-bold text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>{formatPrice(sp.sales)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock movements */}
              {stockChanges.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <p className="text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Stock Movements</p>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {["Product", "Opening", "Closing", "Units Sold"].map(h => (
                      <p key={h} className="text-xs uppercase" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{h}</p>
                    ))}
                  </div>
                  {stockChanges.map(sc => (
                    <div key={sc.id} className="grid grid-cols-4 gap-2 py-2 border-t" style={{ borderColor: "var(--border)" }}>
                      <p className="text-sm" style={{ color: "var(--foreground)" }}>{sc.name}</p>
                      <p className="text-sm" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{sc.opening}</p>
                      <p className="text-sm" style={{ fontFamily: "'DM Mono', monospace", color: sc.closing < 10 ? "#f87171" : "var(--muted-foreground)" }}>{sc.closing}</p>
                      <p className="text-sm font-semibold" style={{ fontFamily: "'DM Mono', monospace", color: "var(--primary)" }}>{sc.sold}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Expenses list */}
              {dayExpenses.length > 0 && (
                <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <p className="text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Expenses ({dayExpenses.length})</p>
                  {dayExpenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                      <div>
                        <p className="text-sm" style={{ color: "var(--foreground)" }}>{e.desc}</p>
                        <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>
                          {e.category} · {e.recordedBy} · {new Date(e.timestamp).toLocaleTimeString("en-KE")}
                        </p>
                      </div>
                      <span className="font-bold text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#f87171" }}>{formatPrice(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyClosingReport;

// ─── EMPLOYEE POS ────────────────────────────────────────────────────────────

