import { supabase, ATTACHMENTS_BUCKET } from "./supabaseClient";
import {
  Order,
  Stage,
  AttachmentKind,
  AttachmentMeta,
  StageEvent,
} from "./types";

/* ---------------- helpers ---------------- */

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

const ts = (v: string | null | undefined): number =>
  v ? new Date(v).getTime() : Date.now();

/* Map a DB row (snake_case) to the app Order shape (camelCase). */
function rowToOrder(r: any, attachments: AttachmentMeta[]): Order {
  return {
    id: r.id,
    title: r.title,
    vendor: r.vendor ?? "",
    category: r.category ?? "General",
    quantity: r.quantity ?? 1,
    unitCost: Number(r.unit_cost ?? 0),
    currency: r.currency ?? "USD",
    requestedBy: r.requested_by ?? "You",
    neededBy: r.needed_by ?? undefined,
    notes: r.notes ?? undefined,
    stage: (r.stage ?? "requested") as Stage,
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
    history: (r.history ?? []) as StageEvent[],
    attachments,
  };
}

function rowToAttachment(r: any): AttachmentMeta {
  return {
    id: r.id,
    orderId: r.order_id,
    kind: r.kind as AttachmentKind,
    name: r.name,
    size: Number(r.size ?? 0),
    type: r.type ?? "",
    path: r.path,
    addedAt: ts(r.added_at),
  };
}

/* ---------------- reads ---------------- */

export async function fetchOrders(): Promise<Order[]> {
  const [{ data: orders, error: oErr }, { data: atts, error: aErr }] =
    await Promise.all([
      supabase.from("orders").select("*").order("updated_at", { ascending: false }),
      supabase.from("attachments").select("*"),
    ]);
  if (oErr) throw oErr;
  if (aErr) throw aErr;

  const byOrder = new Map<string, AttachmentMeta[]>();
  (atts ?? []).forEach((r) => {
    const a = rowToAttachment(r);
    const list = byOrder.get(a.orderId) ?? [];
    list.push(a);
    byOrder.set(a.orderId, list);
  });

  return (orders ?? []).map((r) => rowToOrder(r, byOrder.get(r.id) ?? []));
}

/* ---------------- writes ---------------- */

export async function insertOrder(o: {
  title: string;
  vendor: string;
  category: string;
  quantity: number;
  unitCost: number;
  currency: string;
  requestedBy: string;
  neededBy?: string;
  notes?: string;
}): Promise<Order> {
  const now = new Date().toISOString();
  const history: StageEvent[] = [
    { stage: "requested", at: Date.now(), by: o.requestedBy },
  ];
  const { data, error } = await supabase
    .from("orders")
    .insert({
      title: o.title,
      vendor: o.vendor,
      category: o.category,
      quantity: o.quantity,
      unit_cost: o.unitCost,
      currency: o.currency,
      requested_by: o.requestedBy,
      needed_by: o.neededBy ?? null,
      notes: o.notes ?? null,
      stage: "requested",
      created_at: now,
      updated_at: now,
      history,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToOrder(data, []);
}

export async function updateStage(
  order: Order,
  nextStage: Stage,
  note?: string
): Promise<void> {
  const now = Date.now();
  const history = [
    ...order.history,
    { stage: nextStage, at: now, by: "You", ...(note ? { note } : {}) },
  ];
  const { error } = await supabase
    .from("orders")
    .update({
      stage: nextStage,
      updated_at: new Date(now).toISOString(),
      history,
    })
    .eq("id", order.id);
  if (error) throw error;
}

export async function deleteOrder(order: Order): Promise<void> {
  // remove stored files first
  const paths = order.attachments.map((a) => a.path).filter(Boolean);
  if (paths.length) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove(paths);
  }
  await supabase.from("attachments").delete().eq("order_id", order.id);
  const { error } = await supabase.from("orders").delete().eq("id", order.id);
  if (error) throw error;
}

/* ---------------- attachments ---------------- */

export async function uploadAttachment(
  orderId: string,
  kind: AttachmentKind,
  file: File
): Promise<AttachmentMeta> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${orderId}/${kind}/${Date.now()}_${safeName}`;
  const { error: upErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      order_id: orderId,
      kind,
      name: file.name,
      size: file.size,
      type: file.type,
      path,
      added_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  // bump order updated_at
  await supabase
    .from("orders")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", orderId);

  return rowToAttachment(data);
}

export async function removeAttachment(att: AttachmentMeta): Promise<void> {
  if (att.path) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([att.path]);
  }
  const { error } = await supabase.from("attachments").delete().eq("id", att.id);
  if (error) throw error;
}

export function publicUrl(path: string): string {
  const { data } = supabase.storage.from(ATTACHMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function openFileInTab(path: string): void {
  const url = publicUrl(path);
  if (url) window.open(url, "_blank", "noopener");
}
