export type Stage = "requested" | "approved" | "delivered" | "paid";

export const STAGES: Stage[] = ["requested", "approved", "delivered", "paid"];

export const STAGE_META: Record<
  Stage,
  { label: string; short: string; hint: string; color: string }
> = {
  requested: {
    label: "Requested",
    short: "Request",
    hint: "Awaiting approval",
    color: "amber",
  },
  approved: {
    label: "Approved",
    short: "Approve",
    hint: "Cleared to order — awaiting delivery",
    color: "violet",
  },
  delivered: {
    label: "Delivered",
    short: "Deliver",
    hint: "Goods received — awaiting payment",
    color: "sky",
  },
  paid: {
    label: "Paid",
    short: "Pay",
    hint: "Closed — payment validated",
    color: "emerald",
  },
};

export type AttachmentKind = "request" | "receipt";

export interface AttachmentMeta {
  id: string;
  orderId: string;
  kind: AttachmentKind;
  name: string;
  size: number;
  type: string;
  path: string; // storage object path
  addedAt: number;
}

export interface StageEvent {
  stage: Stage;
  at: number;
  by: string;
  note?: string;
}

export interface Order {
  id: string;
  title: string;
  vendor: string;
  category: string;
  quantity: number;
  unitCost: number;
  currency: string;
  requestedBy: string;
  neededBy?: string;
  notes?: string;
  stage: Stage;
  createdAt: number;
  updatedAt: number;
  history: StageEvent[];
  attachments: AttachmentMeta[];
}

export function orderTotal(o: Order): number {
  return (o.quantity || 0) * (o.unitCost || 0);
}

export function money(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
