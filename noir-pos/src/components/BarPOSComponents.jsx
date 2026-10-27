import { useEffect, useRef, useState } from "react";
import {
  Beer, BottleWine, Clock3, Coffee, Grid2X2, Martini, PackageOpen,
  Search, ShoppingBag, Sparkles, Utensils, Wine, Wifi, WifiOff,
} from "lucide-react";
import { formatPrice, todayKey, useNetworkStatus } from "../helpers.js";
import ProductImage from "./ProductImage.jsx";

const CATEGORY_ICONS = {
  Beer, Spirits: BottleWine, Cocktails: Martini, Wine,
  "Soft Drinks": Coffee, Shots: Sparkles, "Bottle Service": PackageOpen,
  Food: Utensils, Pool: Grid2X2,
};

export function AppShell({ header, children, cart, itemCount, total, cartOpen, onOpenCart, onCloseCart }) {
  return (
    <div className="flex h-[100svh] min-h-[560px] flex-col overflow-hidden bg-noir-950 text-noir-100">
      {header}
      <div className="flex min-h-0 flex-1">{children}<aside className="hidden w-[36%] min-w-[340px] max-w-[460px] lg:flex">{cart}</aside></div>
      <button onClick={onOpenCart} className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-30 flex min-h-14 items-center justify-between rounded-control border border-violet-400/30 bg-noir-850 px-4 text-left shadow-active transition lg:hidden">
        <span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-control bg-violet-500 text-noir-950"><ShoppingBag size={18} /></span><span><strong className="block text-sm">{itemCount} {itemCount === 1 ? "item" : "items"}</strong><span className="text-xs text-noir-300">View order</span></span></span>
        <strong className="font-mono text-lg tabular-nums text-violet-300">{formatPrice(total)}</strong>
      </button>
      {cartOpen && <div className="fixed inset-0 z-40 bg-black/75 lg:hidden" onMouseDown={event => { if (event.target === event.currentTarget) onCloseCart(); }}>
        <div className="absolute inset-x-0 bottom-0 flex max-h-[92svh] flex-col rounded-t-panel border border-white/10 bg-noir-900 pb-[env(safe-area-inset-bottom)] shadow-2xl">
          {cart}
        </div>
      </div>}
    </div>
  );
}

export function PosTopBar({ user, onLogout, onBackToAdmin }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" }));
  const online = useNetworkStatus();
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <header className="z-20 flex min-h-16 shrink-0 items-center justify-between border-b border-white/10 bg-noir-900 px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <div className="flex items-baseline gap-2 whitespace-nowrap"><span className="text-xl font-extrabold tracking-normal text-noir-100 sm:text-2xl">NOIR</span><span className="text-[10px] font-bold uppercase text-noir-500">Nairobi</span></div>
        <div className="hidden items-center rounded-control border border-white/10 bg-noir-950 p-1 sm:flex" aria-label="POS mode">
          <span className="rounded-[9px] bg-violet-500 px-3 py-2 text-xs font-bold text-noir-950 shadow-active">Club</span>
        </div>
        {onBackToAdmin && <button onClick={onBackToAdmin} className="hidden min-h-10 items-center rounded-control border border-white/10 px-3 text-xs font-semibold text-noir-300 transition hover:border-white/20 hover:text-white md:flex">Analytics</button>}
      </div>
      <div className="flex items-center gap-3 sm:gap-5">
        <span className="hidden text-xs text-noir-300 md:inline">{todayKey()} · Evening shift</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-noir-300" aria-label={online ? "Online" : "Offline"}>
          {online ? <Wifi size={14} className="text-status-success" /> : <WifiOff size={14} className="text-status-warning" />}
          <span className="hidden sm:inline">{online ? "Online" : "Offline"}</span>
        </span>
        <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-noir-100 sm:gap-1.5 sm:text-sm"><Clock3 size={14} className="text-noir-500" />{time}</span>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-violet-400/30 bg-violet-500/10 text-xs font-bold text-violet-200 md:hidden" aria-label={user.name}>{user.name.split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase()}</span>
        <span className="hidden max-w-28 truncate text-xs font-semibold text-noir-300 md:block">{user.name}</span>
        <button onClick={onLogout} className="min-h-10 rounded-control border border-white/10 px-3 text-xs font-semibold text-noir-300 transition hover:border-white/20 hover:text-white">Log out</button>
      </div>
    </header>
  );
}

export function CategoryChips({ categories, selected, onSelect }) {
  return (
    <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-white/8 px-3 py-3 sm:px-5" role="tablist" aria-label="Product categories">
      {["All", ...categories].map(category => {
        const Icon = CATEGORY_ICONS[category] || Grid2X2;
        const active = selected === category;
        return <button key={category} role="tab" aria-selected={active} onClick={() => onSelect(category)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-control border px-3 text-sm font-semibold transition duration-150 ${active ? "border-violet-400/50 bg-violet-500/15 text-violet-200 shadow-active" : "border-white/8 bg-noir-900 text-noir-300 hover:border-white/15 hover:bg-noir-850"}`}><Icon size={16} />{category}</button>;
      })}
    </div>
  );
}

export function ProductCard({ product, quantity, onAdd, onLongPress }) {
  const timer = useRef(null);
  const held = useRef(false);
  const lowStock = !product.is_service && product.stock > 0 && product.stock <= (product.low_stock_threshold ?? 10);
  const soldOut = !product.is_service && product.stock <= 0;
  const startHold = () => {
    held.current = false;
    timer.current = window.setTimeout(() => {
      held.current = true;
      onLongPress(product);
    }, 520);
  };
  const clearHold = () => window.clearTimeout(timer.current);
  return (
    <button disabled={soldOut} onPointerDown={startHold} onPointerUp={clearHold} onPointerLeave={clearHold} onContextMenu={event => { event.preventDefault(); onLongPress(product); }} onClick={() => { if (held.current) { held.current = false; return; } onAdd(product); }} className={`group relative flex min-w-0 flex-col overflow-hidden rounded-panel border border-white/8 bg-noir-900 p-2 text-left transition duration-150 hover:border-white/15 hover:bg-noir-850 active:scale-[0.98] ${soldOut ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <div className="relative aspect-square w-full overflow-hidden rounded-control bg-noir-850">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-noir-800 via-noir-850 to-noir-900" />
        <ProductImage src={product.image_url || product.image} name={product.name} className="relative h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" style={{ objectFit: "cover" }} />
      </div>
      {quantity > 0 && <span className="absolute right-3 top-3 grid h-8 min-w-8 place-items-center rounded-full bg-violet-400 px-2 font-mono text-sm font-bold tabular-nums text-noir-950 shadow-active">{quantity}</span>}
      {soldOut && <span className="absolute inset-2 grid place-items-center rounded-control bg-noir-950/75 text-sm font-bold text-noir-100">Sold out</span>}
      <span className="mt-2 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-noir-100">{product.name}</span>
      <span className="mt-1 font-mono text-base font-bold tabular-nums text-violet-300">{formatPrice(product.price)}</span>
    </button>
  );
}

export function ProductGrid({ products, cart, categories, selectedCategory, onCategoryChange, search, onSearchChange, onAdd, onLongPress }) {
  const visible = products.filter(product => (selectedCategory === "All" || product.category === selectedCategory) && product.name.toLowerCase().includes(search.toLowerCase()));
  const quantities = new Map(cart.map(item => [item.id, item.qty]));
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="relative shrink-0 px-3 pt-3 sm:px-5 sm:pt-5">
        <Search size={18} className="pointer-events-none absolute left-7 top-[calc(50%+2px)] -translate-y-1/2 text-noir-500 sm:left-9" />
        <input value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Search drinks and food" aria-label="Search products" className="min-h-12 w-full rounded-control border border-white/10 bg-noir-900 pl-11 pr-4 text-sm text-noir-100 outline-none placeholder:text-noir-500 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/15" />
      </div>
      <CategoryChips categories={categories} selected={selectedCategory} onSelect={onCategoryChange} />
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-24 pt-3 sm:px-5 sm:pb-5">
        {visible.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{visible.map(product => <ProductCard key={product.id} product={product} quantity={quantities.get(product.id) || 0} onAdd={onAdd} onLongPress={onLongPress} />)}</div> : <div className="grid min-h-56 place-items-center text-center text-sm text-noir-300">No products match this search.</div>}
      </div>
    </section>
  );
}

export function CartItem({ item, onChangeQty, onRemove }) {
  return (
    <article className="flex min-w-0 items-center gap-3 border-b border-white/8 py-3">
      <ProductImage src={item.image_url || item.image} name={item.name} className="h-12 w-12 shrink-0 rounded-control object-cover" style={{ objectFit: "cover" }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-noir-100">{item.name}</p>
        {item.note && <p className="mt-0.5 truncate text-xs text-noir-300">{item.note}</p>}
        <p className="mt-1 font-mono text-xs tabular-nums text-noir-300">{formatPrice(item.price)} each</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={() => onChangeQty(item.id, -1)} aria-label={`Remove one ${item.name}`} className="grid h-10 w-10 place-items-center rounded-control border border-white/10 text-noir-100 transition hover:bg-noir-800 active:scale-95"><span className="text-xl leading-none">−</span></button>
        <span className="w-7 text-center font-mono text-sm font-bold tabular-nums">{item.qty}</span>
        <button onClick={() => onChangeQty(item.id, 1)} aria-label={`Add one ${item.name}`} className="grid h-10 w-10 place-items-center rounded-control border border-white/10 text-noir-100 transition hover:bg-noir-800 active:scale-95"><span className="text-xl leading-none">+</span></button>
      </div>
      <span className="w-20 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-noir-100">{formatPrice(item.price * item.qty)}</span>
      <button onClick={() => onRemove(item)} aria-label={`Remove ${item.name}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-control text-noir-500 transition hover:bg-status-danger/10 hover:text-status-danger">×</button>
    </article>
  );
}

export function CartPanel({ cart, subtotal, activeTabName, onChangeQty, onRemove, onClear, onHold, onSplit, onDiscount, onCharge }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col bg-noir-900 lg:h-full lg:flex-none lg:border-l lg:border-white/8">
      <header className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-4">
        <div><p className="text-xs font-semibold text-noir-300">Current order</p><h2 className="mt-1 max-w-[15rem] truncate text-base font-bold text-noir-100">{activeTabName || "Walk-in · Bar"}</h2></div>
        <button onClick={onClear} disabled={!cart.length} title="Clear order" className="min-h-10 rounded-control border border-white/10 px-3 text-xs font-semibold text-noir-300 transition hover:border-status-danger/40 hover:text-status-danger disabled:opacity-40">Clear</button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {cart.length ? cart.map(item => <CartItem key={item.id} item={item} onChangeQty={onChangeQty} onRemove={onRemove} />) : <div className="grid h-full min-h-48 place-items-center text-center"><div><ShoppingBag size={24} className="mx-auto mb-3 text-noir-500" /><p className="text-sm font-semibold text-noir-100">Order is empty</p><p className="mt-1 text-xs text-noir-300">Tap a product to add it</p></div></div>}
      </div>
      <footer className="shrink-0 border-t border-white/8 p-4">
        <div className="mb-3 grid grid-cols-3 gap-2">
          <button onClick={onHold} disabled={!cart.length} className="min-h-11 rounded-control border border-white/10 px-1 text-xs font-semibold text-noir-300 transition hover:bg-noir-850 disabled:opacity-40">Hold tab</button>
          <button onClick={onSplit} disabled={!cart.length} className="min-h-11 rounded-control border border-white/10 px-1 text-xs font-semibold text-noir-300 transition hover:bg-noir-850 disabled:opacity-40">Split bill</button>
          <button onClick={onDiscount} disabled={!cart.length} className="min-h-11 rounded-control border border-white/10 px-1 text-xs font-semibold text-noir-300 transition hover:bg-noir-850 disabled:opacity-40">Discount</button>
        </div>
        <div className="flex items-end justify-between border-t border-white/8 pt-3">
          <span className="text-sm text-noir-300">Subtotal</span><span className="font-mono text-sm tabular-nums text-noir-100">{formatPrice(subtotal)}</span>
        </div>
        <div className="mt-1 flex items-end justify-between">
          <span className="text-sm font-semibold text-noir-300">Total</span><span className="font-mono text-3xl font-bold tabular-nums text-noir-100">{formatPrice(subtotal)}</span>
        </div>
        <button onClick={onCharge} disabled={!cart.length} className="mt-4 min-h-14 w-full rounded-control bg-violet-500 text-base font-extrabold text-noir-950 shadow-active transition hover:bg-violet-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40">Charge · {formatPrice(subtotal)}</button>
      </footer>
    </section>
  );
}
