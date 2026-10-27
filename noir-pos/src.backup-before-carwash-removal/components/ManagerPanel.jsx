import { useEffect, useState } from "react";
import { AlertCircle, Archive, FileText, ImagePlus, Lock, Package, Plus, RefreshCw, Tag, Trash2, UserPlus, Users } from "lucide-react";
import { SEED_CATEGORIES } from "../data.js";
import { STORAGE_KEYS, formatPrice, now, todayKey, useLocalState } from "../helpers.js";
import CloseDayModal from "./CloseDayModal.jsx";
import DailyClosingReport from "./DailyClosingReport.jsx";
import Topbar from "./Topbar.jsx";
import { apiEnabled, apiRequest } from "../api.js";

function ManagerPanel({ user, products, setProducts, users, setUsers, sales, expenses, closedDays, onClosedDaysUpdate, onLogout }) {
  const [tab, setTab] = useState("stock");
  const [categories, setCategories] = useLocalState(STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES);
  const [newProduct, setNewProduct] = useState({ name: "", price: "", category: categories[0], sub: "", stock: "", happyHourPrice: "", happyHourStart: "", happyHourEnd: "" });
  const [newCat, setNewCat] = useState("");
  const [newUser, setNewUser] = useState({ name: "", role: "bartender", pin: "", email: "" });
  const [productImage, setProductImage] = useState(null);
  const [importCsv, setImportCsv] = useState(null);
  const [importImages, setImportImages] = useState(null);
  const [resetPin, setResetPin] = useState({ userId: null, pin: "" });
  const [msg, setMsg] = useState("");
  const [showCloseDay, setShowCloseDay] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [suppliers, setSuppliers] = useLocalState("noir_suppliers", []);
  const [stockMovements, setStockMovements] = useLocalState("noir_stock_movements", []);
  const [restockForm, setRestockForm] = useState({ productId: "", quantity: "", supplier: "", note: "" });
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "" });

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  useEffect(() => {
    if (!apiEnabled) return undefined;
    let active = true;
    Promise.all([apiRequest("/api/suppliers"), apiRequest("/api/inventory/movements")])
      .then(([serverSuppliers, movements]) => {
        if (!active) return;
        setSuppliers(serverSuppliers);
        setStockMovements(movements);
      })
      .catch(error => setMsg(error.message));
    return () => { active = false; };
  }, [setStockMovements, setSuppliers]);

  const saveProduct = async () => {
    if (!newProduct.name || !newProduct.price) return;
    try {
      let product = apiEnabled
        ? await apiRequest("/api/products", {
            method: "POST",
            body: JSON.stringify({
              ...newProduct, price: Number(newProduct.price), stock: Number(newProduct.stock) || 0,
              is_service: ["Car Wash", "Pool"].includes(newProduct.category),
              happy_hour_price: newProduct.happyHourPrice ? Number(newProduct.happyHourPrice) : null,
              happy_hour_start: newProduct.happyHourStart || null,
              happy_hour_end: newProduct.happyHourEnd || null,
            }),
          })
        : { id: Date.now(), ...newProduct, price: Number(newProduct.price), stock: Number(newProduct.stock) || 0 };
      if (productImage && apiEnabled) {
        const formData = new FormData();
        formData.append("image", productImage);
        product = await apiRequest(`/api/products/${product.id}/image`, { method: "POST", body: formData });
      }
      setProducts(previous => [...previous, { ...product, image: product.image_url || "" }]);
      setNewProduct({ name: "", price: "", category: categories[0], sub: "", stock: "", happyHourPrice: "", happyHourStart: "", happyHourEnd: "" });
      setProductImage(null);
      flash("Product added.");
    } catch (error) {
      flash(error.message);
    }
  };

  const updateStock = (id, val) => setProducts(prev => prev.map(p => p.id === id ? { ...p, stock: Math.max(0, parseInt(val) || 0) } : p));
  const persistStock = async id => {
    if (!apiEnabled) return;
    const product = products.find(item => item.id === id);
    if (!product) return;
    try {
      const updated = await apiRequest(`/api/products/${id}`, {
        method: "PATCH", body: JSON.stringify({ stock: product.stock }),
      });
      setProducts(previous => previous.map(item => item.id === id ? { ...updated, image: updated.image_url || "" } : item));
    } catch (error) {
      flash(error.message);
    }
  };
  const deleteProduct = async id => {
    try {
      if (apiEnabled) await apiRequest(`/api/products/${id}`, { method: "DELETE" });
      setProducts(previous => previous.filter(p => p.id !== id));
    } catch (error) {
      flash(error.message);
    }
  };

  const recordRestock = async () => {
    const quantity = Number(restockForm.quantity);
    if (!restockForm.productId || quantity <= 0) return;
    const productId = Number(restockForm.productId);
    try {
      if (apiEnabled) {
        const result = await apiRequest("/api/inventory/restock", {
          method: "POST",
          body: JSON.stringify({ product_id: productId, quantity, supplier: restockForm.supplier, note: restockForm.note }),
        });
        setProducts(previous => previous.map(product => product.id === productId ? { ...result.product, image: result.product.image_url || "" } : product));
        setStockMovements(await apiRequest("/api/inventory/movements"));
      } else {
        const product = products.find(item => item.id === productId);
        setProducts(previous => previous.map(item => item.id === productId ? { ...item, stock: item.stock + quantity } : item));
        setStockMovements(previous => [{
          id: crypto.randomUUID(), product_id: productId, product: product?.name || "Product",
          quantity, supplier: restockForm.supplier, note: restockForm.note,
          created_at: now(), recorded_by: user.name,
        }, ...previous]);
      }
      setRestockForm({ productId: "", quantity: "", supplier: "", note: "" });
      flash("Stock restocked.");
    } catch (error) {
      flash(error.message);
    }
  };

  const saveSupplier = async () => {
    if (!supplierForm.name.trim()) return;
    try {
      const supplier = apiEnabled
        ? await apiRequest("/api/suppliers", { method: "POST", body: JSON.stringify(supplierForm) })
        : { ...supplierForm, id: crypto.randomUUID() };
      setSuppliers(previous => [...previous, supplier]);
      setSupplierForm({ name: "", phone: "", email: "" });
      flash("Supplier saved.");
    } catch (error) {
      flash(error.message);
    }
  };

  const importProductFiles = async () => {
    if (!apiEnabled || !importCsv) return;
    const formData = new FormData();
    formData.append("csv", importCsv);
    if (importImages) formData.append("images", importImages);
    try {
      const result = await apiRequest("/api/products/import", { method: "POST", body: formData });
      const catalog = await apiRequest("/api/products");
      setProducts(catalog.map(product => ({ ...product, price: product.current_price ?? product.price, image: product.image_url || "" })));
      setImportCsv(null);
      setImportImages(null);
      flash(`Imported ${result.imported} products.`);
    } catch (error) {
      flash(error.message);
    }
  };

  const replaceProductImage = async (product, file) => {
    if (!file || !apiEnabled) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const updated = await apiRequest(`/api/products/${product.id}/image`, { method: "POST", body: formData });
      setProducts(previous => previous.map(item => item.id === product.id ? { ...updated, image: updated.image_url } : item));
      flash(`Image updated for ${product.name}.`);
    } catch (error) {
      flash(error.message);
    }
  };

  const addCategory = () => {
    if (!newCat || categories.includes(newCat)) return;
    setCategories(prev => [...prev, newCat]);
    setNewCat("");
    flash("Category added.");
  };

  const addEmployee = async () => {
    if (!newUser.name || !newUser.pin) return;
    try {
      const employee = apiEnabled
        ? await apiRequest("/api/users", { method: "POST", body: JSON.stringify(newUser) })
        : { id: Date.now(), ...newUser };
      setUsers(previous => [...previous, employee]);
      setNewUser({ name: "", role: "bartender", pin: "", email: "" });
      flash("Employee added.");
    } catch (error) {
      flash(error.message);
    }
  };

  const doResetPin = (uid) => {
    if (!resetPin.pin) return;
    setUsers(prev => prev.map(u => u.id === uid ? { ...u, pin: resetPin.pin } : u));
    setResetPin({ userId: null, pin: "" });
    flash("PIN reset.");
  };

  const handleCloseDay = (date, prods, salesToday) => {
    // get opening stock (previous closed day's closing stock, or current)
    const sortedPrev = Object.keys(closedDays).filter(d => d < date).sort();
    const prevDay = sortedPrev[sortedPrev.length - 1];
    const openingStock = prevDay
      ? closedDays[prevDay].closingStock
      : prods.map(p => {
          // calculate opening stock = current stock + units sold today
          const soldToday = salesToday.reduce((sum, s) => {
            const item = s.items.find(i => i.id === p.id);
            return sum + (item ? item.qty : 0);
          }, 0);
          return { id: p.id, name: p.name, stock: p.stock + soldToday };
        });

    const closingStock = prods.map(p => ({ id: p.id, name: p.name, stock: p.stock }));
    const updated = {
      ...closedDays,
      [date]: {
        closedAt: now(),
        closedBy: user.name,
        openingStock,
        closingStock,
        salesCount: salesToday.length,
        totalRevenue: salesToday.reduce((s, x) => s + x.total, 0),
      }
    };
    onClosedDaysUpdate(updated);
    setShowCloseDay(false);
    flash(`Day ${date} closed.`);
  };

  const tabs = [["stock", Package, "Stock"], ["products", Tag, "Products"], ["categories", Tag, "Categories"], ["employees", Users, "Employees"]];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--background)" }}>
      <Topbar user={user} onLogout={onLogout} title="Management" />
      <div className="flex items-center justify-between gap-1 px-4 py-2 border-b shrink-0 glass-card" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.05)" }}>
        <div className="flex gap-1">
          {tabs.map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-semibold transition-all"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em", fontSize: "0.9rem",
                background: tab === key ? "#a78bfa" : "transparent",
                color: tab === key ? "#0d0c0f" : "var(--muted-foreground)",
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowReport(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-110"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}>
            <FileText size={14} /> Reports
          </button>
          <button onClick={() => setShowCloseDay(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-sm font-semibold transition-all hover:brightness-110"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", background: closedDays[todayKey()] ? "rgba(248,113,113,0.15)" : "#f5a623", color: closedDays[todayKey()] ? "#f87171" : "#0d0c0f", border: closedDays[todayKey()] ? "1px solid rgba(248,113,113,0.4)" : "none" }}>
            <Lock size={14} /> {closedDays[todayKey()] ? "Day Closed" : "Close Day"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-semibold z-50"
          style={{ background: "#22c55e", color: "#0d1a10" }}>{msg}</div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">

          {tab === "stock" && (
            <div className="flex flex-col gap-3">
              <section className="border border-white/10 bg-white/[0.04] p-4">
                <h2 className="mb-3 text-sm font-semibold">Restock inventory</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  <select value={restockForm.productId} onChange={event => setRestockForm(previous => ({ ...previous, productId: event.target.value }))} className="min-h-10 border border-white/10 bg-[#17171e] px-3 text-sm text-white">
                    <option value="">Select product</option>{products.filter(product => !product.is_service && product.category !== "Car Wash" && product.category !== "Pool").map(product => <option key={product.id} value={product.id}>{product.name} · {product.stock} in stock</option>)}
                  </select>
                  <input type="number" min="1" value={restockForm.quantity} onChange={event => setRestockForm(previous => ({ ...previous, quantity: event.target.value }))} placeholder="Quantity received" className="min-h-10 border border-white/10 bg-black/20 px-3 text-sm text-white" />
                  <select value={restockForm.supplier} onChange={event => setRestockForm(previous => ({ ...previous, supplier: event.target.value }))} className="min-h-10 border border-white/10 bg-[#17171e] px-3 text-sm text-white">
                    <option value="">Supplier (optional)</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.name}>{supplier.name}</option>)}
                  </select>
                  <input value={restockForm.note} onChange={event => setRestockForm(previous => ({ ...previous, note: event.target.value }))} placeholder="Delivery note (optional)" className="min-h-10 border border-white/10 bg-black/20 px-3 text-sm text-white" />
                </div>
                <button onClick={() => void recordRestock()} disabled={!restockForm.productId || Number(restockForm.quantity) <= 0} className="mt-3 flex min-h-10 items-center gap-2 bg-emerald-400 px-4 text-sm font-bold text-emerald-950 disabled:opacity-40"><Archive size={15} /> Record restock</button>
              </section>
              <section className="border border-white/10 bg-white/[0.04] p-4">
                <h2 className="mb-3 text-sm font-semibold">Supplier records</h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input value={supplierForm.name} onChange={event => setSupplierForm(previous => ({ ...previous, name: event.target.value }))} placeholder="Supplier name" className="min-h-10 border border-white/10 bg-black/20 px-3 text-sm text-white" />
                  <input value={supplierForm.phone} onChange={event => setSupplierForm(previous => ({ ...previous, phone: event.target.value }))} placeholder="Phone" className="min-h-10 border border-white/10 bg-black/20 px-3 text-sm text-white" />
                  <div className="flex gap-2"><input value={supplierForm.email} onChange={event => setSupplierForm(previous => ({ ...previous, email: event.target.value }))} placeholder="Email" className="min-h-10 min-w-0 flex-1 border border-white/10 bg-black/20 px-3 text-sm text-white" /><button onClick={() => void saveSupplier()} disabled={!supplierForm.name.trim()} title="Save supplier" className="w-10 shrink-0 bg-amber-400 text-black disabled:opacity-40"><Plus size={16} className="mx-auto" /></button></div>
                </div>
                <p className="mt-2 text-xs text-white/50">{suppliers.map(supplier => supplier.name).join(" · ") || "No suppliers saved"}</p>
              </section>
              <section className="border border-white/10 bg-white/[0.04] p-4">
                <h2 className="mb-3 text-sm font-semibold">Recent stock movements</h2>
                <div className="space-y-2">{stockMovements.slice(0, 12).map(movement => <div key={movement.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-sm"><span>{movement.product} <strong className="text-emerald-200">+{movement.quantity}</strong></span><span className="text-xs text-white/50">{movement.supplier || "No supplier"} · {movement.recorded_by || user.name} · {new Date(movement.created_at).toLocaleDateString("en-KE")}</span></div>)}{!stockMovements.length && <p className="text-sm text-white/45">No stock movements recorded</p>}</div>
              </section>
              {/* Opening stock banner */}
              {(() => {
                const sortedPrev = Object.keys(closedDays).filter(d => d < todayKey()).sort();
                const prevDay = sortedPrev[sortedPrev.length - 1];
                if (!prevDay) return null;
                return (
                  <div className="rounded-xl px-5 py-3 flex items-center gap-3 mb-2" style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)" }}>
                    <RefreshCw size={14} style={{ color: "#a78bfa" }} />
                    <p className="text-sm" style={{ color: "#a78bfa" }}>
                      Opening stock auto-loaded from <span className="font-semibold">{prevDay}</span> closing snapshot.
                    </p>
                  </div>
                );
              })()}
              <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Adjust stock levels</p>
              {products.map(p => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{p.category}{p.sub ? ` · ${p.sub}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.stock < 10 && <AlertCircle size={14} style={{ color: "#f87171" }} />}
                    <input type="number" value={p.stock} onChange={e => updateStock(p.id, e.target.value)} onBlur={() => persistStock(p.id)}
                      className="w-20 px-3 py-1.5 rounded-lg text-sm text-center"
                      style={{ background: "var(--secondary)", border: `1px solid ${p.stock < 10 ? "#f87171" : "var(--border)"}`, color: "var(--foreground)", fontFamily: "'DM Mono', monospace", outline: "none" }} />
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>units</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "products" && (
            <div className="flex flex-col gap-6">
              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="font-black uppercase tracking-widest mb-4 text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>Add Product</p>
                <div className="grid grid-cols-2 gap-3">
                  {[["Name", "name", "text", "Negroni"], ["Price (KSh)", "price", "number", "1800"], ["Sub-label", "sub", "text", "Glass"], ["Stock", "stock", "number", "50"]].map(([label, key, type, ph]) => (
                    <div key={key}>
                      <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{label}</label>
                      <input type={type} value={newProduct[key]} placeholder={ph}
                        onChange={e => setNewProduct(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }} />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Category</label>
                    <select value={newProduct.category} onChange={e => setNewProduct(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }}>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <label className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Happy-hour price
                    <input type="number" min="0" value={newProduct.happyHourPrice} onChange={event => setNewProduct(previous => ({ ...previous, happyHourPrice: event.target.value }))} placeholder="Optional" className="mt-1 w-full rounded-lg px-3 py-2 text-sm normal-case tracking-normal" style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  </label>
                  <label className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Happy-hour starts
                    <input type="time" value={newProduct.happyHourStart} onChange={event => setNewProduct(previous => ({ ...previous, happyHourStart: event.target.value }))} className="mt-1 w-full rounded-lg px-3 py-2 text-sm normal-case tracking-normal" style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  </label>
                  <label className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Happy-hour ends
                    <input type="time" value={newProduct.happyHourEnd} onChange={event => setNewProduct(previous => ({ ...previous, happyHourEnd: event.target.value }))} className="mt-1 w-full rounded-lg px-3 py-2 text-sm normal-case tracking-normal" style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }} />
                  </label>
                  <label className="col-span-2 text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
                    Drink image
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setProductImage(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm normal-case tracking-normal" />
                  </label>
                </div>
                <button onClick={saveProduct}
                  className="mt-4 py-2.5 px-6 rounded-3xl font-black uppercase tracking-widest text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(0,0,0,0.18)] active:scale-[0.98]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#a78bfa", color: "#0d0c0f" }}>
                  <Plus size={14} /> Add Product
                </button>
              </div>
              {apiEnabled && <section className="border border-white/10 bg-white/[0.04] p-5">
                <h2 className="mb-3 text-sm font-semibold">Bulk import</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-white/55">CSV catalog<input type="file" accept=".csv,text/csv" onChange={event => setImportCsv(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm" /></label>
                  <label className="text-xs text-white/55">Matching images ZIP<input type="file" accept=".zip,application/zip" onChange={event => setImportImages(event.target.files?.[0] || null)} className="mt-2 block w-full text-sm" /></label>
                </div>
                <button onClick={() => void importProductFiles()} disabled={!importCsv} className="mt-3 min-h-10 bg-amber-400 px-4 text-sm font-bold text-black disabled:opacity-40">Import catalog</button>
              </section>}
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>All products ({products.length})</p>
                {products.map(p => (
                  <div key={p.id} className="flex items-center gap-4 px-5 py-3 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</p>
                      <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>{p.category} · {formatPrice(p.price)} · {p.stock} in stock</p>
                    </div>
                    <label title={apiEnabled ? "Upload product image" : "Image upload requires the shared API"} className={`flex h-9 w-9 items-center justify-center border border-white/10 ${apiEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}>
                      <ImagePlus size={16} />
                      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!apiEnabled} onChange={event => void replaceProductImage(p, event.target.files?.[0])} className="sr-only" />
                    </label>
                    <button onClick={() => deleteProduct(p.id)} className="opacity-40 hover:opacity-90 transition-opacity" style={{ color: "var(--accent)" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "categories" && (
            <div className="flex flex-col gap-6">
              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="font-black uppercase tracking-widest mb-4 text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>Add Category</p>
                <div className="flex gap-3">
                  <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="e.g. Mocktails"
                    className="flex-1 px-4 py-2.5 rounded-lg text-sm"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }} />
                  <button onClick={addCategory}
                    className="px-5 py-2.5 rounded-3xl font-black uppercase tracking-widest text-sm flex items-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.22)] active:scale-[0.98]"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#a78bfa", color: "#0d0c0f" }}>
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {categories.map(c => (
                  <div key={c} className="flex items-center justify-between px-5 py-3 rounded-xl" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                    <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{c}</span>
                    <span className="text-xs" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
                      {products.filter(p => p.category === c).length} products
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "employees" && (
            <div className="flex flex-col gap-6">
              <div className="rounded-xl p-6" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                <p className="font-black uppercase tracking-widest mb-4 text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>Add Employee</p>
                <div className="grid grid-cols-2 gap-3">
                  {[["Full Name", "name", "text", "e.g. John Doe"], ["PIN", "pin", "password", "4–6 digits"], ["Email", "email", "email", "john@noir.co.ke"]].map(([label, key, type, ph]) => (
                    <div key={key} className={key === "email" ? "col-span-2" : ""}>
                      <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{label}</label>
                      <input type={type} value={newUser[key]} placeholder={ph}
                        onChange={e => setNewUser(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Role</label>
                    <select value={newUser.role} onChange={e => setNewUser(f => ({ ...f, role: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }}>
                      <option value="bartender">Bartender</option>
                      <option value="manager">Manager</option>
                      <option value="cashier">Cashier</option>
                      <option value="car_wash_attendant">Car Wash Attendant</option>
                    </select>
                  </div>
                </div>
                <button onClick={addEmployee}
                  className="mt-4 py-2.5 px-6 rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-2 transition-all hover:brightness-110"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#a78bfa", color: "#0d0c0f" }}>
                  <UserPlus size={14} /> Add Employee
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>All staff</p>
                {users.map(u => {
                  const roleLabel2 = u.role === "admin" ? "Owner" : u.role === "manager" ? "Manager" : u.role === "car_wash_attendant" ? "Car Wash Attendant" : u.role === "cashier" ? "Cashier" : "Bartender";
                  const roleColor2 = u.role === "admin" ? "#f5a623" : u.role === "manager" ? "#a78bfa" : u.role === "car_wash_attendant" ? "#38bdf8" : "#34d399";
                  const isResetting = resetPin.userId === u.id;
                  return (
                    <div key={u.id} className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold"
                            style={{ background: roleColor2 + "22", color: roleColor2, border: `1px solid ${roleColor2}44` }}>
                            {u.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{u.name}</p>
                            <p className="text-xs" style={{ color: roleColor2, fontFamily: "'DM Mono', monospace" }}>{roleLabel2}</p>
                          </div>
                        </div>
                        {u.role !== "admin" && (
                          <button onClick={() => setResetPin(isResetting ? { userId: null, pin: "" } : { userId: u.id, pin: "" })}
                            className="text-xs px-3 py-1.5 rounded-lg transition-all hover:brightness-110"
                            style={{ background: isResetting ? "var(--accent)" : "var(--secondary)", color: isResetting ? "#fff" : "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>
                            {isResetting ? "Cancel" : "Reset PIN"}
                          </button>
                        )}
                      </div>
                      {isResetting && (
                        <div className="flex gap-2">
                          <input type="password" value={resetPin.pin} onChange={e => setResetPin(r => ({ ...r, pin: e.target.value }))}
                            placeholder="New PIN" maxLength={6}
                            className="flex-1 px-3 py-2 rounded-lg text-sm"
                            style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", fontFamily: "'DM Mono', monospace", outline: "none" }} />
                          <button onClick={() => doResetPin(u.id)}
                            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110"
                            style={{ background: "#22c55e", color: "#0d1a10" }}>
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
    </div>
  );
}
export default ManagerPanel;
// ─── ADMIN ANALYTICS ─────────────────────────────────────────────────────────

