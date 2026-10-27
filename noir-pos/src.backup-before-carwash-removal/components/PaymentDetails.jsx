import { useState } from "react";
import { Banknote, ChevronRight, CreditCard, Smartphone } from "lucide-react";
import { apiEnabled, apiRequest } from "../api.js";
import { formatPrice } from "../helpers.js";

export default function PaymentDetails({ cart, total, users, paymentMethod, setPaymentMethod, onBack, onConfirm }) {
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [cashReceived, setCashReceived] = useState(String(total));
  const [tip, setTip] = useState("0");
  const [discountValue, setDiscountValue] = useState("0");
  const [discountType, setDiscountType] = useState("percent");
  const [managerName, setManagerName] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [cashSplit, setCashSplit] = useState("0");
  const [mpesaSplit, setMpesaSplit] = useState("0");
  const [cardSplit, setCardSplit] = useState("0");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rawDiscount = Math.max(0, Number(discountValue) || 0);
  const discount = Math.min(total, discountType === "percent" ? Math.round(total * Math.min(rawDiscount, 100) / 100) : Math.round(rawDiscount));
  const tipAmount = Math.max(0, Math.round(Number(tip) || 0));
  const amountDue = total - discount + tipAmount;
  const splitTotal = (Number(cashSplit) || 0) + (Number(mpesaSplit) || 0) + (Number(cardSplit) || 0);
  const change = paymentMethod === "cash" ? Math.max(0, (Number(cashReceived) || 0) - amountDue) : 0;

  const handleConfirm = async () => {
    setError("");
    if (paymentMethod === "mpesa" && (!phone || phone.length < 8)) return setError("Enter a valid phone number for M-Pesa.");
    if (paymentMethod === "cash" && Number(cashReceived) < amountDue) return setError("Cash received is less than the amount due.");
    if (paymentMethod === "split" && splitTotal < amountDue) return setError("Split payments must cover the amount due.");
    let approvalToken = "";
    if (discount > 0) {
      if (!managerName || managerPin.length < 4) return setError("Manager approval is required for a discount.");
      if (apiEnabled) {
        setBusy(true);
        try {
          const approval = await apiRequest("/api/auth/discount-approval", {
            method: "POST", body: JSON.stringify({ name: managerName, pin: managerPin }),
          });
          approvalToken = approval.approval_token;
        } catch (approvalError) {
          setBusy(false);
          return setError(approvalError.message);
        }
        setBusy(false);
      } else {
        const manager = users.find(person => person.name === managerName && ["admin", "manager"].includes(person.role));
        if (!manager || manager.pin !== managerPin) return setError("Manager PIN was not approved.");
      }
    }
    const payments = paymentMethod === "split"
      ? [{ method: "cash", amount: Number(cashSplit) || 0 }, { method: "mpesa", amount: Number(mpesaSplit) || 0 }, { method: "card", amount: Number(cardSplit) || 0 }].filter(payment => payment.amount > 0)
      : [{ method: paymentMethod, amount: paymentMethod === "cash" ? Number(cashReceived) || 0 : amountDue }];
    setBusy(true);
    try {
      await onConfirm({
        customer, phone, notes, subtotal: total, discount, discountRequest: discount > 0 ? { type: discountType, value: rawDiscount } : 0,
        tip: tipAmount, total: amountDue, method: paymentMethod, payments, change,
        discountApprovalToken: approvalToken, discountApprovedBy: managerName,
      });
    } catch (confirmError) {
      setError(confirmError.message || "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>← Back</button>
      <div>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Total due</p>
        <p className="text-5xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>{formatPrice(amountDue)}</p>
      </div>

      <div className="rounded-2xl p-4 flex flex-col gap-2 text-sm" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex justify-between">
          <span style={{ color: "var(--muted-foreground)" }}>Items</span>
          <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)", fontWeight: 600 }}>{cart.length} item{cart.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="mt-2 space-y-2">
          {cart.map(i => (
            <div key={i.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm truncate" style={{ color: "var(--foreground)" }}>{i.name} × {i.qty}</p>
              </div>
              <div className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{formatPrice(i.price * i.qty)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: "var(--secondary)" }}>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
          Payment method
        </p>
        <div className="flex gap-2 mt-2">
          <button onClick={() => setPaymentMethod("cash")}
            className={`flex-1 py-3 rounded-2xl ${paymentMethod === "cash" ? "font-black" : "font-medium"}`}
            style={{ background: paymentMethod === "cash" ? "linear-gradient(135deg, var(--primary), #f59e0b)" : "rgba(255,255,255,0.02)", color: "var(--foreground)" }}>
            <Banknote className="mx-auto mb-1" size={16} /> Cash
          </button>
          <button onClick={() => setPaymentMethod("mpesa")}
            className={`flex-1 py-3 rounded-2xl ${paymentMethod === "mpesa" ? "font-black" : "font-medium"}`}
            style={{ background: paymentMethod === "mpesa" ? "linear-gradient(135deg, #38bdf8, #0ea5e9)" : "rgba(255,255,255,0.02)", color: "#38bdf8" }}>
            <Smartphone className="mx-auto mb-1" size={16} /> M-Pesa
          </button>
          <button onClick={() => setPaymentMethod("card")}
            className={`flex-1 py-3 rounded-2xl ${paymentMethod === "card" ? "font-black" : "font-medium"}`}
            style={{ background: paymentMethod === "card" ? "linear-gradient(135deg, #34d399, #059669)" : "rgba(255,255,255,0.02)", color: "#6ee7b7" }}>
            <CreditCard className="mx-auto mb-1" size={16} /> Card
          </button>
          <button onClick={() => setPaymentMethod("split")}
            className={`flex-1 py-3 rounded-2xl ${paymentMethod === "split" ? "font-black" : "font-medium"}`}
            style={{ background: paymentMethod === "split" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.02)", color: "var(--foreground)" }}>
            Split
          </button>
        </div>
      </div>

      <div className="rounded-2xl border p-4" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between gap-3">
          <label className="flex-1 text-xs uppercase tracking-widest text-white/50">Discount</label>
          <select value={discountType} onChange={event => setDiscountType(event.target.value)} className="bg-[#1b1b24] px-2 py-1 text-xs text-white"><option value="percent">Percent</option><option value="fixed">Fixed KSh</option></select>
          <input type="number" min="0" value={discountValue} onChange={event => setDiscountValue(event.target.value)} className="w-20 bg-white/[0.05] px-2 py-1 text-right text-sm text-white" />
        </div>
        {discount > 0 && <div className="mt-3 grid grid-cols-2 gap-2"><select value={managerName} onChange={event => setManagerName(event.target.value)} className="bg-[#1b1b24] px-2 py-2 text-sm text-white"><option value="">Manager approval</option>{users.filter(person => ["admin", "manager"].includes(person.role)).map(person => <option key={person.id} value={person.name}>{person.name}</option>)}</select><input type="password" value={managerPin} onChange={event => setManagerPin(event.target.value)} placeholder="Manager PIN" className="bg-white/[0.05] px-2 py-2 text-sm text-white" /></div>}
        <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs text-white/70">Tip (KSh)<input type="number" min="0" value={tip} onChange={event => setTip(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-white/10 bg-noir-950 px-3 py-2 text-sm text-white" /></label>{paymentMethod === "cash" && <label className="text-xs text-white/70">Cash received<input type="number" min={amountDue} value={cashReceived} onChange={event => setCashReceived(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-white/10 bg-noir-950 px-3 py-2 text-sm text-white" /></label>}</div>
        {paymentMethod === "cash" && <div className="mt-3 grid grid-cols-4 gap-2">{[amountDue, 500, 1000, 2000].map((amount, index) => <button key={`${amount}-${index}`} onClick={() => setCashReceived(String(amount))} className="min-h-10 rounded-control border border-white/10 text-xs font-semibold text-noir-100 transition hover:border-violet-400/40 hover:bg-noir-850">{index === 0 ? "Exact" : formatPrice(amount).replace("KSh ", "")}</button>)}</div>}
        {paymentMethod === "split" && <div className="mt-3 grid grid-cols-3 gap-2">{[["Cash", cashSplit, setCashSplit], ["M-Pesa", mpesaSplit, setMpesaSplit], ["Card", cardSplit, setCardSplit]].map(([label, value, setter]) => <label key={label} className="text-xs text-white/45">{label}<input type="number" min="0" value={value} onChange={event => setter(event.target.value)} className="mt-1 w-full bg-white/[0.05] px-2 py-2 text-sm text-white" /></label>)}</div>}
        <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-sm"><span className="text-white/70">{change > 0 ? "Change due" : "Amount due"}</span><strong className={change > 0 ? "text-status-success" : "text-white"}>{formatPrice(change > 0 ? change : amountDue)}</strong></div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
        <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Customer name</label>
        <input value={customer} onChange={e => setCustomer(e.target.value)} className="w-full px-3 py-2 rounded-2xl text-sm mb-3" style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }} />

        <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Phone (for M-Pesa)</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-2xl text-sm mb-3" style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }} />

        <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-3 py-2 rounded-2xl text-sm" style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
      </div>

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <button disabled={busy} onClick={() => void handleConfirm()}
        className="mt-auto rounded-xl py-4 font-black uppercase tracking-widest text-lg flex items-center justify-center gap-2 transition-all active:scale-95 hover:brightness-110"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#22c55e", color: "#0d1a10" }}>
        {busy ? "Verifying…" : "Confirm Payment"} <ChevronRight size={20} />
      </button>
    </div>
  );
}
