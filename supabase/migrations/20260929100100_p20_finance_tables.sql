-- Fase 10 (P3-1001..1004, opsional/post-MVP): Keuangan (database.md §13).
-- Saldo = opening + pemasukan - pengeluaran (dihitung, bukan disimpan).
-- Iuran yang dibayar merekonsiliasi otomatis jadi transaksi INCOME.

-- 1. financial_accounts
create table if not exists financial_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  code text not null,
  type text not null default 'CASH',
  opening_balance numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);
drop trigger if exists financial_accounts_updated_at on financial_accounts;
create trigger financial_accounts_updated_at
  before update on financial_accounts
  for each row execute function set_updated_at();

-- 2. financial_categories
create table if not exists financial_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('INCOME', 'EXPENSE')),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- 3. financial_transactions
create table if not exists financial_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references financial_accounts (id) on delete cascade,
  category_id uuid references financial_categories (id) on delete set null,
  type text not null check (type in ('INCOME', 'EXPENSE')),
  amount numeric not null check (amount > 0),
  description text not null,
  transaction_date date not null default current_date,
  reference text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index if not exists financial_transactions_account_id on financial_transactions (account_id);

-- 4. payments (iuran anggota; rekonsiliasi via transaction_id)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  amount numeric not null check (amount > 0),
  period_label text not null,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
  paid_at timestamptz,
  method text,
  note text,
  transaction_id uuid references financial_transactions (id) on delete set null,
  recorded_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_user_id on payments (user_id);
drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at
  before update on payments
  for each row execute function set_updated_at();

-- 5. RLS: baca finance.view; tulis finance.create/update/delete.
alter table financial_accounts enable row level security;
alter table financial_categories enable row level security;
alter table financial_transactions enable row level security;
alter table payments enable row level security;

drop policy if exists financial_accounts_select on financial_accounts;
create policy financial_accounts_select on financial_accounts
  for select to authenticated
  using (has_permission(auth.uid(), 'finance.view'));
drop policy if exists financial_accounts_write on financial_accounts;
create policy financial_accounts_write on financial_accounts
  for all to authenticated
  using (
    has_permission(auth.uid(), 'finance.create')
    or has_permission(auth.uid(), 'finance.update')
    or has_permission(auth.uid(), 'finance.delete')
  )
  with check (
    has_permission(auth.uid(), 'finance.create')
    or has_permission(auth.uid(), 'finance.update')
    or has_permission(auth.uid(), 'finance.delete')
  );

drop policy if exists financial_categories_select on financial_categories;
create policy financial_categories_select on financial_categories
  for select to authenticated
  using (has_permission(auth.uid(), 'finance.view'));
drop policy if exists financial_categories_write on financial_categories;
create policy financial_categories_write on financial_categories
  for all to authenticated
  using (
    has_permission(auth.uid(), 'finance.create')
    or has_permission(auth.uid(), 'finance.update')
  )
  with check (
    has_permission(auth.uid(), 'finance.create')
    or has_permission(auth.uid(), 'finance.update')
  );

drop policy if exists financial_transactions_select on financial_transactions;
create policy financial_transactions_select on financial_transactions
  for select to authenticated
  using (has_permission(auth.uid(), 'finance.view'));
drop policy if exists financial_transactions_write on financial_transactions;
create policy financial_transactions_write on financial_transactions
  for all to authenticated
  using (
    has_permission(auth.uid(), 'finance.create')
    or has_permission(auth.uid(), 'finance.update')
    or has_permission(auth.uid(), 'finance.delete')
  )
  with check (
    has_permission(auth.uid(), 'finance.create')
    or has_permission(auth.uid(), 'finance.update')
    or has_permission(auth.uid(), 'finance.delete')
  );

drop policy if exists payments_select on payments;
create policy payments_select on payments
  for select to authenticated
  using (
    user_id = auth.uid()
    or has_permission(auth.uid(), 'finance.view')
  );
drop policy if exists payments_write on payments;
create policy payments_write on payments
  for all to authenticated
  using (
    has_permission(auth.uid(), 'finance.create')
    or has_permission(auth.uid(), 'finance.update')
  )
  with check (
    has_permission(auth.uid(), 'finance.create')
    or has_permission(auth.uid(), 'finance.update')
  );

-- Grants
grant select, insert, update, delete on financial_accounts to authenticated;
grant select, insert, update, delete on financial_categories to authenticated;
grant select, insert, update, delete on financial_transactions to authenticated;
grant select, insert, update, delete on payments to authenticated;
grant all on financial_accounts, financial_categories,
  financial_transactions, payments to service_role;
