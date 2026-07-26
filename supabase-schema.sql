-- ProcureFlow schema — run in Supabase → SQL Editor
-- Creates the orders + attachments tables and a public storage bucket.

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  vendor text default '',
  category text default 'General',
  quantity integer default 1,
  unit_cost numeric default 0,
  currency text default 'USD',
  requested_by text default 'You',
  needed_by date,
  notes text,
  stage text not null default 'requested',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null,               -- 'request' | 'receipt'
  name text not null,
  size bigint default 0,
  type text default '',
  path text not null,               -- storage object path
  added_at timestamptz not null default now()
);

create index if not exists attachments_order_id_idx on public.attachments(order_id);
create index if not exists orders_updated_at_idx on public.orders(updated_at desc);

-- Storage bucket for uploaded quotes / receipts / delivery proofs (public read).
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- NOTE ON ACCESS:
-- This app has no login and uses the anon key for reads/writes, so Row Level
-- Security is intentionally left OFF on these tables (Data API access only).
-- If you later add Supabase Auth, enable RLS and add per-user policies.
