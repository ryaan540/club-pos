import { useEffect, useState } from "react";
import { STORAGE_KEYS, useLocalState, todayKey } from "./helpers.js";
import { SEED_USERS, SEED_PRODUCTS } from "./data.js";
import AdminDashboard from "./components/AdminDashboard.jsx";
import EmployeePOS from "./components/EmployeePOS.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import ManagerPanel from "./components/ManagerPanel.jsx";
import { apiEnabled, apiRequest, flushPendingSales, setApiToken } from "./api.js";

export default function App() {
  const [users, setUsers] = useLocalState(STORAGE_KEYS.USERS, SEED_USERS);
  const [products, setProducts] = useLocalState(STORAGE_KEYS.PRODUCTS, SEED_PRODUCTS);
  const [sales, setSales] = useLocalState(STORAGE_KEYS.SALES, []);
  const [expenses] = useLocalState(STORAGE_KEYS.EXPENSES, []);
  const [closedDays, setClosedDays] = useLocalState(STORAGE_KEYS.CLOSED_DAYS, {});
  const [currentUser, setCurrentUser] = useState(null);
  const [adminPosOpen, setAdminPosOpen] = useState(false);

  useEffect(() => {
    if (!apiEnabled) return;
    apiRequest("/api/auth/users").then(setUsers).catch(() => {});
  }, [setUsers]);

  useEffect(() => {
    if (!apiEnabled || !currentUser) return;
    let active = true;
    const loadSharedData = async () => {
      try {
        let catalog = await apiRequest("/api/products");
        if (!catalog.length && currentUser.role === "admin") {
          await apiRequest("/api/products/seed", {
            method: "POST",
            body: JSON.stringify({ products: SEED_PRODUCTS }),
          });
          catalog = await apiRequest("/api/products");
        }
        const sharedSales = await apiRequest("/api/sales");
        if (active && catalog.length) {
          setProducts(catalog.map(product => ({ ...product, price: product.current_price ?? product.price, image: product.image_url || "" })));
          setSales(sharedSales);
        }
      } catch {
        // Keep local state usable when the shared server is temporarily unreachable.
      }
    };
    void loadSharedData();
    return () => { active = false; };
  }, [currentUser, setProducts, setSales]);

  useEffect(() => {
    if (!apiEnabled) return undefined;
    const handleOnline = () => { void flushPendingSales(); };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    const legacyNames = new Set(["James Kariuki", "Amina Odhiambo", "Brian Mwangi", "Cynthia Achieng"]);
    const hasLegacy = users.some((u) => legacyNames.has(u.name));

    if (!hasLegacy) {
      const hasOwner = users.some((u) => u.role === "admin" && u.name === "Eric Muchina");
      if (!hasOwner && users.length === 0) {
        setUsers(SEED_USERS);
      }
      return;
    }

    const cleaned = users.filter((u) => !legacyNames.has(u.name));
    if (!cleaned.some((u) => u.role === "admin" && u.name === "Eric Muchina")) {
      cleaned.unshift({ ...SEED_USERS[0] });
    }
    setUsers(cleaned);
  }, [users, setUsers]);

  // Auto-load opening stock from previous day's close on first mount
  useEffect(() => {
    const sortedPrev = Object.keys(closedDays).filter(d => d < todayKey()).sort();
    const prevDay = sortedPrev[sortedPrev.length - 1];
    if (!prevDay) return;
    const prevClose = closedDays[prevDay];
    if (!prevClose?.closingStock) return;
    // Apply opening stock: restore stock from prev closing snapshot
    setProducts(prev => prev.map(p => {
      const snap = prevClose.closingStock.find(s => s.id === p.id);
      if (!snap) return p;
      // Only restore if we haven't already recorded sales today
      const todaySalesMade = sales.some(s => s.timestamp.slice(0, 10) === todayKey());
      if (todaySalesMade) return p; // don't override if day has started
      return { ...p, stock: snap.stock };
    }));
  }, []); // only on mount

  const handleLogout = () => {
    setApiToken(null);
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginScreen users={users} setUsers={setUsers} onLogin={setCurrentUser} />;
  }

  if (currentUser.role === "admin") {
    if (adminPosOpen) {
      return <EmployeePOS
        user={currentUser} users={users} products={products} sales={sales}
        setSales={setSales} setProducts={setProducts} closedDays={closedDays}
        onLogout={handleLogout} onBackToAdmin={() => setAdminPosOpen(false)}
      />;
    }
    return <AdminDashboard
      user={currentUser} sales={sales} products={products}
      expenses={expenses} closedDays={closedDays}
      onClosedDaysUpdate={setClosedDays} users={users} setUsers={setUsers}
      setProducts={setProducts}
      onOpenPOS={() => setAdminPosOpen(true)}
      onLogout={handleLogout}
    />;
  }

  if (currentUser.role === "manager") {
    return <ManagerPanel
      user={currentUser} products={products} setProducts={setProducts}
      users={users} setUsers={setUsers} sales={sales}
      expenses={expenses} closedDays={closedDays}
      onClosedDaysUpdate={setClosedDays}
      onLogout={handleLogout}
    />;
  }

  return <EmployeePOS
    user={currentUser} users={users} products={products} sales={sales}
    setSales={setSales} setProducts={setProducts}
    closedDays={closedDays}
    onLogout={handleLogout}
  />;
}
