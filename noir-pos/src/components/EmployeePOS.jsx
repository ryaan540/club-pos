import { useEffect, useState } from "react";
import { Banknote, BarChart3, ChevronRight, ClipboardList, DollarSign, FileText, Lock, Minus, Plus, Receipt, Save, ShoppingCart, X } from "lucide-react";
import { STORAGE_KEYS, now, todayKey, useLocalState, formatPrice } from "../helpers.js";
import { CAT_BADGE, CAT_COLORS } from "../data.js";
import Topbar from "./Topbar.jsx";
import ReceiptModal from "./ReceiptModal.jsx";
import PaymentDetails from "./PaymentDetails.jsx";
import { apiEnabled, apiRequest, syncSaleToApi } from "../api.js";
import ProductImage from "./ProductImage.jsx";
import { AppShell, CartPanel, PosTopBar, ProductGrid } from "./BarPOSComponents.jsx";

function EmployeePOS({ user, users, products, sales, setSales, setProducts, onLogout, onBackToAdmin, closedDays }) {
  const categories = [...new Set(products.map(p => p.category))];
  const clubProducts = products.filter(product => product.category !== "Car Wash");
  const clubCategories = categories.filter(category => category !== "Car Wash");
  const groupedProducts = categories.reduce((acc, category) => {
    acc[category] = products.filter(p => p.category === category);
    return acc;
  }, {});
  const [cart, setCart] = useState([]);
  const [paymentView, setPaymentView] = useState("order");
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [tab, setTab] = useState("pos");
  const [openTabs, setOpenTabs] = useLocalState("noir_open_tabs", []);
  const [activeTabId, setActiveTabId] = useState(null);
  const [newTabCustomer, setNewTabCustomer] = useState("");
  const [newTabTable, setNewTabTable] = useState("");
  const [tabError, setTabError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantityDraft, setQuantityDraft] = useState("1");
  const [modifierNote, setModifierNote] = useState("");
  const [iceChoice, setIceChoice] = useState("Ice");
  const [mixerChoice, setMixerChoice] = useState("");
  const [doubleServe, setDoubleServe] = useState(false);
  const [removedItem, setRemovedItem] = useState(null);
  const [expenses, setExpenses] = useLocalState(STORAGE_KEYS.EXPENSES, []);
  const [expForm, setExpForm] = useState({ desc: "", amount: "", category: "Operations" });

  useEffect(() => {
    if (!apiEnabled) return;
    apiRequest("/api/tabs").then(setOpenTabs).catch(() => {});
  }, [setOpenTabs]);

  const isTodayClosed = !!closedDays[todayKey()];

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total = subtotal;
  const itemCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = product => {
    if (isTodayClosed || (!product.is_service && product.stock <= 0)) return;
    setCart(previous => {
      const existing = previous.find(item => item.id === product.id && !item.note);
      if (existing) return previous.map(item => item === existing ? { ...item, qty: item.qty + 1 } : item);
      return [...previous, { ...product, qty: 1, note: "" }];
    });
  };

  const addSelectedProductToCart = () => {
    if (!selectedProduct || isTodayClosed) return;
    const qty = Math.max(1, Number.parseInt(quantityDraft || "1", 10) || 1);
    const note = [iceChoice, mixerChoice, doubleServe ? "Double" : "", modifierNote.trim()].filter(Boolean).join(" · ");
    setCart(prev => {
      const existing = prev.find(item => item.id === selectedProduct.id && item.note === note);
      if (existing) return prev.map(item => item === existing ? { ...item, qty: item.qty + qty } : item);
      return [...prev, { ...selectedProduct, qty, note }];
    });
    setSelectedProduct(null);
    setQuantityDraft("1");
    setModifierNote("");
    setIceChoice("Ice");
    setMixerChoice("");
    setDoubleServe(false);
  };

  const changeQty = (id, delta) => setCart(previous => previous
    .map(item => item.id !== id ? item : { ...item, qty: Math.max(0, Math.min(item.is_service ? Infinity : item.stock, item.qty + delta)) })
    .filter(item => item.qty > 0));

  const removeCartItem = item => {
    setRemovedItem(item);
    setCart(previous => previous.filter(line => line !== item));
    window.setTimeout(() => setRemovedItem(current => current === item ? null : current), 5000);
  };

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
        event.preventDefault();
        document.querySelector('[aria-label="Search products"]')?.focus();
      }
      if (event.key === "Enter" && tab === "pos" && paymentView === "order" && cart.length && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
        setPaymentMethod("cash");
        setPaymentView("details");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cart.length, paymentView, tab]);

  const handleConfirm = async (details = {}) => {
    const saleSubtotal = details.subtotal ?? subtotal;
    const saleTotal = details.total ?? total;
    const sale = {
      id: sales.length ? Math.max(...sales.map(existingSale => Number(existingSale.id) || 0)) + 1 : 1,
      clientId: crypto.randomUUID(),
      timestamp: now(),
      items: details.items || cart,
      subtotal: saleSubtotal,
      discount: details.discount || 0,
      tip: details.tip || 0,
      total: saleTotal,
      method: details.method || paymentMethod,
      payments: details.payments,
      servedBy: user.name,
      userId: user.id,
      ...details,
    };
    if (activeTabId) {
      if (apiEnabled) {
        await apiRequest(`/api/tabs/${activeTabId}`, {
          method: "PATCH",
          body: JSON.stringify({
            close: true, client_id: sale.clientId, method: sale.method,
            payments: sale.payments, discount: sale.discount, tip: sale.tip,
            discountApprovalToken: sale.discountApprovalToken,
          }),
        });
      }
      setOpenTabs(previous => previous.filter(openTab => openTab.id !== activeTabId));
      setActiveTabId(null);
    } else {
      void syncSaleToApi(sale);
    }
    setSales(prev => [sale, ...prev]);
    setProducts(prev => prev.map(p => {
      const ci = cart.find(i => i.id === p.id);
      if (!ci || p.category === "Car Wash" || p.category === "Pool") return p;
      return { ...p, stock: Math.max(0, p.stock - ci.qty) };
    }));
    setPaymentView("success");
    setReceiptSale(sale);
    setCart([]);
    setPaymentMethod(null);
  };

  const addExpense = () => {
    if (!expForm.desc || !expForm.amount) return;
    setExpenses(prev => [{ id: Date.now(), timestamp: now(), ...expForm, amount: parseFloat(expForm.amount), recordedBy: user.name }, ...prev]);
    setExpForm({ desc: "", amount: "", category: "Operations" });
  };

  const createTab = async () => {
    if (!newTabCustomer.trim() && !newTabTable.trim()) return;
    setTabError("");
    try {
      const created = apiEnabled
        ? await apiRequest("/api/tabs", {
            method: "POST",
            body: JSON.stringify({ customer: newTabCustomer.trim(), table_number: newTabTable.trim() }),
          })
        : {
            id: crypto.randomUUID(), customer: newTabCustomer.trim() || `Table ${newTabTable.trim()}`,
            table_number: newTabTable.trim(), items: [], status: "open", opened_by: user.name,
          };
      setOpenTabs(previous => [...previous, created]);
      setNewTabCustomer("");
      setNewTabTable("");
    } catch (error) {
      setTabError(error.message);
    }
  };

  const loadTab = (openTab, closeAfter = false) => {
    setActiveTabId(openTab.id);
    setCart(openTab.items || []);
    setPaymentView(closeAfter ? "details" : "order");
    setPaymentMethod("cash");
    setTab("pos");
  };

  const saveCartToTab = async () => {
    if (!activeTabId) return;
    setTabError("");
    try {
      const updated = apiEnabled
        ? await apiRequest(`/api/tabs/${activeTabId}`, {
            method: "PATCH", body: JSON.stringify({ items: cart }),
          })
        : { ...openTabs.find(openTab => openTab.id === activeTabId), items: cart };
      setOpenTabs(previous => previous.map(openTab => openTab.id === activeTabId ? updated : openTab));
      setActiveTabId(null);
      setCart([]);
      setTab("tabs");
    } catch (error) {
      setTabError(error.message);
    }
  };

  const holdCurrentTab = async () => {
    if (!cart.length) return;
    if (activeTabId) {
      await saveCartToTab();
      return;
    }
    const customer = window.prompt("Customer name or table number");
    if (!customer?.trim()) return;
    setTabError("");
    try {
      const created = apiEnabled
        ? await apiRequest("/api/tabs", { method: "POST", body: JSON.stringify({ customer: customer.trim() }) })
        : { id: crypto.randomUUID(), customer: customer.trim(), table_number: "", items: [], status: "open", opened_by: user.name };
      const saved = apiEnabled
        ? await apiRequest(`/api/tabs/${created.id}`, { method: "PATCH", body: JSON.stringify({ items: cart }) })
        : { ...created, items: cart };
      setOpenTabs(previous => [...previous, saved]);
      setCart([]);
      setTab("tabs");
    } catch (error) {
      setTabError(error.message);
    }
  };

  const mySales = sales.filter(s => s.userId === user.id);

  if (tab === "pos") {
    const activeTabName = openTabs.find(openTab => openTab.id === activeTabId)?.customer;
    const panel = <CartPanel
      cart={cart} subtotal={subtotal} activeTabName={activeTabName}
      onChangeQty={changeQty} onRemove={removeCartItem} onClear={() => setCart([])}
      onHold={() => void holdCurrentTab()}
      onSplit={() => { setCartOpen(false); setPaymentMethod("split"); setPaymentView("details"); }}
      onDiscount={() => { setCartOpen(false); setPaymentMethod("cash"); setPaymentView("details"); }}
      onCharge={() => { setCartOpen(false); setPaymentMethod("cash"); setPaymentView("details"); }}
    />;

    return <AppShell
      header={<>
        <PosTopBar user={user} onLogout={onLogout} onBackToAdmin={onBackToAdmin} />
        <nav className="no-scrollbar flex min-h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/8 bg-noir-950 px-3 sm:px-5">
          {[["pos", "Club POS"], ["tabs", "Open Tabs"], ["expenses", "Expenses"], ["history", "Sales"]].map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`min-h-10 shrink-0 whitespace-nowrap rounded-control px-3 text-xs font-semibold transition ${tab === key ? "bg-noir-850 text-violet-200" : "text-noir-300 hover:bg-noir-900"}`}>{label}</button>)}
          {isTodayClosed && <span className="ml-auto rounded-lg bg-status-warning/10 px-3 py-1 text-xs font-semibold text-status-warning">Shift closed</span>}
        </nav>
      </>}
      cart={panel} itemCount={itemCount} total={subtotal} cartOpen={cartOpen}
      onOpenCart={() => setCartOpen(true)} onCloseCart={() => setCartOpen(false)}
    >
      <ProductGrid
        products={clubProducts} cart={cart} categories={clubCategories}
        selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory}
        search={search} onSearchChange={setSearch} onAdd={addToCart}
        onLongPress={product => { setSelectedProduct(product); setQuantityDraft("1"); }}
      />
      {selectedProduct && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedProduct(null); }}>
        <section className="w-full max-w-md rounded-t-panel border border-white/10 bg-noir-900 p-5 shadow-2xl sm:rounded-panel">
          <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold text-violet-300">MODIFIERS</p><h2 className="mt-1 text-lg font-bold">{selectedProduct.name}</h2></div><button onClick={() => setSelectedProduct(null)} className="grid h-10 w-10 place-items-center rounded-control border border-white/10 text-noir-300" aria-label="Close modifiers"><X size={18} /></button></div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-noir-300">Ice<select value={iceChoice} onChange={event => setIceChoice(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-white/10 bg-noir-950 px-3 text-sm text-noir-100"><option>Ice</option><option>No ice</option></select></label>
            <label className="text-xs font-semibold text-noir-300">Mixer<select value={mixerChoice} onChange={event => setMixerChoice(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-white/10 bg-noir-950 px-3 text-sm text-noir-100"><option value="">No mixer</option><option>Soda</option><option>Tonic</option><option>Water</option><option>Juice</option></select></label>
          </div>
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-semibold text-noir-100"><input type="checkbox" checked={doubleServe} onChange={event => setDoubleServe(event.target.checked)} className="h-5 w-5 accent-violet-400" /> Double serve</label>
          <label className="mt-3 block text-xs font-semibold text-noir-300">Item note<input value={modifierNote} onChange={event => setModifierNote(event.target.value)} placeholder="Optional note" className="mt-1 min-h-11 w-full rounded-control border border-white/10 bg-noir-950 px-3 text-sm text-noir-100 placeholder:text-noir-500" /></label>
          <label className="mt-3 block text-xs font-semibold text-noir-300">Quantity<input type="number" min="1" value={quantityDraft} onChange={event => setQuantityDraft(event.target.value)} className="mt-1 min-h-11 w-full rounded-control border border-white/10 bg-noir-950 px-3 font-mono text-base tabular-nums text-noir-100" /></label>
          <button onClick={addSelectedProductToCart} disabled={!selectedProduct.is_service && selectedProduct.stock <= 0} className="mt-5 min-h-14 w-full rounded-control bg-violet-500 text-base font-extrabold text-noir-950 shadow-active disabled:opacity-40">Add {formatPrice(selectedProduct.price)}</button>
        </section>
      </div>}
      {paymentView === "details" && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) setPaymentView("order"); }}><section className="max-h-[94svh] w-full max-w-xl overflow-y-auto rounded-t-panel border border-white/10 bg-noir-900 sm:rounded-panel"><PaymentDetails cart={cart} total={subtotal} users={users} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} onBack={() => setPaymentView("order")} onConfirm={handleConfirm} /></section></div>}
      {paymentView === "success" && <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"><section className="w-full max-w-sm rounded-panel border border-white/10 bg-noir-900 p-6 text-center shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-status-success/15 text-4xl font-bold text-status-success animate-in zoom-in duration-200">✓</div><h2 className="mt-4 text-xl font-extrabold">Payment complete</h2><p className="mt-1 text-sm text-noir-300">{formatPrice(receiptSale?.total || 0)} · {receiptSale?.method}</p><div className="mt-6 grid grid-cols-2 gap-3"><button onClick={() => { setPaymentView("order"); }} className="min-h-12 rounded-control border border-white/10 text-sm font-semibold text-noir-100">Print receipt</button><button onClick={() => { setReceiptSale(null); setPaymentView("order"); }} className="min-h-12 rounded-control bg-violet-500 text-sm font-bold text-noir-950">New order</button></div></section></div>}
      {removedItem && <div className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-control border border-white/10 bg-noir-800 px-4 py-3 text-sm shadow-xl"><span>Removed {removedItem.name}</span><button onClick={() => { setCart(previous => [...previous, removedItem]); setRemovedItem(null); }} className="font-bold text-violet-300">Undo</button></div>}
      <ReceiptModal sale={paymentView === "success" ? null : receiptSale} onClose={() => setReceiptSale(null)} />
    </AppShell>;
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif", background: "radial-gradient(circle at top, rgba(245,166,35,0.10), transparent 22%), linear-gradient(180deg, #09070f 0%, #0d0b15 100%)" }}>
      <Topbar user={user} onLogout={onLogout} title={tab === "pos" ? "Point of Sale" : tab === "tabs" ? "Open Tabs" : tab === "expenses" ? "Record Expense" : "My Sales"} />

      {isTodayClosed && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm"
          style={{ background: "rgba(245,166,35,0.12)", borderBottom: "1px solid rgba(245,166,35,0.24)", color: "var(--primary)", fontFamily: "'DM Mono', monospace" }}>
          <Lock size={13} /> Today is closed — no new sales can be recorded
        </div>
      )}

      <div className="flex gap-1 px-3 py-2 border-b shrink-0 glass-card" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.04)" }}>
        {onBackToAdmin && <button onClick={onBackToAdmin} className="flex items-center gap-2 border border-white/10 px-4 py-1.5 text-sm font-semibold text-white/70"><BarChart3 size={14} /> Analytics</button>}
        {[ ["pos", ShoppingCart, "POS"], ["tabs", ClipboardList, "Tabs"], ["expenses", FileText, "Expenses"], ["history", Receipt, "History"] ].map(([key, Icon, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em", fontSize: "0.9rem",
              background: tab === key ? "linear-gradient(135deg, var(--primary), #f59e0b)" : "rgba(255,255,255,0.03)",
              color: tab === key ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: tab === key ? "1px solid rgba(245,166,35,0.50)" : "1px solid rgba(255,255,255,0.06)",
            }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "tabs" && (
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-4xl">
            <section className="mb-5 border border-white/10 bg-white/[0.04] p-4">
              <h2 className="mb-3 text-base font-semibold">Open a tab</h2>
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                <input value={newTabCustomer} onChange={event => setNewTabCustomer(event.target.value)} placeholder="Customer name" className="min-h-11 border border-white/10 bg-black/20 px-3 text-sm text-white" />
                <input value={newTabTable} onChange={event => setNewTabTable(event.target.value)} placeholder="Table number" className="min-h-11 border border-white/10 bg-black/20 px-3 text-sm text-white" />
                <button onClick={() => void createTab()} disabled={!newTabCustomer.trim() && !newTabTable.trim()} className="flex min-h-11 items-center justify-center gap-2 bg-amber-400 px-4 text-sm font-bold text-black disabled:opacity-40"><Plus size={16} /> New tab</button>
              </div>
              {tabError && <p role="alert" className="mt-3 text-sm text-rose-300">{tabError}</p>}
            </section>
            <div className="space-y-3">
              {openTabs.map(openTab => {
                const tabTotal = (openTab.items || []).reduce((sum, item) => sum + item.price * item.qty, 0);
                return (
                  <article key={openTab.id} className="border border-white/10 bg-white/[0.035] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{openTab.customer || `Table ${openTab.table_number}`}</h3>
                      <p className="mt-1 truncate text-sm text-white/55">{openTab.items?.length ? openTab.items.map(item => `${item.name} ×${item.qty}`).join(", ") : "No items yet"}</p>
                      <p className="mt-2 text-sm font-semibold text-amber-200">{formatPrice(tabTotal)}</p>
                    </div>
                    <div className="mt-3 flex gap-2 sm:mt-0">
                      <button onClick={() => loadTab(openTab)} className="min-h-10 flex-1 border border-white/10 px-3 text-sm font-semibold sm:flex-none">Add items</button>
                      <button onClick={() => loadTab(openTab, true)} disabled={!openTab.items?.length} className="min-h-10 flex-1 bg-emerald-400 px-3 text-sm font-bold text-emerald-950 disabled:opacity-40 sm:flex-none">Close &amp; pay</button>
                    </div>
                  </article>
                );
              })}
              {!openTabs.length && <p className="border border-dashed border-white/15 py-12 text-center text-sm text-white/45">No open tabs</p>}
            </div>
          </div>
        </div>
      )}

      {tab === "pos" && (
        <div className="flex flex-1 overflow-hidden gap-3 p-3">
          {/* product grid */}
          <div className="flex flex-col flex-1 overflow-hidden rounded-[28px]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex-1 overflow-y-auto p-4">
              {categories.map(category => (
                <div key={category} className="mb-8">
                  <div className="flex items-center justify-between mb-4 px-2">
                    <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>
                      {category}
                    </h2>
                    <span className="text-xs font-semibold uppercase" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>
                      {groupedProducts[category]?.length ?? 0} items
                    </span>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
                    {groupedProducts[category]?.map(product => {
                      const inCart = cart.find(i => i.id === product.id);
                      const lowStock = product.stock < 10;
                      return (
                        <button key={product.id} onClick={() => addToCart(product)}
                          disabled={isTodayClosed}
                          className={`relative flex flex-col justify-between p-2 rounded-2xl border text-left transition-all duration-150 active:scale-95 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,0.22)] ${CAT_COLORS[product.category] || "from-gray-900/40 to-gray-800/20 border-gray-700/30"}`}
                          style={{ minHeight: 140, opacity: isTodayClosed ? 0.5 : 1, background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                          <div className="w-full mb-2 flex items-center justify-center">
                            <ProductImage src={product.image_url || product.image} name={product.name} style={{ width: 120, height: 80, objectFit: "cover", borderRadius: 12 }} />
                          </div>
                          {inCart && (
                            <span className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ fontFamily: "'DM Mono', monospace", background: "var(--primary)", color: "var(--primary-foreground)" }}>
                              {inCart.qty}
                            </span>
                          )}
                          <div>
                            <p className="font-semibold leading-tight mb-1" style={{ color: "var(--foreground)", fontSize: "0.95rem" }}>{product.name}</p>
                            {product.sub && (
                              <span className={`text-xs px-1.5 py-0.5 rounded ${CAT_BADGE[product.category] || "bg-gray-900/60 text-gray-300"}`}
                                style={{ fontFamily: "'DM Mono', monospace" }}>{product.sub}</span>
                            )}
                          </div>
                          <div className="flex items-end justify-between mt-3">
                            <p className="text-lg font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)", letterSpacing: "0.02em" }}>
                              {formatPrice(product.price)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* order panel */}
          <div className="w-[340px] flex flex-col border-l shrink-0 rounded-[28px]"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
            {paymentView === "success" ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                  style={{ background: "rgba(34,197,94,0.15)", border: "2px solid #22c55e" }}>✓</div>
                <p className="text-2xl font-black uppercase tracking-widest text-center"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#22c55e" }}>Payment Complete</p>
              </div>
            ) : paymentView === "payment" ? (
              <div className="flex-1 flex flex-col p-6 gap-6">
                <button onClick={() => setPaymentView("order")} className="flex items-center gap-2 text-sm" style={{ color: "var(--muted-foreground)" }}>← Back</button>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Total due</p>
                  <p className="text-5xl font-black" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>{formatPrice(total)}</p>
                </div>
                <div className="rounded-2xl p-4 flex flex-col gap-2 text-sm" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Subtotal", "Total"].map((label) => (
                    <div key={label} className="flex justify-between">
                      <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", color: label === "Total" ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: label === "Total" ? 600 : 400 }}>
                        {formatPrice(label === "Total" ? total : subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-4" style={{ background: "var(--secondary)" }}>
                  <p className="text-xs uppercase tracking-widest mb-1" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
                    via <span style={{ color: "var(--primary)", textTransform: "capitalize" }}>{paymentMethod}</span>
                  </p>
                  <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                    {paymentMethod === "mpesa" ? "Confirm M-Pesa payment from customer." :
                     `Collect ${formatPrice(total)} from customer.`}
                  </p>
                </div>
                <button onClick={handleConfirm}
                  className="mt-auto rounded-xl py-4 font-black uppercase tracking-widest text-lg flex items-center justify-center gap-2 transition-all active:scale-95 hover:brightness-110"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "#22c55e", color: "#0d1a10" }}>
                  Confirm Payment <ChevronRight size={20} />
                </button>
              </div>
            ) : (
              <>
                <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <p className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Order</p>
                    <p className="text-lg font-black uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>
                      {itemCount} item{itemCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="text-xs px-2 py-1 rounded"
                      style={{ color: "var(--accent)", background: "rgba(224,51,92,0.12)", fontFamily: "'DM Mono', monospace" }}>
                      Clear all
                    </button>
                  )}
                </div>
                {selectedProduct && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.64)" }}>
                    <div className="w-full max-w-sm rounded-3xl p-5" style={{ background: "linear-gradient(180deg, rgba(17,24,39,0.96), rgba(10,14,22,0.96))", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.48)" }}>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Quantity</p>
                          <p className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{selectedProduct.name}</p>
                        </div>
                        <button onClick={() => { setSelectedProduct(null); setQuantityDraft("1"); }} style={{ color: "var(--muted-foreground)" }}><X size={16} /></button>
                      </div>
                      <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Enter quantity</label>
                      <input type="number" min="1" value={quantityDraft} onChange={e => setQuantityDraft(e.target.value)}
                        className="w-full px-3 py-3 rounded-2xl text-sm mb-4"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--foreground)", outline: "none" }} />
                      {activeTabId && <button onClick={() => void saveCartToTab()} className="flex min-h-11 w-full items-center justify-center gap-2 border border-amber-300/30 bg-amber-300/10 text-sm font-semibold text-amber-100"><Save size={15} /> Save to tab</button>}
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedProduct(null); setQuantityDraft("1"); }}
                          className="flex-1 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "rgba(255,255,255,0.06)", color: "var(--muted-foreground)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          Cancel
                        </button>
                        <button onClick={addSelectedProductToCart}
                          className="flex-1 py-3 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:brightness-110"
                          style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "linear-gradient(135deg, var(--primary), #f59e0b)", color: "#0d0c0f" }}>
                          Add to order
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                  {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                      <div className="text-5xl mb-3 opacity-20">🍸</div>
                      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Tap products to add to order</p>
                    </div>
                  ) : cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <ProductImage src={item.image_url || item.image} name={item.name} className="w-10 h-10 rounded" style={{ objectFit: "cover" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--foreground)" }}>{item.name}</p>
                        <p className="text-xs" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{formatPrice(item.price)} each</p>
                        <input aria-label={`Note for ${item.name}`} value={item.note || ""} onChange={event => setCart(previous => previous.map(line => line.id === item.id ? { ...line, note: event.target.value } : line))} placeholder="Add item note" className="mt-1 w-full bg-transparent text-xs outline-none placeholder:text-white/25" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => changeQty(item.id, -1)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}><Minus size={12} /></button>
                        <span className="w-6 text-center text-sm font-semibold" style={{ fontFamily: "'DM Mono', monospace", color: "var(--foreground)" }}>{item.qty}</span>
                        <button onClick={() => changeQty(item.id, 1)} className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}><Plus size={12} /></button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ fontFamily: "'DM Mono', monospace", color: "var(--primary)" }}>{formatPrice(item.price * item.qty)}</span>
                        <button onClick={() => changeQty(item.id, -item.qty)} className="opacity-40 hover:opacity-80" style={{ color: "var(--accent)" }}><X size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && (
                  <div className="border-t px-5 py-4 flex flex-col gap-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex flex-col gap-1 text-sm">
                      {[["Subtotal", subtotal]].map(([l, v]) => (
                        <div key={l} className="flex justify-between">
                          <span style={{ color: "var(--muted-foreground)" }}>{l}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>{formatPrice(v)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2 border-t mt-1" style={{ borderColor: "var(--border)" }}>
                        <span className="font-semibold" style={{ color: "var(--foreground)" }}>Total</span>
                        <span className="font-bold text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>{formatPrice(total)}</span>
                      </div>
                    </div>
                      <div className="flex gap-2">
                      <button onClick={() => { setPaymentMethod("cash"); setPaymentView("details"); }}
                        className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-1.5 font-black uppercase tracking-wider transition-all active:scale-95 hover:brightness-110"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.82rem", background: "linear-gradient(135deg, rgba(245,166,35,0.24), rgba(245,166,35,0.10))", color: "var(--foreground)", border: "1px solid rgba(245,166,35,0.35)" }}>
                        <Banknote size={14} /> Cash
                      </button>
                      <button onClick={() => { setPaymentMethod("mpesa"); setPaymentView("details"); }}
                        className="flex-1 py-3 rounded-2xl flex items-center justify-center gap-1.5 font-black uppercase tracking-wider transition-all active:scale-95 hover:brightness-110"
                        style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.82rem", background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(56,189,248,0.10))", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.35)" }}>
                        <DollarSign size={14} /> Mpesa
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {paymentView === "details" && (
        <div className="w-[340px] flex flex-col border-l shrink-0 rounded-[28px]" style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          <PaymentDetails
            cart={cart}
            total={total}
            users={users}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            onBack={() => setPaymentView("order")}
            onConfirm={handleConfirm}
          />
        </div>
      )}

      {tab === "expenses" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg mx-auto flex flex-col gap-6">
            <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
              <p className="font-black uppercase tracking-widest text-lg" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>Record Expense</p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Description</label>
                  <input value={expForm.desc} onChange={e => setExpForm(f => ({ ...f, desc: e.target.value }))}
                    placeholder="e.g. Ice bags, cleaning supplies"
                    className="w-full px-4 py-2.5 rounded-lg text-sm"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Amount (KSh)</label>
                    <input type="number" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-lg text-sm"
                      style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }} />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs uppercase tracking-widest mb-1 block" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Category</label>
                    <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg text-sm"
                      style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }}>
                      {["Operations", "Supplies", "Maintenance", "Staff", "Other"].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addExpense}
                  className="py-3 rounded-xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:brightness-110"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  <Save size={16} /> Save Expense
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-widest" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>Recent expenses</p>
              {expenses.filter(e => e.recordedBy === user.name).slice(0, 15).map(e => (
                <div key={e.id} className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{e.desc}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>
                      {e.category} · {new Date(e.timestamp).toLocaleDateString("en-KE")}
                    </p>
                  </div>
                  <span className="font-bold text-sm" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--accent)" }}>{formatPrice(e.amount)}</span>
                </div>
              ))}
              {expenses.filter(e => e.recordedBy === user.name).length === 0 && (
                <p className="text-sm text-center py-6" style={{ color: "var(--muted-foreground)" }}>No expenses recorded yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            <p className="text-xs uppercase tracking-widest mb-2" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
              {mySales.length} sale{mySales.length !== 1 ? "s" : ""} recorded by you
            </p>
            {mySales.length === 0 && (
              <p className="text-sm text-center py-10" style={{ color: "var(--muted-foreground)" }}>No sales yet today</p>
            )}
            {mySales.map(s => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4 rounded-xl cursor-pointer hover:brightness-110 transition-all"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                onClick={() => setReceiptSale(s)}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                    {s.items.map(i => i.name).slice(0, 2).join(", ")}{s.items.length > 2 ? ` +${s.items.length - 2} more` : ""}
                  </p>
                  <p className="text-xs mt-0.5" style={{ fontFamily: "'DM Mono', monospace", color: "var(--muted-foreground)" }}>
                    {new Date(s.timestamp).toLocaleString("en-KE")} · {s.method}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)", fontSize: "1.1rem" }}>{formatPrice(s.total)}</span>
                  <Receipt size={14} style={{ color: "var(--muted-foreground)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
    </div>
  );
}

export default EmployeePOS;

// ─── MANAGER PANEL ───────────────────────────────────────────────────────────

