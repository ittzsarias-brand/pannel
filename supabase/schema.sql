-- Pannel Dashboard initial schema
-- Run in Supabase SQL Editor. Keep RLS enabled on all user-owned tables.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  amount numeric(18, 2) not null check (amount > 0),
  currency text not null check (currency in ('IQD', 'USD')),
  kind text not null check (kind in ('income', 'expense')),
  category text not null default 'General' check (char_length(category) <= 60),
  created_at timestamptz not null default now()
);

create table if not exists public.tracked_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null default 'General' check (char_length(category) <= 60),
  quantity integer not null default 1 check (quantity >= 0),
  location text not null default '' check (char_length(location) <= 120),
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
alter table public.tracked_items enable row level security;
alter table public.notes enable row level security;

-- Drop named policies first so this script can be safely re-run.
drop policy if exists "Users manage their own transactions" on public.transactions;
drop policy if exists "Users manage their own items" on public.tracked_items;
drop policy if exists "Users manage their own notes" on public.notes;

create policy "Users manage their own transactions"
on public.transactions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own items"
on public.tracked_items for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users manage their own notes"
on public.notes for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index if not exists tracked_items_user_created_idx on public.tracked_items (user_id, created_at desc);
create index if not exists notes_user_created_idx on public.notes (user_id, created_at desc);

create or replace function public.set_note_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at
before update on public.notes
for each row execute function public.set_note_updated_at();