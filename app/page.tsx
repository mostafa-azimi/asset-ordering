"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Order,
  Stage,
  STAGES,
  STAGE_META,
  AttachmentKind,
  AttachmentMeta,
  orderTotal,
  money,
} from "@/lib/types";
import {
  fetchOrders,
  insertOrder,
  updateStage,
  deleteOrder as sbDeleteOrder,
  uploadAttachment,
  removeAttachment as sbRemoveAttachment,
  uid,
} from "@/lib/storage";
import Dropzone from "@/components/Dropzone";
import {
  Plus,
  Sun,
  Moon,
  Check,
  Truck,
  Card,
  Clock,
  Doc,
  Cash,
  Shield,
  Inbox,
} from "@/components/Icons";

type Filter = "all" | Stage;
type Toast = { id: string; msg: string; color: string };

const CURRENT_USER = "You";

export default function Page() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ---- load ---- */
  useEffect(() => {
    const t =
      (document.documentElement.getAttribute("data-theme") as
        | "dark"
        | "light") || "dark";
    setTheme(t);
    (async () => {
      try {
        const data = await fetchOrders();
        setOrders(data);
      } catch (e: any) {
        setLoadError(e?.message || "Could not load orders from Supabase.");
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function reload() {
    try {
      setOrders(await fetchOrders());
    } catch (e: any) {
      setLoadError(e?.message || "Could not load orders.");
    }
  }

  function toast(msg: string, color = "var(--emerald)") {
    const id = uid("t");
    setToasts((p) => [...p, { id, msg, color }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 2600);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("procureflow.theme", next);
    } catch {}
  }

  /* ---- derived ---- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => (filter === "all" ? true : o.stage === filter))
      .filter((o) =>
        q
          ? [o.title, o.vendor, o.category, o.requestedBy]
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [orders, filter, query]);

  const stats = useMemo(() => {
    const openValue = orders
      .filter((o) => o.stage !== "paid")
      .reduce((s, o) => s + orderTotal(o), 0);
    return {
      pending: orders.filter((o) => o.stage === "requested").length,
      inFlight: orders.filter(
        (o) => o.stage === "approved" || o.stage === "delivered"
      ).length,
      awaitingPay: orders.filter((o) => o.stage === "delivered").length,
      openValue,
    };
  }, [orders]);

  const openOrder = openId
    ? orders.find((o) => o.id === openId) || null
    : null;

  /* ---- mutations (persisted to Supabase, then reflected locally) ---- */
  async function createOrder(data: Partial<Order>) {
    setBusy(true);
    try {
      const created = await insertOrder({
        title: data.title || "Untitled request",
        vendor: data.vendor || "",
        category: data.category || "General",
        quantity: data.quantity || 1,
        unitCost: data.unitCost || 0,
        currency: data.currency || "USD",
        requestedBy: data.requestedBy || CURRENT_USER,
        neededBy: data.neededBy,
        notes: data.notes,
      });
      setOrders((p) => [created, ...p]);
      setShowNew(false);
      toast("Request created", "var(--amber)");
    } catch (e: any) {
      toast(e?.message || "Failed to create request", "var(--danger)");
    } finally {
      setBusy(false);
    }
  }

  async function advance(id: string) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const idx = STAGES.indexOf(o.stage);
    if (idx >= STAGES.length - 1) return;
    const next = STAGES[idx + 1];
    const now = Date.now();
    setBusy(true);
    try {
      await updateStage(o, next);
      setOrders((p) =>
        p.map((x) =>
          x.id === id
            ? {
                ...x,
                stage: next,
                updatedAt: now,
                history: [...x.history, { stage: next, at: now, by: CURRENT_USER }],
              }
            : x
        )
      );
      const meta = STAGE_META[next];
      toast(`Marked ${meta.label.toLowerCase()}`, `var(--${meta.color})`);
    } catch (e: any) {
      toast(e?.message || "Update failed", "var(--danger)");
    } finally {
      setBusy(false);
    }
  }

  async function revert(id: string) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const idx = STAGES.indexOf(o.stage);
    if (idx <= 0) return;
    const prev = STAGES[idx - 1];
    const now = Date.now();
    setBusy(true);
    try {
      await updateStage(o, prev, "reverted");
      setOrders((p) =>
        p.map((x) =>
          x.id === id
            ? {
                ...x,
                stage: prev,
                updatedAt: now,
                history: [
                  ...x.history,
                  { stage: prev, at: now, by: CURRENT_USER, note: "reverted" },
                ],
              }
            : x
        )
      );
      toast("Moved back a step", "var(--danger)");
    } catch (e: any) {
      toast(e?.message || "Update failed", "var(--danger)");
    } finally {
      setBusy(false);
    }
  }

  async function removeOrder(id: string) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    setBusy(true);
    try {
      await sbDeleteOrder(o);
      setOrders((p) => p.filter((x) => x.id !== id));
      setOpenId(null);
      toast("Order deleted", "var(--danger)");
    } catch (e: any) {
      toast(e?.message || "Delete failed", "var(--danger)");
    } finally {
      setBusy(false);
    }
  }

  async function addAttachments(
    orderId: string,
    kind: AttachmentKind,
    files: FileList | File[]
  ) {
    const list = Array.from(files);
    setBusy(true);
    try {
      const metas: AttachmentMeta[] = [];
      for (const f of list) {
        metas.push(await uploadAttachment(orderId, kind, f));
      }
      setOrders((p) =>
        p.map((o) =>
          o.id === orderId
            ? { ...o, attachments: [...o.attachments, ...metas], updatedAt: Date.now() }
            : o
        )
      );
      toast(`${metas.length} file${metas.length > 1 ? "s" : ""} uploaded`);
    } catch (e: any) {
      toast(e?.message || "Upload failed", "var(--danger)");
    } finally {
      setBusy(false);
    }
  }

  async function removeAttachment(orderId: string, attId: string) {
    const o = orders.find((x) => x.id === orderId);
    const att = o?.attachments.find((a) => a.id === attId);
    if (!att) return;
    try {
      await sbRemoveAttachment(att);
      setOrders((p) =>
        p.map((x) =>
          x.id === orderId
            ? { ...x, attachments: x.attachments.filter((a) => a.id !== attId) }
            : x
        )
      );
    } catch (e: any) {
      toast(e?.message || "Could not remove file", "var(--danger)");
    }
  }

  if (!ready) {
    return (
      <div className="shell">
        <div className="empty" style={{ marginTop: 80 }}>
          <div className="big">Loading…</div>
          <div>Connecting to your database.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="logo">
          <span className="logo-mark">
            <Shield size={20} />
          </span>
          <div>
            ProcureFlow
            <small>Order approvals &amp; payment control</small>
          </div>
        </div>
        <div className="spacer" />
        <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> New request
        </button>
      </header>

      {loadError && (
        <div
          className="action-cta"
          style={{
            background: "var(--danger-soft)",
            borderColor: "var(--danger)",
            marginBottom: 16,
          }}
        >
          <div className="txt">
            <div className="t1">Couldn&apos;t reach the database</div>
            <div className="t2">{loadError}</div>
          </div>
          <button className="btn btn-ghost" onClick={reload}>
            Retry
          </button>
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="k">
            <span className="dot" style={{ background: "var(--amber)" }} />
            Awaiting approval
          </div>
          <div className="v">{stats.pending}</div>
          <div className="sub">requests need a decision</div>
        </div>
        <div className="stat">
          <div className="k">
            <span className="dot" style={{ background: "var(--sky)" }} />
            In flight
          </div>
          <div className="v">{stats.inFlight}</div>
          <div className="sub">approved or delivered</div>
        </div>
        <div className="stat">
          <div className="k">
            <span className="dot" style={{ background: "var(--violet)" }} />
            Awaiting payment
          </div>
          <div className="v">{stats.awaitingPay}</div>
          <div className="sub">delivered, not yet paid</div>
        </div>
        <div className="stat">
          <div className="k">
            <span className="dot" style={{ background: "var(--emerald)" }} />
            Open commitment
          </div>
          <div className="v">{money(stats.openValue)}</div>
          <div className="sub">value not yet paid</div>
        </div>
      </div>

      <div className="controls">
        <div className="search-wrap">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="search"
            placeholder="Search by item, vendor, category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="segmented">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          {STAGES.map((st) => (
            <button
              key={st}
              className={filter === st ? "active" : ""}
              onClick={() => setFilter(st)}
            >
              {STAGE_META[st].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <Inbox size={30} />
          <div className="big">
            {orders.length === 0 ? "No requests yet" : "Nothing matches"}
          </div>
          <div>
            {orders.length === 0
              ? "Create your first order request to start the approval trail."
              : "Try a different filter or search term."}
          </div>
          {orders.length === 0 && (
            <button
              className="btn btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => setShowNew(true)}
            >
              <Plus size={16} /> New request
            </button>
          )}
        </div>
      ) : (
        <div className="grid">
          {filtered.map((o) => (
            <OrderCard key={o.id} o={o} onClick={() => setOpenId(o.id)} />
          ))}
        </div>
      )}

      {showNew && (
        <NewOrderModal
          onClose={() => setShowNew(false)}
          onCreate={createOrder}
        />
      )}

      {openOrder && (
        <DetailModal
          o={openOrder}
          onClose={() => setOpenId(null)}
          onAdvance={() => advance(openOrder.id)}
          onRevert={() => revert(openOrder.id)}
          onDelete={() => removeOrder(openOrder.id)}
          onAddFiles={(kind, files) =>
            addAttachments(openOrder.id, kind, files)
          }
          onRemoveFile={(attId) => removeAttachment(openOrder.id, attId)}
        />
      )}

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <span className="dot" style={{ background: t.color }} />
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ Order card ============ */
function OrderCard({ o, onClick }: { o: Order; onClick: () => void }) {
  const meta = STAGE_META[o.stage];
  const idx = STAGES.indexOf(o.stage);
  return (
    <div className="card" onClick={onClick}>
      <div className="card-head">
        <div style={{ minWidth: 0 }}>
          <h3>{o.title}</h3>
          <div className="vendor">{o.vendor || "No vendor"} · {o.category}</div>
        </div>
        <span className={`badge badge-${meta.color}`}>
          <span
            className="dot"
            style={{ background: `var(--${meta.color})` }}
          />
          {meta.label}
        </span>
      </div>
      <div className="amount">{money(orderTotal(o), o.currency)}</div>
      <div className="meta-row">
        <span>
          {o.quantity} × {money(o.unitCost, o.currency)}
        </span>
        <span>·</span>
        <span>by {o.requestedBy}</span>
      </div>

      <div className="track">
        {STAGES.map((_, i) => (
          <span key={i} className={`seg${i <= idx ? " on" : ""}`} />
        ))}
      </div>
      <div className="track-labels">
        <span>Requested</span>
        <span>Approved</span>
        <span>Delivered</span>
        <span>Paid</span>
      </div>

      <div className="attach-count">
        <Doc size={13} />
        {o.attachments.length} file{o.attachments.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/* ============ New order modal ============ */
function NewOrderModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (d: Partial<Order>) => void;
}) {
  const [f, setF] = useState({
    title: "",
    vendor: "",
    category: "Equipment",
    quantity: "1",
    unitCost: "",
    currency: "USD",
    requestedBy: CURRENT_USER,
    neededBy: "",
    notes: "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const valid = f.title.trim().length > 0;
  const total =
    (parseFloat(f.quantity) || 0) * (parseFloat(f.unitCost) || 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>New order request</h2>
            <p>This starts the approval trail. Attach the quote or spec next.</p>
          </div>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>What are you ordering?*</label>
            <input
              value={f.title}
              autoFocus
              placeholder="e.g. 24× ergonomic desk chairs"
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="row2">
            <div className="field">
              <label>Vendor / supplier</label>
              <input
                value={f.vendor}
                placeholder="e.g. Herman Miller"
                onChange={(e) => set("vendor", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Category</label>
              <select
                value={f.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {["Equipment", "Software", "Services", "Supplies", "Travel", "General"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  )
                )}
              </select>
            </div>
          </div>
          <div className="row3">
            <div className="field">
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                value={f.quantity}
                onChange={(e) => set("quantity", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Unit cost</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={f.unitCost}
                placeholder="0.00"
                onChange={(e) => set("unitCost", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Currency</label>
              <select
                value={f.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>Requested by</label>
              <input
                value={f.requestedBy}
                onChange={(e) => set("requestedBy", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Needed by</label>
              <input
                type="date"
                value={f.neededBy}
                onChange={(e) => set("neededBy", e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>Notes / justification</label>
            <textarea
              value={f.notes}
              placeholder="Why is this needed? Any context for the approver."
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-dim)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Estimated total</span>
            <strong style={{ color: "var(--text)", fontSize: 16 }}>
              {money(total, f.currency)}
            </strong>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={() =>
              onCreate({
                title: f.title.trim(),
                vendor: f.vendor.trim(),
                category: f.category,
                quantity: parseInt(f.quantity) || 1,
                unitCost: parseFloat(f.unitCost) || 0,
                currency: f.currency,
                requestedBy: f.requestedBy.trim() || CURRENT_USER,
                neededBy: f.neededBy || undefined,
                notes: f.notes.trim() || undefined,
              })
            }
          >
            <Plus size={16} /> Create request
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Detail modal ============ */
function DetailModal({
  o,
  onClose,
  onAdvance,
  onRevert,
  onDelete,
  onAddFiles,
  onRemoveFile,
}: {
  o: Order;
  onClose: () => void;
  onAdvance: () => void;
  onRevert: () => void;
  onDelete: () => void;
  onAddFiles: (kind: AttachmentKind, files: FileList | File[]) => void;
  onRemoveFile: (attId: string) => void;
}) {
  const idx = STAGES.indexOf(o.stage);
  const meta = STAGE_META[o.stage];
  const nextStage = idx < STAGES.length - 1 ? STAGES[idx + 1] : null;

  const advanceCopy: Record<Stage, { cta: string; icon: React.ReactNode; desc: string }> = {
    requested: {
      cta: "Approve request",
      icon: <Check size={16} />,
      desc: "Confirm budget and authorize this purchase to proceed.",
    },
    approved: {
      cta: "Mark delivered",
      icon: <Truck size={16} />,
      desc: "Confirm the goods or services were received. Attach a delivery confirmation.",
    },
    delivered: {
      cta: "Validate payment",
      icon: <Card size={16} />,
      desc: "Confirm the invoice was paid. Attach the receipt to close the loop.",
    },
    paid: {
      cta: "Closed",
      icon: <Check size={16} />,
      desc: "This order is fully validated and paid.",
    },
  };
  const cur = advanceCopy[o.stage];

  const reqFiles = o.attachments.filter((a) => a.kind === "request");
  const receiptFiles = o.attachments.filter((a) => a.kind === "receipt");

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ minWidth: 0 }}>
            <span
              className={`badge badge-${meta.color}`}
              style={{ marginBottom: 8 }}
            >
              <span className="dot" style={{ background: `var(--${meta.color})` }} />
              {meta.label}
            </span>
            <h2>{o.title}</h2>
            <p>
              {o.vendor || "No vendor"} · {o.category} · {money(orderTotal(o), o.currency)}
            </p>
          </div>
          <button className="close-x" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* stepper */}
          <div className="stepper">
            {STAGES.map((st, i) => (
              <div
                key={st}
                className={`step${i < idx ? " done" : ""}${
                  i === idx ? " current" : ""
                }`}
              >
                <span className="line" />
                <span className="ring">
                  {i < idx ? <Check size={15} /> : i + 1}
                </span>
                <span className="lbl">{STAGE_META[st].label}</span>
              </div>
            ))}
          </div>

          {/* action CTA */}
          {nextStage ? (
            <div className="action-cta">
              <div className="txt">
                <div className="t1">{cur.cta}</div>
                <div className="t2">{cur.desc}</div>
              </div>
              <button className="btn btn-primary" onClick={onAdvance}>
                {cur.icon} {cur.cta}
              </button>
            </div>
          ) : (
            <div className="action-cta">
              <div className="txt">
                <div className="t1">✓ Fully validated &amp; paid</div>
                <div className="t2">
                  This order has passed every checkpoint.
                </div>
              </div>
            </div>
          )}

          {/* details */}
          <div className="section-title">Details</div>
          <div className="kv">
            <div className="item">
              <div className="k">Quantity × unit</div>
              <div className="v">
                {o.quantity} × {money(o.unitCost, o.currency)}
              </div>
            </div>
            <div className="item">
              <div className="k">Total</div>
              <div className="v">{money(orderTotal(o), o.currency)}</div>
            </div>
            <div className="item">
              <div className="k">Requested by</div>
              <div className="v">{o.requestedBy}</div>
            </div>
            <div className="item">
              <div className="k">Needed by</div>
              <div className="v">
                {o.neededBy
                  ? new Date(o.neededBy).toLocaleDateString()
                  : "—"}
              </div>
            </div>
          </div>
          {o.notes && (
            <div style={{ marginTop: 14 }}>
              <div className="k" style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                Notes
              </div>
              <div style={{ fontSize: 14, marginTop: 3, lineHeight: 1.5 }}>
                {o.notes}
              </div>
            </div>
          )}

          {/* uploads: order docs */}
          <div className="section-title">Order documents</div>
          <Dropzone
            title="Upload quote, spec or PO"
            hint="Drag &amp; drop or click — what needs to be ordered"
            attachments={reqFiles}
            onAdd={(files) => onAddFiles("request", files)}
            onRemove={(id) => onRemoveFile(id)}
          />

          {/* uploads: receipts / delivery */}
          <div className="section-title">Receipts &amp; delivery confirmations</div>
          <Dropzone
            title="Upload receipt or delivery proof"
            hint="Drag &amp; drop or click — proof of delivery / payment"
            attachments={receiptFiles}
            onAdd={(files) => onAddFiles("receipt", files)}
            onRemove={(id) => onRemoveFile(id)}
          />

          {/* audit trail */}
          <div className="section-title">Audit trail</div>
          <div className="timeline">
            {[...o.history].reverse().map((h, i) => (
              <div className="tl-item" key={i}>
                <div className="tl-stage">
                  {STAGE_META[h.stage].label}
                  {h.note ? ` (${h.note})` : ""}
                </div>
                <div className="tl-meta">
                  {h.by} · {new Date(h.at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-danger" onClick={onDelete}>
            Delete
          </button>
          <div className="spacer" style={{ flex: 1 }} />
          {idx > 0 && (
            <button className="btn btn-ghost" onClick={onRevert}>
              Step back
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
