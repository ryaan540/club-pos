export function buildReceiptHTML(sale, paperWidth = "80mm") {
  const subtotal = sale.subtotal ?? sale.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const fmt = (n) => `KSh ${Math.round(n).toLocaleString()}`;
  const methodLabel = ({ mpesa: "M-Pesa", card: "Card", split: "Split", cash: "Cash" })[sale.method] || sale.method || "Unknown";
  const receiptNum = String(sale.id).slice(-8).toUpperCase();
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

  const itemRows = sale.items.map(i => `
    <tr>
      <td class="item-name">${escapeHtml(i.name)}</td>
      <td class="item-qty">× ${i.qty}</td>
      <td class="item-price">${fmt(i.price * i.qty)}</td>
    </tr>
    <tr class="item-unit">
      <td colspan="3" class="unit-price">${fmt(i.price)} each${i.note ? ` · ${escapeHtml(i.note)}` : ""}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>NOIR Receipt #${receiptNum}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #fff;
    font-family: 'DM Sans', sans-serif;
    display: flex;
    justify-content: center;
    padding: 20px 0;
  }

  .receipt {
    width: 320px;
    background: #fff;
    padding: 28px 24px 32px;
  }

  /* ── header ── */
  .header { text-align: center; margin-bottom: 20px; }

  .brand {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 28px;
    font-weight: 900;
    letter-spacing: 0.2em;
    color: #1a1a1a;
    text-transform: uppercase;
  }

  .brand-bar {
    width: 40px;
    height: 3px;
    background: #1a1a1a;
    margin: 6px auto 10px;
  }

  .tagline {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    letter-spacing: 0.18em;
    color: #888;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .receipt-meta {
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    color: #666;
    line-height: 1.7;
  }

  .receipt-num {
    font-size: 11px;
    font-weight: 500;
    color: #1a1a1a;
    letter-spacing: 0.05em;
  }

  /* ── dividers ── */
  .divider {
    border: none;
    border-top: 1px dashed #ccc;
    margin: 14px 0;
  }

  .divider-solid {
    border: none;
    border-top: 1px solid #1a1a1a;
    margin: 14px 0;
  }

  /* ── items ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .item-name {
    font-weight: 500;
    color: #1a1a1a;
    padding: 4px 0 1px;
    width: 55%;
  }

  .item-qty {
    color: #666;
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    text-align: center;
    width: 20%;
  }

  .item-price {
    font-family: 'DM Mono', monospace;
    font-size: 11px;
    text-align: right;
    color: #1a1a1a;
    font-weight: 500;
    width: 25%;
  }

  .unit-price {
    font-family: 'DM Mono', monospace;
    font-size: 9.5px;
    color: #aaa;
    padding: 0 0 5px;
  }

  /* ── totals ── */
  .totals { margin: 4px 0; }

  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11.5px;
    font-family: 'DM Mono', monospace;
    color: #666;
    margin-bottom: 5px;
  }

  .total-row.grand {
    font-size: 15px;
    font-family: 'Barlow Condensed', sans-serif;
    font-weight: 900;
    color: #1a1a1a;
    letter-spacing: 0.05em;
    margin-top: 6px;
  }

  .total-row.grand .amount {
    font-size: 18px;
  }

  /* ── payment badge ── */
  .payment-section { margin: 6px 0; }

  .payment-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 4px;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border: 1px solid #1a1a1a;
    color: #1a1a1a;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-family: 'DM Mono', monospace;
    color: #888;
    margin-bottom: 4px;
  }

  .meta-row span:last-child { color: #1a1a1a; }

  /* ── footer ── */
  .footer { text-align: center; margin-top: 18px; }

  .footer-msg {
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: #1a1a1a;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .footer-sub {
    font-family: 'DM Mono', monospace;
    font-size: 9px;
    color: #bbb;
    letter-spacing: 0.06em;
  }

  /* ── print ── */
  @media print {
    body { padding: 0; }
    .receipt { width: 80mm; padding: 16px 14px 20px; }
    .receipt { width: ${paperWidth}; padding: 16px 4mm 20px; }
    @page { margin: 0; size: ${paperWidth} auto; }
  }
</style>
</head>
<body>
<div class="receipt">

  <div class="header">
    <div class="brand">NOIR</div>
    <div class="brand-bar"></div>
    <div class="tagline">Nairobi · Fine Drinks & Spirits</div>
    <div class="receipt-meta">
      <div class="receipt-num">Receipt #${receiptNum}</div>
      <div>${new Date(sale.timestamp).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}</div>
    </div>
  </div>

  <hr class="divider" />

  <table class="items-table">
    <tbody>${itemRows}</tbody>
  </table>

  <hr class="divider" />

  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>${fmt(subtotal)}</span>
    </div>
    ${sale.discount ? `<div class="total-row"><span>Discount</span><span>−${fmt(sale.discount)}</span></div>` : ""}
    ${sale.tip ? `<div class="total-row"><span>Tip</span><span>${fmt(sale.tip)}</span></div>` : ""}
    <div class="total-row grand">
      <span>TOTAL</span>
      <span class="amount">${fmt(sale.total)}</span>
    </div>
  </div>

  <hr class="divider-solid" />

  <div class="payment-section">
    <div class="meta-row" style="margin-bottom:8px;">
      <span>Payment method</span>
      <span><span class="payment-badge">${escapeHtml(methodLabel)}</span></span>
    </div>
    ${(sale.payments || []).map(payment => `<div class="meta-row"><span>${escapeHtml(({ mpesa: "M-Pesa", card: "Card", cash: "Cash" })[payment.method] || payment.method)}</span><span>${fmt(payment.amount)}</span></div>`).join("")}
    ${sale.change ? `<div class="meta-row"><span>Change</span><span>${fmt(sale.change)}</span></div>` : ""}
    <div class="meta-row">
      <span>Served by</span>
      <span>${escapeHtml(sale.servedBy)}</span>
    </div>
    <div class="meta-row">
      <span>Items</span>
      <span>${sale.items.reduce((s, i) => s + i.qty, 0)}</span>
    </div>
  </div>

  <hr class="divider" />

  <div class="footer">
    <div class="footer-msg">Thank you for visiting</div>
    <div class="footer-sub">noir.co.ke · +254 700 000 000</div>
    <div class="footer-sub" style="margin-top:4px;">Please drink responsibly</div>
  </div>

</div>
</body>
</html>`;
}

export function printReceipt(sale, paperWidth = "80mm") {
  const html = buildReceiptHTML(sale, paperWidth);
  const receiptWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!receiptWindow) return;
  receiptWindow.document.write(html);
  receiptWindow.document.close();
  receiptWindow.focus();
  receiptWindow.print();
}

