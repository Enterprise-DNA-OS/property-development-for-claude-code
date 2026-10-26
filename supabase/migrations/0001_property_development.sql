-- Property Development for Claude Code: the schema.
-- What a New Zealand or Australian property developer keeps for its projects: the sites and who
-- runs them, the feasibility in versions (revenue and cost lines with their timing), the budget
-- by cost code, contracts and variations, payment claims and their statutory clocks, the lot and
-- presale register against the lender's hurdle, drawdowns, approvals and their conditions, and
-- notes. Plain Postgres. Runs the same on PGlite. Money is dollars and cents (numeric) in the
-- project's own currency, ex GST. Dates are calendar dates.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Dollars as people read them: dollars(1250000) is '$1,250,000'.
create or replace function dollars(v numeric) returns text language sql immutable as $$
  select case when v is null then null else case when v < 0 then '-' else '' end || '$' || to_char(abs(round(v)), 'FM999,999,999,990') end $$;

-- Business days (Monday to Friday) after a date. Public holidays and the Christmas shutdown are
-- not counted out, so a deadline from here is never later than the real one.
create or replace function add_business_days(d date, n int) returns date language plpgsql immutable as $$
declare
  out_d date := d;
  left_n int := n;
begin
  if d is null or n is null then return null; end if;
  while left_n > 0 loop
    out_d := out_d + 1;
    if extract(isodow from out_d) < 6 then left_n := left_n - 1; end if;
  end loop;
  return out_d;
end $$;

-- ---------------------------------------------------------------- people and projects

create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  full_name text not null,
  role text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  jurisdiction text not null check (jurisdiction in ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT', 'NZ')),
  currency text not null default 'AUD' check (currency in ('AUD', 'NZD')),
  kind text not null check (kind in ('apartments', 'townhouses', 'land-subdivision', 'mixed-use', 'commercial', 'industrial')),
  stage text not null default 'feasibility' check (stage in ('acquisition', 'feasibility', 'approvals', 'presales', 'construction', 'completion', 'settled', 'abandoned')),
  stage_since date not null default current_date,
  manager_id uuid references staff(id),
  land_settled_on date,
  construction_start_on date,
  completion_forecast_on date,
  plan_registered_on date,
  lender text,
  facility_limit numeric(14,2),
  facility_expires_on date,
  -- The lender's presale covenant: qualifying presales must cover this share of the facility.
  presale_cover_pct numeric(6,2),
  -- A presale counts toward the covenant only with at least this deposit.
  lender_min_deposit_pct numeric(5,2),
  -- The most of the presale value the lender will count from overseas buyers (null: no cap).
  lender_max_foreign_pct numeric(5,2),
  target_margin_pct numeric(5,2) not null default 20,
  margin_scheme boolean not null default false,
  firb_exemption_ref text,
  retention_trust_account text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- the feasibility

create table if not exists feasibilities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  version int not null,
  label text not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded')),
  prepared_on date not null default current_date,
  prepared_by uuid references staff(id),
  approved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version)
);

-- One line of revenue or cost, spread evenly over span_months starting at start_month (month 1 is
-- the first month of the project). Amounts are ex GST.
create table if not exists feasibility_lines (
  id uuid primary key default gen_random_uuid(),
  feasibility_id uuid not null references feasibilities(id) on delete cascade,
  side text not null check (side in ('revenue', 'cost')),
  category text not null check (category in (
    'sales', 'rent', 'other-income',
    'land', 'acquisition', 'professional-fees', 'statutory', 'construction', 'contingency',
    'marketing', 'selling', 'finance', 'holding', 'other')),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  start_month int not null default 1 check (start_month >= 1),
  span_months int not null default 1 check (span_months >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (feasibility_id, side, description)
);

-- ---------------------------------------------------------------- budget, contracts, claims

create table if not exists cost_codes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  code text not null,
  category text not null,
  description text not null,
  budget numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code)
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  cost_code_id uuid references cost_codes(id),
  number text not null,
  supplier text not null,
  kind text not null default 'construction' check (kind in ('construction', 'civil', 'consultant', 'marketing', 'other')),
  value numeric(14,2) not null default 0,
  signed_on date,
  retention_pct numeric(5,2) not null default 0,
  retention_cap_pct numeric(5,2) not null default 5,
  status text not null default 'active' check (status in ('active', 'complete', 'terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);

create table if not exists variations (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  number text not null,
  description text not null,
  amount numeric(14,2) not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  raised_on date not null default current_date,
  decided_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, number)
);

create table if not exists drawdowns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  number int not null,
  period_to date not null,
  amount numeric(14,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'funded', 'rejected')),
  qs_certified_on date,
  submitted_on date,
  funded_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);

-- A payment claim under the security of payment law, or a plain invoice. A payment claim starts
-- the clocks in jurisdiction_rules: the payment schedule and the due date for payment.
create table if not exists claims (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  contract_id uuid references contracts(id),
  cost_code_id uuid references cost_codes(id),
  supplier text not null,
  reference text not null,
  kind text not null default 'invoice' check (kind in ('payment-claim', 'invoice')),
  description text,
  received_on date not null default current_date,
  claimed numeric(14,2) not null,
  scheduled numeric(14,2),
  schedule_given_on date,
  approved numeric(14,2),
  retention_held numeric(14,2) not null default 0,
  paid_on date,
  drawdown_id uuid references drawdowns(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, supplier, reference)
);

-- The statutory clocks a payment claim starts, by jurisdiction. Seeded with the rules the
-- compliance doc cites; add your own state with /customise. schedule_days and pay_days are
-- business (AU) or working (NZ) days after the claim is received.
create table if not exists jurisdiction_rules (
  jurisdiction text primary key,
  schedule_days int,
  pay_days int,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- the lot and presale register

create table if not exists lots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  lot_no text not null,
  kind text not null default 'apartment' check (kind in ('apartment', 'townhouse', 'house', 'land', 'commercial', 'car-space')),
  bedrooms int,
  internal_m2 numeric(8,2),
  list_price numeric(14,2),
  status text not null default 'available' check (status in ('available', 'hold', 'exchanged', 'settled', 'rescinded')),
  price numeric(14,2),
  buyer text,
  buyer_email text,
  foreign_buyer boolean not null default false,
  firb_ref text,
  exchanged_on date,
  deposit numeric(14,2),
  deposit_held_by text,
  deposit_in_trust boolean not null default true,
  disclosure_given_on date,
  gst_notice_given_on date,
  margin_scheme_agreed boolean not null default false,
  sunset_on date,
  settled_on date,
  rescinded_on date,
  rescind_reason text,
  purchaser_consent_on date,
  court_order_ref text,
  sunset_notice_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, lot_no)
);

-- ---------------------------------------------------------------- approvals and conditions

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('development-consent', 'planning-permit', 'resource-consent', 'construction-certificate', 'building-permit', 'building-consent', 'subdivision', 'occupation-certificate', 'code-compliance', 'title')),
  authority text,
  reference text not null,
  status text not null default 'preparing' check (status in ('preparing', 'lodged', 'rfi', 'approved', 'refused', 'withdrawn', 'lapsed')),
  lodged_on date,
  rfi_due_on date,
  decided_on date,
  lapses_on date,
  commenced_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, reference)
);

create table if not exists conditions (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null references approvals(id) on delete cascade,
  number text not null,
  description text not null,
  gate text not null check (gate in ('before-construction', 'during-construction', 'before-occupation', 'before-title', 'ongoing')),
  status text not null default 'open' check (status in ('open', 'satisfied')),
  satisfied_on date,
  owner_id uuid references staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (approval_id, number)
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  body text not null,
  author text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['staff', 'projects', 'feasibilities', 'feasibility_lines', 'cost_codes', 'contracts', 'variations', 'drawdowns', 'claims', 'jurisdiction_rules', 'lots', 'approvals', 'conditions', 'notes'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- views

-- Each feasibility version's totals. Profit on cost is how developers and lenders read margin.
create or replace view feasibility_totals as
select f.id as feasibility_id, p.id as project_id, p.code as project, f.version, f.label, f.status, f.prepared_on, f.approved_on,
  coalesce(sum(l.amount) filter (where l.side = 'revenue'), 0) as revenue,
  coalesce(sum(l.amount) filter (where l.side = 'cost'), 0) as cost,
  coalesce(sum(l.amount) filter (where l.side = 'cost' and l.category = 'land'), 0) as land,
  coalesce(sum(l.amount) filter (where l.side = 'cost' and l.category = 'construction'), 0) as construction,
  coalesce(sum(l.amount) filter (where l.side = 'revenue'), 0) - coalesce(sum(l.amount) filter (where l.side = 'cost'), 0) as profit,
  round(100 * (coalesce(sum(l.amount) filter (where l.side = 'revenue'), 0) - coalesce(sum(l.amount) filter (where l.side = 'cost'), 0))
    / nullif(sum(l.amount) filter (where l.side = 'cost'), 0), 1) as margin_on_cost_pct,
  p.target_margin_pct
from feasibilities f
join projects p on p.id = f.project_id
left join feasibility_lines l on l.feasibility_id = f.id
group by f.id, p.id;

-- Each contract: value, variations, what has been claimed and approved, retention held.
create or replace view contract_position as
select c.id as contract_id, c.project_id, p.code as project, c.number, c.supplier, c.kind, c.status, c.cost_code_id, cc.code as cost_code,
  c.value,
  coalesce((select sum(v.amount) from variations v where v.contract_id = c.id and v.status = 'approved'), 0) as approved_variations,
  coalesce((select sum(v.amount) from variations v where v.contract_id = c.id and v.status = 'pending'), 0) as pending_variations,
  coalesce((select count(*) from variations v where v.contract_id = c.id and v.status = 'pending'), 0)::int as pending_count,
  c.value + coalesce((select sum(v.amount) from variations v where v.contract_id = c.id and v.status = 'approved'), 0) as revised_value,
  coalesce((select sum(coalesce(cl.approved, cl.scheduled, cl.claimed)) from claims cl where cl.contract_id = c.id), 0) as claimed_to_date,
  coalesce((select sum(cl.retention_held) from claims cl where cl.contract_id = c.id), 0) as retention_held,
  c.retention_pct, c.retention_cap_pct
from contracts c
join projects p on p.id = c.project_id
left join cost_codes cc on cc.id = c.cost_code_id;

-- The cost report: every cost code's budget, what is committed, what has been spent, and the
-- forecast final cost. Forecast is the larger of budget and committed (with pending variations),
-- and never less than what has already been spent.
create or replace view cost_position as
with com as (
  select cost_code_id, sum(revised_value) as committed, sum(pending_variations) as pending
  from contract_position where status <> 'terminated' group by cost_code_id
), act as (
  select cost_code_id, sum(coalesce(approved, scheduled, claimed)) as actual from claims group by cost_code_id
)
select cc.id as cost_code_id, cc.project_id, p.code as project, cc.code, cc.category, cc.description, cc.budget,
  coalesce(com.committed, 0) as committed,
  coalesce(com.pending, 0) as pending_variations,
  coalesce(act.actual, 0) as actual,
  greatest(cc.budget, coalesce(com.committed, 0) + coalesce(com.pending, 0), coalesce(act.actual, 0)) as forecast_final,
  greatest(cc.budget, coalesce(com.committed, 0) + coalesce(com.pending, 0), coalesce(act.actual, 0)) - cc.budget as overrun,
  greatest(cc.budget, coalesce(com.committed, 0) + coalesce(com.pending, 0), coalesce(act.actual, 0)) - coalesce(act.actual, 0) as cost_to_complete
from cost_codes cc
join projects p on p.id = cc.project_id
left join com on com.cost_code_id = cc.id
left join act on act.cost_code_id = cc.id;

-- The lot book: every lot with its deposit share, whether it counts toward the lender's presale
-- covenant, and the sunset clock.
create or replace view lot_book as
select l.id as lot_id, l.project_id, p.code as project, p.jurisdiction, l.lot_no, l.kind, l.bedrooms, l.status, l.list_price, l.price, l.buyer,
  l.foreign_buyer, l.firb_ref, l.exchanged_on, l.deposit,
  round(100 * l.deposit / nullif(l.price, 0), 1) as deposit_pct,
  l.deposit_held_by, l.deposit_in_trust, l.disclosure_given_on, l.gst_notice_given_on, l.margin_scheme_agreed,
  l.sunset_on, l.sunset_on - current_date as days_to_sunset, l.settled_on, l.rescinded_on, l.rescind_reason, l.purchaser_consent_on, l.court_order_ref,
  case when l.status = 'exchanged' then current_date - l.exchanged_on end as days_since_exchange,
  (l.status = 'exchanged' and coalesce(100 * l.deposit / nullif(l.price, 0), 0) >= coalesce(p.lender_min_deposit_pct, 0)) as qualifies,
  case when l.status in ('exchanged', 'settled') then l.price else l.list_price end as expected_price
from lots l
join projects p on p.id = l.project_id;

-- The presale covenant: qualifying presales against the lender's hurdle, with the overseas cap.
create or replace view presale_position as
select p.id as project_id, p.code as project, p.name, p.lender, p.facility_limit, p.presale_cover_pct, p.lender_min_deposit_pct, p.lender_max_foreign_pct,
  count(*) filter (where b.lot_id is not null)::int as lots,
  count(*) filter (where b.status in ('exchanged', 'settled'))::int as sold,
  count(*) filter (where b.status in ('available', 'hold', 'rescinded'))::int as unsold,
  coalesce(sum(b.price) filter (where b.status = 'exchanged'), 0) as exchanged_value,
  coalesce(sum(b.price) filter (where b.qualifies), 0) as qualifying_raw,
  coalesce(sum(b.price) filter (where b.qualifies and b.foreign_buyer), 0) as qualifying_foreign,
  -- Overseas presales count only up to the lender's cap on the qualifying total.
  coalesce(sum(b.price) filter (where b.qualifies and not b.foreign_buyer), 0)
    + least(coalesce(sum(b.price) filter (where b.qualifies and b.foreign_buyer), 0),
            case when p.lender_max_foreign_pct is null then coalesce(sum(b.price) filter (where b.qualifies and b.foreign_buyer), 0)
                 else coalesce(sum(b.price) filter (where b.qualifies and not b.foreign_buyer), 0) * p.lender_max_foreign_pct / nullif(100 - p.lender_max_foreign_pct, 0) end) as qualifying_value,
  round(p.facility_limit * p.presale_cover_pct / 100, 2) as hurdle
from projects p
left join lot_book b on b.project_id = p.id
group by p.id;

-- One line per project: the approved feasibility against the forecast now.
create or replace view project_position as
with feaso as (
  select distinct on (project_id) * from feasibility_totals where status = 'approved' order by project_id, version desc
), costs as (
  select project_id, sum(budget) as budget, sum(committed) as committed, sum(actual) as actual, sum(forecast_final) as forecast_cost, sum(overrun) as overrun
  from cost_position group by project_id
), rev as (
  select project_id, sum(expected_price) as forecast_revenue from lot_book group by project_id
)
select p.id as project_id, p.code as project, p.name, p.jurisdiction, p.currency, p.kind, p.stage, s.code as manager,
  current_date - p.stage_since as days_in_stage,
  f.version as feaso_version, f.revenue as feaso_revenue, f.cost as feaso_cost, f.profit as feaso_profit, f.margin_on_cost_pct as feaso_margin_pct,
  coalesce(r.forecast_revenue, f.revenue) as forecast_revenue,
  -- Costs outside the cost codes (land, finance) stay at the feasibility figure until coded.
  coalesce(c.forecast_cost, 0) + greatest(coalesce(f.cost, 0) - coalesce(c.budget, 0), 0) as forecast_cost,
  coalesce(r.forecast_revenue, f.revenue) - (coalesce(c.forecast_cost, 0) + greatest(coalesce(f.cost, 0) - coalesce(c.budget, 0), 0)) as forecast_profit,
  round(100 * (coalesce(r.forecast_revenue, f.revenue) - (coalesce(c.forecast_cost, 0) + greatest(coalesce(f.cost, 0) - coalesce(c.budget, 0), 0)))
    / nullif(coalesce(c.forecast_cost, 0) + greatest(coalesce(f.cost, 0) - coalesce(c.budget, 0), 0), 0), 1) as forecast_margin_pct,
  p.target_margin_pct,
  coalesce(c.overrun, 0) as cost_overrun,
  coalesce(c.actual, 0) as spent,
  pp.qualifying_value, pp.hurdle, pp.sold, pp.unsold,
  p.completion_forecast_on, p.facility_expires_on
from projects p
left join staff s on s.id = p.manager_id
left join feaso f on f.project_id = p.id
left join costs c on c.project_id = p.id
left join rev r on r.project_id = p.id
left join presale_position pp on pp.project_id = p.id;

-- The payment claim clocks: when the schedule is due, when payment is due, and whether either
-- has been missed. AU days are business days; NZ working days are counted the same way here.
create or replace view claim_clock as
select cl.id as claim_id, cl.project_id, p.code as project, p.jurisdiction, cl.supplier, cl.reference, cl.kind, cl.description,
  cl.received_on, cl.claimed, cl.scheduled, cl.schedule_given_on, cl.approved, cl.retention_held, cl.paid_on,
  cn.number as contract, cc.code as cost_code,
  case when cl.kind = 'payment-claim' then add_business_days(cl.received_on, r.schedule_days) end as schedule_due_on,
  case when cl.kind = 'payment-claim' then add_business_days(cl.received_on, r.pay_days) end as pay_due_on,
  (cl.kind = 'payment-claim' and r.schedule_days is not null and cl.schedule_given_on is null and current_date > add_business_days(cl.received_on, r.schedule_days)) as schedule_missed,
  (cl.kind = 'payment-claim' and r.schedule_days is not null and cl.schedule_given_on > add_business_days(cl.received_on, r.schedule_days)) as schedule_late,
  (cl.kind = 'payment-claim' and r.pay_days is not null and cl.paid_on is null and current_date > add_business_days(cl.received_on, r.pay_days)) as payment_overdue,
  r.source as rule_source
from claims cl
join projects p on p.id = cl.project_id
left join jurisdiction_rules r on r.jurisdiction = p.jurisdiction
left join contracts cn on cn.id = cl.contract_id
left join cost_codes cc on cc.id = cl.cost_code_id;

-- Approvals with their lapse clocks and open conditions.
create or replace view approval_status as
select a.id as approval_id, a.project_id, p.code as project, p.jurisdiction, a.kind, a.authority, a.reference, a.status,
  a.lodged_on, a.rfi_due_on, a.decided_on, a.lapses_on, a.commenced_on,
  a.lapses_on - current_date as days_to_lapse,
  case when a.status in ('lodged', 'rfi') then current_date - a.lodged_on end as days_with_authority,
  (select count(*) from conditions c where c.approval_id = a.id and c.status = 'open')::int as open_conditions,
  (select count(*) from conditions c where c.approval_id = a.id and c.status = 'open' and c.gate = 'before-construction')::int as open_before_construction,
  (select count(*) from conditions c where c.approval_id = a.id and c.status = 'open' and c.gate = 'before-occupation')::int as open_before_occupation
from approvals a
join projects p on p.id = a.project_id;
