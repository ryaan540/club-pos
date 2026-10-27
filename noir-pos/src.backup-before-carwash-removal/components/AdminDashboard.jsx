import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Database, Download, DollarSign, FileText, Lock, Receipt, ShoppingCart, TrendingUp, Zap } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { todayKey, formatPrice, downloadCSV, now } from "../helpers.js";
import { SEED_PRODUCTS } from "../data.js";
import Topbar from "./Topbar.jsx";
import CloseDayModal from "./CloseDayModal.jsx";
import DailyClosingReport from "./DailyClosingReport.jsx";
import DataViewer from "./DataViewer.jsx";
import { useToast } from "./ToastProvider.jsx";
import { apiEnabled, apiRequest } from "../api.js";

function AdminDashboard({ user, sales, products, expenses, closedDays, onClosedDaysUpdate, users, setUsers, setProducts, onOpenPOS, onLogout }) {
  const [range, setRange] = useState("today");
  const [serverSummary, setServerSummary] = useState(null);
  const [summaryRange, setSummaryRange] = useState("");
  const [showCloseDay, setShowCloseDay] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showDataViewer, setShowDataViewer] = useState(false);

  useEffect(() => {
    if (!apiEnabled || range === "all") return undefined;
    let active = true;
    const period = range === "today" ? "daily" : range === "week" ? "weekly" : "monthly";
    apiRequest(`/api/reports/summary?period=${period}`)
      .then(summary => { if (active) { setServerSummary(summary); setSummaryRange(range); } })
      .catch(() => { if (active) { setServerSummary(null); setSummaryRange(range); } });
    return () => { active = false; };
  }, [range]);
  const currentSummary = summaryRange === range ? serverSummary : null;

  const filtered = useMemo(() => {
    const now2 = new Date();
    if (range === "today") return sales.filter(s => s.timestamp.slice(0, 10) === todayKey());
    if (range === "week") {
      const cutoff = new Date(now2); cutoff.setDate(cutoff.getDate() - 7);
      return sales.filter(s => new Date(s.timestamp) >= cutoff);
    }
    if (range === "month") {
      const cutoff = new Date(now2.getFullYear(), now2.getMonth(), 1);
      return sales.filter(s => new Date(s.timestamp) >= cutoff);
    }
    return sales;
  }, [sales, range]);

  const totalRevenue = currentSummary?.total ?? filtered.reduce((s, x) => s + x.total, 0);
  const totalTx = currentSummary?.sales_count ?? filtered.length;
  const avgTx = totalTx ? totalRevenue / totalTx : 0;
  const cashSales = filtered.filter(s => s.method === "cash").reduce((s, x) => s + x.total, 0);
  const mpesaSales = filtered.filter(s => s.method === "mpesa").reduce((s, x) => s + x.total, 0);
  const lowStock = products.filter(p => p.stock < 10);

  const itemFreq = {};
  filtered.forEach(s => s.items.forEach(i => { itemFreq[i.name] = (itemFreq[i.name] || 0) + i.qty; }));
  const topItems = currentSummary?.top_items || Object.entries(itemFreq).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const dailyMap = {};
  filtered.forEach(s => {
    const d = s.timestamp.slice(0, 10);
    dailyMap[d] = (dailyMap[d] || 0) + s.total;
  });
  const dailyData = Object.entries(dailyMap).sort().slice(-14).map(([date, total]) => ({
    date: date.slice(5), total: Math.round(total),
  }));

  const catRev = {};
  filtered.forEach(s => s.items.forEach(i => {
    const p = products.find(x => x.id === i.id);
    const cat = p ? p.category : "Unknown";
    catRev[cat] = (catRev[cat] || 0) + i.price * i.qty;
  }));
  const catData = Object.entries(catRev).sort((a, b) => b[1] - a[1]).map(([cat, total]) => ({ cat, total: Math.round(total) }));

  const statCards = [
    { label: "Total Revenue", value: formatPrice(totalRevenue), icon: TrendingUp, color: "var(--primary)" },
    { label: "Transactions", value: totalTx, icon: Receipt, color: "#a78bfa" },
    { label: "Avg. Order", value: formatPrice(avgTx), icon: DollarSign, color: "#34d399" },
    { label: "Low Stock Items", value: lowStock.length, icon: AlertCircle, color: lowStock.length > 0 ? "#f87171" : "#34d399" },
  ];

  const handleCloseDay = (date, prods, salesToday) => {
    const sortedPrev = Object.keys(closedDays).filter(d => d < date).sort();
    const prevDay = sortedPrev[sortedPrev.length - 1];
    const openingStock = prevDay
      ? closedDays[prevDay].closingStock
      : prods.map(p => {
          const soldToday = salesToday.reduce((sum, s) => {
            const item = s.items.find(i => i.id === p.id);
            return sum + (item ? item.qty : 0);
          }, 0);
          return { id: p.id, name: p.name, stock: p.stock + soldToday };
        });
    const closingStock = prods.map(p => ({ id: p.id, name: p.name, stock: p.stock }));
    const updated = {
      ...closedDays,
      [date]: { closedAt: now(), closedBy: user.name, openingStock, closingStock, salesCount: salesToday.length, totalRevenue: salesToday.reduce((s, x) => s + x.total, 0) }
    };
    onClosedDaysUpdate(updated);
    setShowCloseDay(false);
  };

  const exportAllSales = () => {
    const rows = [
      ["Receipt ID", "Date", "Time", "Served By", "Items", "Method", "Total (KSh)"],
      ...sales.map(s => [
        s.id, s.timestamp.slice(0, 10),
        new Date(s.timestamp).toLocaleTimeString("en-KE"),
        s.servedBy, s.items.map(i => `${i.name} x${i.qty}`).join(" | "),
        s.method.toUpperCase(), s.total
      ])
    ];
    downloadCSV(`NOIR_AllSales_${todayKey()}.csv`, rows);
  };

  const showToast = useToast();

  const resetProducts = () => {
    if (!setProducts) return;
    if (!window.confirm("Reset products to seed data? This will overwrite current products.")) return;
    setProducts(SEED_PRODUCTS);
    showToast("Products reset to seed data.", "success");
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--background)" }}>
      <Topbar user={user} onLogout={onLogout} title="Analytics" />
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0 glass-card" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.05)" }}>
        <div className="flex gap-1">
          {[ ["today", "Today"], ["week", "Week"], ["month", "Month"], ["all", "All Time"] ].map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all"
              style={{
                fontFamily: "'DM Mono', monospace",
                background: range === k ? "var(--primary)" : "var(--secondary)",
                color: range === k ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}>{l}</button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={onOpenPOS}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-110"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "var(--primary)", color: "var(--primary-foreground)" }}>
              <ShoppingCart size={14} /> Open POS
            </button>
            <button onClick={exportAllSales}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-110"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              <Download size={14} /> Export Sales
            </button>
            <button onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-110"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              <FileText size={14} /> Reports
            </button>
            <button onClick={() => setShowDataViewer(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-110"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              <Database size={14} /> View Data
            </button>
            <button onClick={resetProducts}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-110"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
              <Zap size={14} /> Reset Products
            </button>
            <button onClick={() => setShowCloseDay(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-110"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", background: closedDays[todayKey()] ? "rgba(248,113,113,0.15)" : "#f5a623", color: closedDays[todayKey()] ? "#f87171" : "#0d0c0f", border: closedDays[todayKey()] ? "1px solid rgba(248,113,113,0.4)" : "none" }}>
              <Lock size={14} /> {closedDays[todayKey()] ? "Day Closed" : "Close Day"}
            </button>
          </div>
          <p className="text-xs" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
            Product data is loaded from browser storage. If you change the seed list in source code, use Reset Products and reload the page.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl p-5 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{label}</p>
                  <Icon size={16} style={{ color }} />
                </div>
                <p className="text-2xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif", color, letterSpacing: "0.02em" }}>{value}</p>
              </div>
            ))}
          </div>

          {currentSummary && <div className="grid gap-4 md:grid-cols-2">
            <section className="border border-white/10 bg-white/[0.035] p-5">
              <p className="mb-4 text-xs uppercase tracking-widest text-white/50">Revenue by department</p>
              {[ ["Club / Bar", currentSummary.by_department.club], ["Car Wash", currentSummary.by_department.car_wash] ].map(([label, value]) => <div key={label} className="flex justify-between border-t border-white/10 py-3 text-sm"><span className="text-white/70">{label}</span><strong>{formatPrice(value)}</strong></div>)}
            </section>
            <section className="border border-white/10 bg-white/[0.035] p-5">
              <p className="mb-4 text-xs uppercase tracking-widest text-white/50">Wash revenue and commission</p>
              {Object.entries(currentSummary.revenue_by_attendant).map(([name, revenue]) => <div key={name} className="flex justify-between border-t border-white/10 py-3 text-sm"><span className="text-white/70">{name}</span><span>{formatPrice(revenue)} · {formatPrice(currentSummary.commission_by_attendant[name] || 0)} commission</span></div>)}
              {!Object.keys(currentSummary.revenue_by_attendant).length && <p className="text-sm text-white/45">No collected wash jobs in this period</p>}
            </section>
            <section className="border border-white/10 bg-white/[0.035] p-5 md:col-span-2">
              <p className="mb-4 text-xs uppercase tracking-widest text-white/50">Busiest hours by revenue</p>
              <div className="flex flex-wrap gap-2">{currentSummary.busiest_hours.map(([hour, revenue]) => <span key={hour} className="border border-white/10 px-3 py-2 text-sm">{hour} <strong className="ml-2">{formatPrice(revenue)}</strong></span>)}{!currentSummary.busiest_hours.length && <span className="text-sm text-white/45">No sales in this period</span>}</div>
            </section>
          </div>}

          {/* Payment split — now includes M-Pesa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Payment Split</p>
              <div className="flex flex-col gap-3">
                {[["Cash", cashSales, "#34d399"], ["M-Pesa", mpesaSales, "#38bdf8"]].map(([label, val, color]) => {
                  const pct = totalRevenue ? (val / totalRevenue) * 100 : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
                        <span style={{ fontFamily: "'DM Mono', monospace", color }}>{formatPrice(val)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: "var(--secondary)" }}>
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Top Selling Items</p>
              {topItems.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>No sales data yet</p>
              ) : topItems.map(([name, qty], i) => (
                <div key={name} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{i + 1}</span>
                    <span className="text-sm" style={{ color: "var(--foreground)" }}>{name}</span>
                  </div>
                  <span className="text-xs font-semibold" style={{ fontFamily: "'DM Mono', monospace", color: "var(--primary)" }}>{qty} sold</span>
                </div>
              ))}
            </div>
          </div>

          {dailyData.length > 1 && (
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Daily Revenue (KSh)</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontFamily: "'DM Mono', monospace", fontSize: 12 }} />
                  <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {catData.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="text-xs uppercase tracking-widest mb-4" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Revenue by Category</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={catData} barSize={28}>
                  <XAxis dataKey="cat" tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)", fontFamily: "'DM Mono', monospace", fontSize: 12 }} />
                  <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-widest mb-3" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
              Sales Log ({filtered.length} records)
            </p>
            <div className="flex flex-col gap-2">
              {filtered.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: "var(--muted-foreground)" }}>No sales in this period</p>
              )}
              {filtered.slice(0, 50).map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {s.items.map(i => i.name).slice(0, 2).join(", ")}{s.items.length > 2 ? ` +${s.items.length - 2}` : ""}
                    </p>
                    <p className="text-xs mt-0.5" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
                      {new Date(s.timestamp).toLocaleString("en-KE")} · {s.servedBy} · <span style={{ color: s.method === "mpesa" ? "#38bdf8" : s.method === "cash" ? "#34d399" : "#a78bfa", textTransform: "uppercase" }}>{s.method}</span>
                    </p>
                  </div>
                  <span className="font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)", fontSize: "1.05rem" }}>{formatPrice(s.total)}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {showCloseDay && (
        <CloseDayModal
          products={products} sales={sales} expenses={expenses} closedDays={closedDays}
          onClose={() => setShowCloseDay(false)}
          onConfirm={handleCloseDay}
        />
      )}
      {showReport && (
        <DailyClosingReport
          closedDays={closedDays} sales={sales} products={products} expenses={expenses} users={users}
          onClose={() => setShowReport(false)}
        />
      )}
      {showDataViewer && (
        <DataViewer
          users={users} setUsers={setUsers} products={products} sales={sales} expenses={expenses} closedDays={closedDays}
          onClose={() => setShowDataViewer(false)}
        />
      )}
    </div>
  );
}
export default AdminDashboard;
// ─── ROOT ─────────────────────────────────────────────────────────────────────

