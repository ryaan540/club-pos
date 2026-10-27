import { useState } from "react";
import { ArrowLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { apiEnabled, loginWithApi, setApiToken } from "../api.js";

function LoginScreen({ users, setUsers, onLogin }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  const [newProfile, setNewProfile] = useState({ name: "", role: "employee", pin: "", confirmPin: "" });

  const handleSelect = (u) => { setSelected(u); setPin(""); setError(""); };
  const handleLogin = async () => {
    if (!selected) return;
    if (apiEnabled) {
      setBusy(true);
      try {
        const result = await loginWithApi(selected.name, pin);
        setApiToken(result.access_token);
        onLogin(result.user);
      } catch (loginError) {
        setError(loginError.message);
        setPin("");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (selected.pin === pin) { onLogin(selected); }
    else { setError("Incorrect PIN. Try again."); setPin(""); }
  };

  const handleCreateProfile = () => {
    const name = newProfile.name.trim();
    const pinValue = newProfile.pin.trim();
    const confirmPin = newProfile.confirmPin.trim();

    if (!name || !pinValue) {
      setError("Please enter a name and PIN.");
      return;
    }
    if (pinValue.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    if (pinValue !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    const role = pendingRole === "manager" ? "manager" : "employee";
    const createdUser = { id: Date.now(), name, role, pin: pinValue, email: "" };
    setUsers(prev => [...prev, createdUser]);
    setShowCreateForm(false);
    setPendingRole(null);
    setNewProfile({ name: "", role: "employee", pin: "", confirmPin: "" });
    setError("");
    onLogin(createdUser);
  };

  const roleLabel = (r) => ({ admin: "Owner", manager: "Manager", bartender: "Bartender", employee: "Bartender", cashier: "Cashier", car_wash_attendant: "Car Wash Attendant" })[r] || r;
  const roleColor = (r) => r === "admin" ? "#f5a623" : r === "manager" ? "#a78bfa" : r === "car_wash_attendant" ? "#34d399" : "#38bdf8";

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center"
      style={{ fontFamily: "'DM Sans', sans-serif", background: "radial-gradient(circle at top, rgba(245,166,35,0.14), transparent 22%), radial-gradient(circle at bottom right, rgba(56,189,248,0.10), transparent 20%), var(--background)" }}>
      <div className="text-center mb-10">
        <p className="text-5xl font-black tracking-widest uppercase mb-2"
          style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--primary)" }}>
          NOIR POS
        </p>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Select your profile to continue</p>
      </div>

      {!selected ? (
        apiEnabled ? (
          <div className="flex max-h-[60vh] w-80 flex-col gap-3 overflow-y-auto">
            {users.map(profile => (
              <button key={profile.id} onClick={() => handleSelect(profile)}
                className="flex items-center gap-4 rounded-xl border px-5 py-4 text-left transition-all hover:bg-white/[0.08]"
                style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold" style={{ background: `${roleColor(profile.role)}22`, color: roleColor(profile.role) }}>{profile.name[0]}</div>
                <div><p className="text-sm font-semibold text-white">{profile.name}</p><p className="text-xs" style={{ color: roleColor(profile.role) }}>{roleLabel(profile.role)}</p></div>
                <ChevronRight size={16} className="ml-auto text-white/40" />
              </button>
            ))}
            {!users.length && <p className="text-sm text-white/50">No active staff profiles are configured.</p>}
          </div>
        ) : showCreateForm ? (
          <div className="w-80 flex flex-col gap-4">
            <button onClick={() => { setShowCreateForm(false); setPendingRole(null); setError(""); }} className="flex items-center gap-2 text-sm"
              style={{ color: "var(--muted-foreground)" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <div className="rounded-3xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
              <p className="font-black uppercase tracking-widest mb-4" style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "var(--foreground)" }}>
                {pendingRole === "manager" ? "Create Manager Profile" : "Create Bartender Profile"}
              </p>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest mb-1 block" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>Preferred Name</label>
                  <input value={newProfile.name} onChange={e => setNewProfile(f => ({ ...f, name: e.target.value }))}
                    placeholder={pendingRole === "manager" ? "e.g. Moses" : "e.g. Joy"}
                    className="w-full px-4 py-3 rounded-xl text-sm"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest mb-1 block" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>Password</label>
                  <input type="password" value={newProfile.pin} onChange={e => setNewProfile(f => ({ ...f, pin: e.target.value }))}
                    placeholder="4+ digits"
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl text-sm"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest mb-1 block" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>Confirm Password</label>
                  <input type="password" value={newProfile.confirmPin} onChange={e => setNewProfile(f => ({ ...f, confirmPin: e.target.value }))}
                    placeholder="Repeat PIN"
                    maxLength={6}
                    className="w-full px-4 py-3 rounded-xl text-sm"
                    style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)", outline: "none" }} />
                </div>
                {error && <p className="text-xs" style={{ color: "var(--accent)" }}>{error}</p>}
                <button onClick={handleCreateProfile}
                  className="py-3 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.22)] active:scale-[0.98]"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem", background: "var(--primary)", color: "var(--primary-foreground)" }}>
                  Create Profile <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 w-80">
            <button onClick={() => handleSelect(users.find(u => u.role === "admin") || { id: 0, name: "Eric Muchina", role: "admin", pin: "1234" })}
              className="flex items-center gap-4 px-5 py-4 rounded-3xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.22)] active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                style={{ background: roleColor("admin") + "22", color: roleColor("admin"), border: `1px solid ${roleColor("admin")}44` }}>
                E
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Eric Muchina</p>
                <p className="text-xs" style={{ color: roleColor("admin"), fontFamily: "'DM Mono', monospace" }}>Owner</p>
              </div>
              <ChevronRight size={16} className="ml-auto" style={{ color: "var(--muted-foreground)" }} />
            </button>

            <button onClick={() => {
              const existingManager = users.find(u => u.role === "manager");
              if (existingManager) {
                handleSelect(existingManager);
              } else {
                setPendingRole("manager");
                setNewProfile(f => ({ ...f, role: "manager" }));
                setShowCreateForm(true);
                setError("");
              }
            }}
              className="flex items-center gap-4 px-5 py-4 rounded-3xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.22)] active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                style={{ background: roleColor("manager") + "22", color: roleColor("manager"), border: `1px solid ${roleColor("manager")}44` }}>
                M
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Manager</p>
                <p className="text-xs" style={{ color: roleColor("manager"), fontFamily: "'DM Mono', monospace" }}>Create or sign in</p>
              </div>
              <ChevronRight size={16} className="ml-auto" style={{ color: "var(--muted-foreground)" }} />
            </button>

            <button onClick={() => {
              const existingBartender = users.find(u => u.role === "employee");
              if (existingBartender) {
                handleSelect(existingBartender);
              } else {
                setPendingRole("bartender");
                setNewProfile(f => ({ ...f, role: "employee" }));
                setShowCreateForm(true);
                setError("");
              }
            }}
              className="flex items-center gap-4 px-5 py-4 rounded-3xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.22)] active:scale-[0.98]"
              style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.12)" }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                style={{ background: roleColor("employee") + "22", color: roleColor("employee"), border: `1px solid ${roleColor("employee")}44` }}>
                B
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>Bartender</p>
                <p className="text-xs" style={{ color: roleColor("employee"), fontFamily: "'DM Mono', monospace" }}>Create or sign in</p>
              </div>
              <ChevronRight size={16} className="ml-auto" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </div>
        )
      ) : (
        <div className="w-80 flex flex-col gap-4">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm mb-2"
            style={{ color: "var(--muted-foreground)" }}>
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-4 px-5 py-4 rounded-xl border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
              style={{ background: roleColor(selected.role) + "22", color: roleColor(selected.role) }}>
              {selected.name[0]}
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--foreground)" }}>{selected.name}</p>
              <p className="text-xs" style={{ color: roleColor(selected.role), fontFamily: "'DM Mono', monospace" }}>{roleLabel(selected.role)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs mb-2 uppercase tracking-widest" style={{ color: "var(--muted-foreground)", fontFamily: "'DM Mono', monospace" }}>Enter PIN</p>
            <div className="relative">
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={e => { setPin(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                maxLength={6}
                placeholder="••••"
                className="w-full px-4 py-3 rounded-xl text-lg tracking-widest"
                style={{
                  background: "var(--secondary)", border: `1px solid ${error ? "var(--accent)" : "var(--border)"}`,
                  color: "var(--foreground)", fontFamily: "'DM Mono', monospace", outline: "none"
                }}
                autoFocus
              />
              <button onClick={() => setShowPin(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}>
                {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {error && <p className="text-xs mt-1.5" style={{ color: "var(--accent)" }}>{error}</p>}
          </div>
          <button onClick={handleLogin}
            className="py-3 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_50px_rgba(0,0,0,0.22)] active:scale-[0.98]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem", background: "var(--primary)", color: "var(--primary-foreground)" }}>
            {busy ? "Signing in…" : "Sign In"} <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

export default LoginScreen;

// ─── PDF RECEIPT GENERATOR ───────────────────────────────────────────────────

