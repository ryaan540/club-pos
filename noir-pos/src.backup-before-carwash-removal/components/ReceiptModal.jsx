import { useState } from "react";
import { X, Printer } from "lucide-react";
import { formatPrice } from "../helpers.js";
import { printReceipt } from "../receipt.js";

function ReceiptModal({ sale, onClose }) {
  const [paperWidth, setPaperWidth] = useState("80mm");
  if (!sale) return null;
  const subtotal = sale.subtotal ?? sale.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const methodLabel = ({ mpesa: "M-Pesa", card: "Card", split: "Split", cash: "Cash" })[sale.method] || sale.method || "Unknown";
  const methodColor = sale.method === "mpesa" ? "#38bdf8" : sale.method === "card" ? "#34d399" : "#f5a623";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl w-80 flex flex-col overflow-hidden relative"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}>

        {/* modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.06)" }}>
          <p className="font-black uppercase tracking-widest text-base" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>
            Receipt
          </p>
          <button onClick={onClose} style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
        </div>

        {/* receipt preview */}
        <div className="px-6 py-5 flex flex-col gap-0" style={{ fontFamily: "'DM Mono', monospace" }}>

          {/* brand */}
          <div className="text-center mb-4">
            <p className="text-2xl font-black tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>NOIR</p>
            <div style={{ width: 32, height: 2, background: "var(--primary)", margin: "5px auto 8px" }} />
            <p className="text-xs" style={{ color: "var(--muted-foreground)", letterSpacing: "0.12em" }}>Nairobi · Fine Drinks & Spirits</p>
            <p className="text-xs mt-2 font-medium" style={{ color: "var(--foreground)" }}>#{String(sale.id).slice(-8).toUpperCase()}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{new Date(sale.timestamp).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>

          <div className="border-t border-dashed mb-3" style={{ borderColor: "var(--border)" }} />

          {/* items */}
          <div className="flex flex-col gap-1.5 mb-3">
            {sale.items.map(i => (
              <div key={i.id}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{i.name}</span>
                  <span style={{ color: "var(--foreground)" }}>{formatPrice(i.price * i.qty)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--muted-foreground)" }}>× {i.qty} @ {formatPrice(i.price)}</span>
                </div>
                {i.note && <p className="text-[11px] text-white/45">{i.note}</p>}
              </div>
            ))}
          </div>

          <div className="border-t border-dashed mb-3" style={{ borderColor: "var(--border)" }} />

          {/* totals */}
          <div className="flex flex-col gap-1 text-xs mb-3">
            <div className="flex justify-between"><span style={{ color: "var(--muted-foreground)" }}>Subtotal</span><span style={{ color: "var(--foreground)" }}>{formatPrice(subtotal)}</span></div>
            {!!sale.discount && <div className="flex justify-between"><span style={{ color: "var(--muted-foreground)" }}>Discount</span><span style={{ color: "var(--foreground)" }}>−{formatPrice(sale.discount)}</span></div>}
            {!!sale.tip && <div className="flex justify-between"><span style={{ color: "var(--muted-foreground)" }}>Tip</span><span style={{ color: "var(--foreground)" }}>{formatPrice(sale.tip)}</span></div>}
            <div className="flex justify-between items-center pt-2 border-t mt-1" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>Total</span>
              <span className="text-xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>{formatPrice(sale.total)}</span>
            </div>
          </div>

          <div className="border-t border-solid mb-3" style={{ borderColor: "var(--foreground)", opacity: 0.15 }} />

          {/* meta */}
          <div className="flex flex-col gap-1.5 text-xs mb-1">
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--muted-foreground)" }}>Payment</span>
              <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: methodColor + "20", color: methodColor, border: `1px solid ${methodColor}40` }}>{methodLabel}</span>
            </div>
            {(sale.payments || []).map((payment, index) => <div key={`${payment.method}-${index}`} className="flex justify-between"><span style={{ color: "var(--muted-foreground)" }}>{({ mpesa: "M-Pesa", card: "Card", cash: "Cash" })[payment.method] || payment.method}</span><span style={{ color: "var(--foreground)" }}>{formatPrice(payment.amount)}</span></div>)}
            {!!sale.change && <div className="flex justify-between"><span style={{ color: "var(--muted-foreground)" }}>Change</span><span style={{ color: "var(--foreground)" }}>{formatPrice(sale.change)}</span></div>}
            <div className="flex justify-between"><span style={{ color: "var(--muted-foreground)" }}>Served by</span><span style={{ color: "var(--foreground)" }}>{sale.servedBy}</span></div>
            <div className="flex justify-between"><span style={{ color: "var(--muted-foreground)" }}>Items</span><span style={{ color: "var(--foreground)" }}>{sale.items.reduce((s, i) => s + i.qty, 0)}</span></div>
          </div>

          <div className="border-t border-dashed mt-3 mb-3" style={{ borderColor: "var(--border)" }} />

          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>Thank you for visiting</p>
            <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>Please drink responsibly</p>
          </div>
        </div>

        {/* action buttons */}
        <div className="flex gap-2 px-5 pb-5">
          <select aria-label="Receipt paper width" value={paperWidth} onChange={event => setPaperWidth(event.target.value)} className="border border-white/10 bg-[#17171e] px-2 text-xs text-white"><option value="58mm">58 mm</option><option value="80mm">80 mm</option></select>
          <button onClick={() => printReceipt(sale, paperWidth)}
            className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-95"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "var(--primary)", color: "var(--primary-foreground)" }}>
            <Printer size={15} /> Print / PDF
          </button>
          <button onClick={onClose}
            className="px-4 py-3 rounded-xl text-sm transition-all hover:brightness-110"
            style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

export default ReceiptModal;

// ─── CLOSE DAY MODAL ─────────────────────────────────────────────────────────

