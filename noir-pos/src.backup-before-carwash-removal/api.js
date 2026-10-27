const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "noir_api_token";
const PENDING_SALES_KEY = "noir_pending_sales";

export const apiEnabled = Boolean(API_BASE);

export function resolveProductImage(url) {
  if (url?.startsWith("/uploads/") && API_BASE) return `${API_BASE}${url}`;
  return url;
}

export function setApiToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export function loginWithApi(name, pin) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ name, pin }),
  });
}

export async function syncSaleToApi(sale) {
  if (!apiEnabled) return false;
  const queue = JSON.parse(localStorage.getItem(PENDING_SALES_KEY) || "[]");
  if (!queue.some(item => item.client_id === sale.clientId)) {
    queue.push({
      client_id: sale.clientId,
      items: sale.items.map(item => ({ ...item, qty: item.qty })),
      total: sale.total,
      method: sale.method,
      payments: sale.payments,
      discount: sale.discount || 0,
      tip: sale.tip || 0,
      customer: sale.customer || "",
      phone: sale.phone || "",
      notes: sale.notes || "",
      servedBy: sale.servedBy,
      department: sale.department || "club",
      discountApprovalToken: sale.discountApprovalToken || "",
    });
    localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(queue));
  }
  return flushPendingSales();
}

export async function flushPendingSales() {
  if (!apiEnabled || !navigator.onLine) return false;
  const queue = JSON.parse(localStorage.getItem(PENDING_SALES_KEY) || "[]");
  if (!queue.length) return true;
  const remaining = [];
  for (const sale of queue) {
    try {
      await apiRequest("/api/sales", { method: "POST", body: JSON.stringify(sale) });
    } catch {
      remaining.push(sale);
    }
  }
  localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(remaining));
  return remaining.length === 0;
}