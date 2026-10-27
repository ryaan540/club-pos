import { useEffect, useState } from "react";
import { apiEnabled, apiRequest } from "../api.js";
import { formatPrice, now, useLocalState } from "../helpers.js";
import { CarFront, Check, Clock3, Plus, RefreshCw, UserRound, X } from "lucide-react";
import Topbar from "./Topbar.jsx";
import PaymentDetails from "./PaymentDetails.jsx";
import ReceiptModal from "./ReceiptModal.jsx";

const VEHICLES = ["Saloon", "SUV", "Pickup", "Van", "Motorbike"];
const VEHICLE_MULTIPLIER = { Saloon: 1, SUV: 1.25, Pickup: 1.3, Van: 1.35, Motorbike: 0.65 };
const SERVICES = [
  { name: "Basic Wash", price: 700, minutes: 25 },
  { name: "Full Wash", price: 1200, minutes: 45 },
  { name: "Interior Detailing", price: 1800, minutes: 70 },
  { name: "Engine Wash", price: 1000, minutes: 40 },
  { name: "Polish / Wax", price: 2500, minutes: 90 },
  { name: "Tyre Shine", price: 300, minutes: 10 },
  { name: "Seat Shampoo", price: 1200, minutes: 60 },
];
const NEXT_STATUS = { Queued: "In Progress", "In Progress": "Ready", Ready: "Paid/Collected" };

function CarWashPOS({ user, users, onLogout, onSale }) {
  const [localJobs, setLocalJobs] = useLocalState("noir_wash_jobs", []);
  const [jobs, setJobs] = useState(localJobs);
  const [attendants, setAttendants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [checkoutJob, setCheckoutJob] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ plate: "", vehicle_type: "Saloon", customer: "", phone: "", serviceNames: ["Basic Wash"], attendant_id: "", commission: "" });

  const selectedServices = SERVICES.filter(service => form.serviceNames.includes(service.name));
  const total = Math.round(selectedServices.reduce((sum, service) => sum + service.price, 0) * VEHICLE_MULTIPLIER[form.vehicle_type]);

  const refresh = async () => {
    if (!apiEnabled) return;
    try {
      const [serverJobs, staff] = await Promise.all([
        apiRequest("/api/wash/jobs"),
        apiRequest("/api/attendants"),
      ]);
      setJobs(serverJobs);
      setAttendants(staff);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  useEffect(() => {
    if (!apiEnabled) return undefined;
    void Promise.resolve().then(refresh);
    const poll = window.setInterval(refresh, 20000);
    return () => window.clearInterval(poll);
  }, []);

  const submitJob = async () => {
    if (!form.plate.trim() || !selectedServices.length) return;
    setBusy(true);
    const job = {
      plate: form.plate.trim().toUpperCase(), vehicle_type: form.vehicle_type,
      customer: form.customer.trim(), phone: form.phone.trim(), total,
      estimated_minutes: selectedServices.reduce((sum, service) => sum + service.minutes, 0),
      services: selectedServices.map(service => ({ ...service, price: Math.round(service.price * VEHICLE_MULTIPLIER[form.vehicle_type]), qty: 1 })),
      attendant_id: form.attendant_id || null,
      commission: Number(form.commission) || 0,
    };
    try {
      if (apiEnabled) {
        const created = await apiRequest("/api/wash/jobs", { method: "POST", body: JSON.stringify(job) });
        setJobs(previous => [...previous, created]);
      } else {
        const created = { ...job, id: crypto.randomUUID(), status: "Queued", created_at: new Date().toISOString(), attendant: "" };
        setLocalJobs(previous => [...previous, created]);
        setJobs(previous => [...previous, created]);
      }
      setForm({ plate: "", vehicle_type: "Saloon", customer: "", phone: "", serviceNames: ["Basic Wash"], attendant_id: "", commission: "" });
      setShowForm(false);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const advanceJob = async job => {
    const status = NEXT_STATUS[job.status];
    if (!status) return;
    if (status === "Paid/Collected") {
      setCheckoutJob({ ...job, clientId: crypto.randomUUID() });
      setPaymentMethod("cash");
      return;
    }
    try {
      if (apiEnabled) {
        const updated = await apiRequest(`/api/wash/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
        setJobs(previous => previous.map(item => item.id === job.id ? updated : item));
      } else {
        setJobs(previous => previous.map(item => item.id === job.id ? { ...item, status } : item));
        setLocalJobs(previous => previous.map(item => item.id === job.id ? { ...item, status } : item));
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const completeCollection = async details => {
    if (!checkoutJob) return;
    setBusy(true);
    setError("");
    const items = checkoutJob.services.map((service, index) => ({
      id: `${checkoutJob.id}-${index}`, name: service.name, category: "Car Wash",
      price: service.price, qty: service.qty || 1,
    }));
    const paymentPayload = {
      status: "Paid/Collected", client_id: checkoutJob.clientId,
      method: details.method, payments: details.payments, discount: details.discount,
      tip: details.tip, discountApprovalToken: details.discountApprovalToken,
    };
    try {
      let updated = { ...checkoutJob, status: "Paid/Collected" };
      if (apiEnabled) {
        updated = await apiRequest(`/api/wash/jobs/${checkoutJob.id}`, {
          method: "PATCH", body: JSON.stringify(paymentPayload),
        });
      } else {
        setLocalJobs(previous => previous.map(job => job.id === checkoutJob.id ? updated : job));
      }
      setJobs(previous => previous.map(job => job.id === checkoutJob.id ? updated : job));
      const sale = {
        id: updated.sale_id || checkoutJob.clientId,
        clientId: checkoutJob.clientId, timestamp: now(), department: "car_wash",
        items, subtotal: checkoutJob.total, discount: details.discount, tip: details.tip,
        total: details.total, method: details.method, payments: details.payments,
        change: details.change, customer: checkoutJob.customer, phone: checkoutJob.phone,
        notes: `Vehicle ${checkoutJob.plate}`, servedBy: user.name, userId: user.id,
      };
      onSale(sale);
      setReceiptSale(sale);
      setCheckoutJob(null);
    } catch (requestError) {
      setError(requestError.message);
      throw requestError;
    } finally {
      setBusy(false);
    }
  };

  const activeJobs = jobs.filter(job => job.status !== "Paid/Collected");
  const queuePosition = job => activeJobs.findIndex(item => item.id === job.id) + 1;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(39,174,146,0.12), transparent 35%), linear-gradient(180deg, #090d0e 0%, #0e1414 100%)" }}>
      <Topbar user={user} onLogout={onLogout} title="Car Wash Queue" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-300/70">Service bay</p>
              <h1 className="text-2xl font-bold mt-1">{activeJobs.length} vehicles in queue</h1>
            </div>
            <div className="flex gap-2">
              {apiEnabled && <button onClick={() => void refresh()} title="Refresh queue" className="w-11 h-11 flex items-center justify-center border border-white/10 bg-white/5"><RefreshCw size={17} /></button>}
              <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 h-11 bg-emerald-400 text-emerald-950 font-bold"><Plus size={18} /> New job</button>
            </div>
          </div>

          {error && <div className="mb-4 px-4 py-3 border border-rose-400/30 bg-rose-400/10 text-sm text-rose-200">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeJobs.map(job => (
              <article key={job.id} className="border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xl font-bold tracking-wider">{job.plate}</p>
                    <p className="mt-1 text-xs text-white/55">{job.vehicle_type}{job.customer ? ` · ${job.customer}` : ""}</p>
                  </div>
                  <span className={`px-2 py-1 text-[11px] uppercase tracking-wide ${job.status === "Ready" ? "bg-emerald-400/15 text-emerald-200" : job.status === "In Progress" ? "bg-amber-300/15 text-amber-100" : "bg-sky-300/15 text-sky-100"}`}>{job.status}</span>
                </div>
                <div className="mt-4 space-y-2">
                  {(job.services || []).map((service, index) => <div key={`${service.name}-${index}`} className="flex justify-between text-sm"><span className="text-white/75">{service.name}</span><span className="text-white/55">{formatPrice(service.price)}</span></div>)}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <div>
                    <p className="font-semibold text-emerald-200">{formatPrice(job.total)}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-white/45"><Clock3 size={12} /> #{queuePosition(job)} · {job.estimated_minutes} min · {job.attendant || "Unassigned"}</p>
                  </div>
                  <button onClick={() => void advanceJob(job)} className="flex h-10 items-center gap-2 border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold">
                    {job.status === "Ready" ? <Check size={15} /> : <CarFront size={15} />}{job.status === "Ready" ? "Collect & pay" : NEXT_STATUS[job.status]}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!activeJobs.length && <div className="border border-dashed border-white/15 py-16 text-center text-white/45"><CarFront className="mx-auto mb-3" size={30} /><p>No active wash jobs</p></div>}

          {showForm && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={event => event.target === event.currentTarget && setShowForm(false)}>
              <section className="max-h-[94svh] w-full max-w-xl overflow-y-auto border border-white/10 bg-[#101819] p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-emerald-300/70">New intake</p><h2 className="mt-1 text-xl font-bold">Create wash job</h2></div><button onClick={() => setShowForm(false)} className="p-2 text-white/50"><X size={19} /></button></div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 text-xs text-white/55">Plate number<input value={form.plate} onChange={event => setForm(previous => ({ ...previous, plate: event.target.value }))} placeholder="KDA 123A" className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-3 text-base text-white" /></label>
                  <label className="text-xs text-white/55">Vehicle<select value={form.vehicle_type} onChange={event => setForm(previous => ({ ...previous, vehicle_type: event.target.value }))} className="mt-1 w-full border border-white/10 bg-[#172020] px-3 py-3 text-white">{VEHICLES.map(vehicle => <option key={vehicle}>{vehicle}</option>)}</select></label>
                  <label className="text-xs text-white/55">Customer<input value={form.customer} onChange={event => setForm(previous => ({ ...previous, customer: event.target.value }))} placeholder="Optional" className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-3 text-white" /></label>
                  <label className="text-xs text-white/55">Phone<input value={form.phone} onChange={event => setForm(previous => ({ ...previous, phone: event.target.value }))} placeholder="Optional" className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-3 text-white" /></label>
                  <label className="text-xs text-white/55">Attendant<select value={form.attendant_id} onChange={event => setForm(previous => ({ ...previous, attendant_id: event.target.value }))} className="mt-1 w-full border border-white/10 bg-[#172020] px-3 py-3 text-white"><option value="">Unassigned</option>{attendants.map(attendant => <option key={attendant.id} value={attendant.id}>{attendant.name}</option>)}</select></label>
                  <label className="col-span-2 text-xs text-white/55">Attendant commission (KSh)<input type="number" min="0" value={form.commission} onChange={event => setForm(previous => ({ ...previous, commission: event.target.value }))} placeholder="0" className="mt-1 w-full border border-white/10 bg-white/[0.04] px-3 py-3 text-white" /></label>
                </div>
                <p className="mb-2 mt-5 text-xs uppercase tracking-widest text-white/50">Services</p>
                <div className="divide-y divide-white/10 border-y border-white/10">
                  {SERVICES.map(service => {
                    const checked = form.serviceNames.includes(service.name);
                    return <label key={service.name} className="flex cursor-pointer items-center gap-3 py-3"><input type="checkbox" checked={checked} onChange={() => setForm(previous => ({ ...previous, serviceNames: checked ? previous.serviceNames.filter(name => name !== service.name) : [...previous.serviceNames, service.name] }))} className="h-5 w-5 accent-emerald-400" /><span className="flex-1 text-sm">{service.name}</span><span className="text-sm text-white/55">{formatPrice(Math.round(service.price * VEHICLE_MULTIPLIER[form.vehicle_type]))}</span></label>;
                  })}
                </div>
                <div className="mt-5 flex items-center justify-between"><span className="flex items-center gap-2 text-sm text-white/55"><UserRound size={15} /> Price for {form.vehicle_type}</span><strong className="text-xl text-emerald-200">{formatPrice(total)}</strong></div>
                <button disabled={busy || !form.plate.trim() || !selectedServices.length} onClick={() => void submitJob()} className="mt-5 h-12 w-full bg-emerald-400 font-bold text-emerald-950 disabled:opacity-40">{busy ? "Saving…" : "Add to queue"}</button>
              </section>
            </div>
          )}
        </div>
      </main>
      {checkoutJob && <div className="fixed inset-0 z-40 overflow-y-auto bg-[#090d0e] sm:flex sm:justify-center"><div className="flex min-h-full w-full max-w-xl flex-col"><PaymentDetails
        cart={checkoutJob.services.map((service, index) => ({ ...service, id: `${checkoutJob.id}-${index}`, qty: service.qty || 1 }))}
        total={checkoutJob.total} users={users} paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod} onBack={() => setCheckoutJob(null)}
        onConfirm={completeCollection}
      /></div></div>}
      <ReceiptModal sale={receiptSale} onClose={() => setReceiptSale(null)} />
    </div>
  );
}

export default CarWashPOS;