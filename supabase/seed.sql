-- Demo data: Harbour & Hill Developments, a fictional developer with an office in Sydney and one
-- in Auckland, running four projects. Every name, reference and number is made up. Dates are
-- relative to today, so the overdue rows stay overdue whenever you run it, and every insert skips
-- what is already there, so running it twice is harmless.
--
--   PARK  Parkside Apartments, Marrickville NSW: 16 apartments, under construction
--   ELM   Elm Street Townhouses, Box Hill North VIC: 8 townhouses, selling off the plan
--   KAURI Kauri Rise, Whenuapai, Auckland: 18 sections, civil works under way
--   RYDE  220 Ryde Road, Gladesville NSW: a site in for development consent
--
-- Problems are planted on purpose so /attention and /compliance have something to say: a lot
-- rescinded under the sunset clause with no purchaser consent or court order, sunset dates that
-- fall before forecast completion, a contract signed without the disclosure statement, a missing
-- GST withholding notice, a margin scheme sale without the written agreement, an overseas buyer
-- with no foreign investment approval, a Victorian deposit over 10%, a payment claim with no
-- payment schedule past the deadline, retention held on a New Zealand job with no trust account,
-- a planning permit about to lapse with no works started, a council information request past
-- due, pending variations pushing the build over budget, and presales short of the lender's
-- hurdle.

insert into staff (code, full_name, role, email) values
  ('DM', 'Dana Mercer', 'Development director', 'dana@harbourhill.example.com'),
  ('JP', 'Josh Petrovic', 'Development manager', 'josh@harbourhill.example.com'),
  ('AK', 'Aroha King', 'Development manager, Auckland', 'aroha@harbourhill.example.com'),
  ('LS', 'Lena Shah', 'Sales and settlements', 'lena@harbourhill.example.com')
on conflict (code) do nothing;

insert into jurisdiction_rules (jurisdiction, schedule_days, pay_days, source) values
  ('NSW', 10, 15, 'Building and Construction Industry Security of Payment Act 1999 (NSW) s14(4) payment schedule within 10 business days; s11(1A) principal pays a head contractor within 15 business days'),
  ('NZ', 20, 20, 'Construction Contracts Act 2002 s21 and s22 payment schedule within 20 working days or the contract''s time; s18 payment due 20 working days after the claim where the contract is silent')
on conflict (jurisdiction) do nothing;

insert into projects (code, name, address, jurisdiction, currency, kind, stage, stage_since, manager_id, land_settled_on, construction_start_on, completion_forecast_on,
  lender, facility_limit, facility_expires_on, presale_cover_pct, lender_min_deposit_pct, lender_max_foreign_pct, target_margin_pct, margin_scheme, firb_exemption_ref, retention_trust_account) values
  ('PARK', 'Parkside Apartments', '12 Railway Parade, Marrickville NSW', 'NSW', 'AUD', 'apartments', 'construction', current_date - 150, (select id from staff where code = 'JP'),
    current_date - 820, current_date - 150, current_date + 110, 'Eastbank Commercial', 9500000, current_date + 260, 100, 10, 20, 20, true, null, null),
  ('ELM', 'Elm Street Townhouses', '41 Elm Street, Box Hill North VIC', 'VIC', 'AUD', 'townhouses', 'presales', current_date - 95, (select id from staff where code = 'JP'),
    current_date - 700, null, current_date + 540, 'Southbank Private Credit', 5800000, null, 80, 10, null, 20, false, null, null),
  ('KAURI', 'Kauri Rise', '88 Totara Road, Whenuapai, Auckland', 'NZ', 'NZD', 'land-subdivision', 'construction', current_date - 160, (select id from staff where code = 'AK'),
    current_date - 610, current_date - 160, current_date + 150, 'Waitemata Development Finance', 12000000, current_date + 330, 60, 10, null, 18, false, null, null),
  ('RYDE', '220 Ryde Road', '220 Ryde Road, Gladesville NSW', 'NSW', 'AUD', 'apartments', 'approvals', current_date - 210, (select id from staff where code = 'DM'),
    current_date - 230, null, null, null, null, null, null, null, null, 20, true, null, null)
on conflict (code) do nothing;

-- ---------------------------------------------------------------- feasibilities

insert into feasibilities (project_id, version, label, status, prepared_on, prepared_by, approved_on) values
  ((select id from projects where code = 'PARK'), 1, 'Board approval before tender', 'superseded', current_date - 420, (select id from staff where code = 'JP'), current_date - 410),
  ((select id from projects where code = 'PARK'), 2, 'After builder tender', 'approved', current_date - 190, (select id from staff where code = 'JP'), current_date - 180),
  ((select id from projects where code = 'ELM'), 1, 'Acquisition feasibility', 'approved', current_date - 720, (select id from staff where code = 'DM'), current_date - 705),
  ((select id from projects where code = 'ELM'), 2, 'Builder pricing received', 'draft', current_date - 12, (select id from staff where code = 'JP'), null),
  ((select id from projects where code = 'KAURI'), 1, 'Civil tender accepted', 'approved', current_date - 200, (select id from staff where code = 'AK'), current_date - 190),
  ((select id from projects where code = 'RYDE'), 1, 'Site purchase, 42 apartments', 'approved', current_date - 260, (select id from staff where code = 'DM'), current_date - 250),
  ((select id from projects where code = 'RYDE'), 2, 'Council setback request, 36 apartments', 'draft', current_date - 9, (select id from staff where code = 'DM'), null)
on conflict (project_id, version) do nothing;

insert into feasibility_lines (feasibility_id, side, category, description, amount, start_month, span_months)
select f.id, x.side, x.category, x.description, x.amount, x.start_month, x.span_months
from (values
  -- PARK v1 and v2: 16 apartments, land bought, build tendered between the two
  ('PARK', 1, 'revenue', 'sales', 'Apartment sales, 16 lots', 17680000, 30, 2),
  ('PARK', 1, 'cost', 'land', 'Land purchase', 4100000, 1, 1),
  ('PARK', 1, 'cost', 'acquisition', 'Stamp duty and legal', 230000, 1, 1),
  ('PARK', 1, 'cost', 'professional-fees', 'Architect, engineers, planner, QS', 520000, 1, 28),
  ('PARK', 1, 'cost', 'statutory', 'DA fees and section 7.11 contributions', 380000, 6, 3),
  ('PARK', 1, 'cost', 'construction', 'Construction (pre-tender estimate)', 7200000, 12, 18),
  ('PARK', 1, 'cost', 'contingency', 'Construction contingency', 380000, 12, 18),
  ('PARK', 1, 'cost', 'marketing', 'Display suite and campaign', 160000, 8, 20),
  ('PARK', 1, 'cost', 'selling', 'Sales commission and legal', 353600, 30, 2),
  ('PARK', 1, 'cost', 'holding', 'Council rates and land tax', 150000, 1, 30),
  ('PARK', 1, 'cost', 'finance', 'Interest and facility fees', 820000, 12, 20),
  ('PARK', 2, 'revenue', 'sales', 'Apartment sales, 16 lots', 17680000, 30, 2),
  ('PARK', 2, 'cost', 'land', 'Land purchase', 4100000, 1, 1),
  ('PARK', 2, 'cost', 'acquisition', 'Stamp duty and legal', 230000, 1, 1),
  ('PARK', 2, 'cost', 'professional-fees', 'Architect, engineers, planner, QS', 520000, 1, 28),
  ('PARK', 2, 'cost', 'statutory', 'DA fees and section 7.11 contributions', 380000, 6, 3),
  ('PARK', 2, 'cost', 'construction', 'Construction (Coastline tender)', 7600000, 12, 18),
  ('PARK', 2, 'cost', 'contingency', 'Construction contingency', 380000, 12, 18),
  ('PARK', 2, 'cost', 'marketing', 'Display suite and campaign', 160000, 8, 20),
  ('PARK', 2, 'cost', 'selling', 'Sales commission and legal', 353600, 30, 2),
  ('PARK', 2, 'cost', 'holding', 'Council rates and land tax', 150000, 1, 30),
  ('PARK', 2, 'cost', 'finance', 'Interest and facility fees', 820000, 12, 20),
  -- ELM: the build price came in high
  ('ELM', 1, 'revenue', 'sales', 'Townhouse sales, 8 lots', 10080000, 26, 2),
  ('ELM', 1, 'cost', 'land', 'Land purchase', 2650000, 1, 1),
  ('ELM', 1, 'cost', 'acquisition', 'Stamp duty and legal', 160000, 1, 1),
  ('ELM', 1, 'cost', 'professional-fees', 'Architect, engineers, town planner', 310000, 1, 24),
  ('ELM', 1, 'cost', 'statutory', 'Permit fees and open space levy', 190000, 4, 3),
  ('ELM', 1, 'cost', 'construction', 'Construction (estimate)', 4300000, 12, 14),
  ('ELM', 1, 'cost', 'contingency', 'Construction contingency', 215000, 12, 14),
  ('ELM', 1, 'cost', 'marketing', 'Campaign and signage', 90000, 6, 20),
  ('ELM', 1, 'cost', 'selling', 'Sales commission and legal', 201600, 26, 2),
  ('ELM', 1, 'cost', 'holding', 'Council rates and land tax', 110000, 1, 26),
  ('ELM', 1, 'cost', 'finance', 'Interest and facility fees', 280000, 12, 14),
  ('ELM', 2, 'revenue', 'sales', 'Townhouse sales, 8 lots', 10080000, 28, 2),
  ('ELM', 2, 'cost', 'land', 'Land purchase', 2650000, 1, 1),
  ('ELM', 2, 'cost', 'acquisition', 'Stamp duty and legal', 160000, 1, 1),
  ('ELM', 2, 'cost', 'professional-fees', 'Architect, engineers, town planner', 330000, 1, 26),
  ('ELM', 2, 'cost', 'statutory', 'Permit fees and open space levy', 190000, 4, 3),
  ('ELM', 2, 'cost', 'construction', 'Construction (Northcote Build Group price)', 4720000, 14, 14),
  ('ELM', 2, 'cost', 'contingency', 'Construction contingency', 236000, 14, 14),
  ('ELM', 2, 'cost', 'marketing', 'Campaign and signage', 90000, 6, 22),
  ('ELM', 2, 'cost', 'selling', 'Sales commission and legal', 201600, 28, 2),
  ('ELM', 2, 'cost', 'holding', 'Council rates and land tax', 125000, 1, 28),
  ('ELM', 2, 'cost', 'finance', 'Interest and facility fees', 310000, 14, 14),
  -- KAURI: 18 sections
  ('KAURI', 1, 'revenue', 'sales', 'Section sales, 18 lots', 12420000, 22, 3),
  ('KAURI', 1, 'cost', 'land', 'Land purchase', 4200000, 1, 1),
  ('KAURI', 1, 'cost', 'acquisition', 'Legal and due diligence', 85000, 1, 1),
  ('KAURI', 1, 'cost', 'professional-fees', 'Surveyor, civil engineer, planner', 410000, 1, 22),
  ('KAURI', 1, 'cost', 'statutory', 'Resource consent and development contributions', 690000, 4, 6),
  ('KAURI', 1, 'cost', 'construction', 'Civil works (Dunmore Civil)', 3950000, 10, 10),
  ('KAURI', 1, 'cost', 'contingency', 'Civil contingency', 200000, 10, 10),
  ('KAURI', 1, 'cost', 'marketing', 'Campaign', 60000, 8, 14),
  ('KAURI', 1, 'cost', 'selling', 'Sales commission and legal', 248400, 22, 3),
  ('KAURI', 1, 'cost', 'holding', 'Rates', 70000, 1, 22),
  ('KAURI', 1, 'cost', 'finance', 'Interest and facility fees', 520000, 6, 16),
  -- RYDE: the council wants six fewer apartments
  ('RYDE', 1, 'revenue', 'sales', 'Apartment sales, 42 lots', 50400000, 40, 3),
  ('RYDE', 1, 'cost', 'land', 'Land purchase', 11500000, 1, 1),
  ('RYDE', 1, 'cost', 'acquisition', 'Stamp duty and legal', 640000, 1, 1),
  ('RYDE', 1, 'cost', 'professional-fees', 'Architect, engineers, planner, QS', 1450000, 1, 38),
  ('RYDE', 1, 'cost', 'statutory', 'DA fees and contributions', 1100000, 10, 3),
  ('RYDE', 1, 'cost', 'construction', 'Construction (estimate)', 21800000, 18, 22),
  ('RYDE', 1, 'cost', 'contingency', 'Construction contingency', 1090000, 18, 22),
  ('RYDE', 1, 'cost', 'marketing', 'Display suite and campaign', 420000, 12, 28),
  ('RYDE', 1, 'cost', 'selling', 'Sales commission and legal', 1008000, 40, 3),
  ('RYDE', 1, 'cost', 'holding', 'Council rates and land tax', 520000, 1, 40),
  ('RYDE', 1, 'cost', 'finance', 'Interest and facility fees', 2300000, 12, 30),
  ('RYDE', 2, 'revenue', 'sales', 'Apartment sales, 36 lots', 43920000, 40, 3),
  ('RYDE', 2, 'cost', 'land', 'Land purchase', 11500000, 1, 1),
  ('RYDE', 2, 'cost', 'acquisition', 'Stamp duty and legal', 640000, 1, 1),
  ('RYDE', 2, 'cost', 'professional-fees', 'Architect, engineers, planner, QS, redesign', 1560000, 1, 38),
  ('RYDE', 2, 'cost', 'statutory', 'DA fees and contributions', 960000, 10, 3),
  ('RYDE', 2, 'cost', 'construction', 'Construction (estimate)', 19300000, 18, 22),
  ('RYDE', 2, 'cost', 'contingency', 'Construction contingency', 965000, 18, 22),
  ('RYDE', 2, 'cost', 'marketing', 'Display suite and campaign', 400000, 12, 28),
  ('RYDE', 2, 'cost', 'selling', 'Sales commission and legal', 878400, 40, 3),
  ('RYDE', 2, 'cost', 'holding', 'Council rates and land tax', 560000, 1, 42),
  ('RYDE', 2, 'cost', 'finance', 'Interest and facility fees', 2250000, 12, 30)
) as x(project, version, side, category, description, amount, start_month, span_months)
join projects p on p.code = x.project
join feasibilities f on f.project_id = p.id and f.version = x.version
on conflict (feasibility_id, side, description) do nothing;

-- ---------------------------------------------------------------- budgets (the approved feasibility, finance kept outside)

insert into cost_codes (project_id, code, category, description, budget)
select p.id, x.code, x.category, x.description, x.budget
from (values
  ('PARK', '100', 'land', 'Land', 4100000), ('PARK', '200', 'acquisition', 'Stamp duty and legal', 230000),
  ('PARK', '300', 'professional-fees', 'Consultants', 520000), ('PARK', '400', 'statutory', 'Authority fees and contributions', 380000),
  ('PARK', '500', 'construction', 'Construction', 7600000), ('PARK', '550', 'contingency', 'Contingency', 380000),
  ('PARK', '600', 'marketing', 'Marketing', 160000), ('PARK', '700', 'selling', 'Selling', 353600), ('PARK', '800', 'holding', 'Rates and land tax', 150000),
  ('ELM', '100', 'land', 'Land', 2650000), ('ELM', '200', 'acquisition', 'Stamp duty and legal', 160000),
  ('ELM', '300', 'professional-fees', 'Consultants', 310000), ('ELM', '400', 'statutory', 'Permit fees and levies', 190000),
  ('ELM', '500', 'construction', 'Construction', 4300000), ('ELM', '550', 'contingency', 'Contingency', 215000),
  ('ELM', '600', 'marketing', 'Marketing', 90000), ('ELM', '700', 'selling', 'Selling', 201600), ('ELM', '800', 'holding', 'Rates and land tax', 110000),
  ('KAURI', '100', 'land', 'Land', 4200000), ('KAURI', '200', 'acquisition', 'Legal and due diligence', 85000),
  ('KAURI', '300', 'professional-fees', 'Consultants', 410000), ('KAURI', '400', 'statutory', 'Consent and development contributions', 690000),
  ('KAURI', '500', 'construction', 'Civil works', 3950000), ('KAURI', '550', 'contingency', 'Contingency', 200000),
  ('KAURI', '600', 'marketing', 'Marketing', 60000), ('KAURI', '700', 'selling', 'Selling', 248400), ('KAURI', '800', 'holding', 'Rates', 70000),
  ('RYDE', '100', 'land', 'Land', 11500000), ('RYDE', '200', 'acquisition', 'Stamp duty and legal', 640000),
  ('RYDE', '300', 'professional-fees', 'Consultants', 1450000), ('RYDE', '400', 'statutory', 'DA fees and contributions', 1100000)
) as x(project, code, category, description, budget)
join projects p on p.code = x.project
on conflict (project_id, code) do nothing;

-- ---------------------------------------------------------------- contracts and variations

insert into contracts (project_id, cost_code_id, number, supplier, kind, value, signed_on, retention_pct, retention_cap_pct, status)
select p.id, cc.id, x.number, x.supplier, x.kind, x.value, current_date + x.signed, x.ret, 5, 'active'
from (values
  ('PARK', '500', 'HC-01', 'Coastline Constructions Pty Ltd', 'construction', 7450000, -165, 5),
  ('PARK', '300', 'CON-01', 'Studio Linea Architects', 'consultant', 360000, -700, 0),
  ('PARK', '300', 'CON-02', 'Ardent Quantity Surveyors', 'consultant', 64000, -400, 0),
  ('PARK', '600', 'MKT-01', 'Laneway Property Marketing', 'marketing', 150000, -500, 0),
  ('ELM', '300', 'CON-01', 'Fold Architecture', 'consultant', 236000, -650, 0),
  ('ELM', '300', 'CON-02', 'Kerr Town Planning', 'consultant', 48000, -690, 0),
  ('KAURI', '500', 'CW-01', 'Dunmore Civil Ltd', 'civil', 3820000, -175, 5),
  ('KAURI', '300', 'CON-01', 'Tui Survey and Engineering', 'consultant', 380000, -590, 0),
  ('RYDE', '300', 'CON-01', 'Studio Linea Architects', 'consultant', 690000, -225, 0),
  ('RYDE', '300', 'CON-02', 'Parramatta Planning Partners', 'consultant', 145000, -228, 0)
) as x(project, code, number, supplier, kind, value, signed, ret)
join projects p on p.code = x.project
join cost_codes cc on cc.project_id = p.id and cc.code = x.code
on conflict (project_id, number) do nothing;

insert into variations (contract_id, number, description, amount, status, raised_on, decided_on)
select c.id, x.number, x.description, x.amount, x.status, current_date + x.raised, case when x.decided is null then null else current_date + x.decided end
from (values
  ('PARK', 'HC-01', 'V01', 'Rock excavation in the basement beyond the geotech allowance', 145000, 'approved', -120, -112),
  ('PARK', 'HC-01', 'V02', 'Upgraded fire stair pressurisation', 62000, 'approved', -70, -61),
  ('PARK', 'HC-01', 'V03', 'Facade change from render to brick to the street', 210000, 'pending', -38, null),
  ('PARK', 'HC-01', 'V04', 'Stormwater detention upgrade required by council engineer', 88000, 'pending', -16, null),
  ('PARK', 'HC-01', 'V05', 'Delete feature ceiling in lobby', -18000, 'approved', -30, -25),
  ('KAURI', 'CW-01', 'V01', 'Extra retaining to lots 14 to 16', 96000, 'approved', -80, -74),
  ('KAURI', 'CW-01', 'V02', 'Watercare connection relocation', 41000, 'pending', -21, null)
) as x(project, contract, number, description, amount, status, raised, decided)
join projects p on p.code = x.project
join contracts c on c.project_id = p.id and c.number = x.contract
on conflict (contract_id, number) do nothing;

-- ---------------------------------------------------------------- drawdowns

insert into drawdowns (project_id, number, period_to, amount, status, qs_certified_on, submitted_on, funded_on)
select p.id, x.number, current_date + x.period_to, x.amount, x.status,
  case when x.qs is null then null else current_date + x.qs end, case when x.sub is null then null else current_date + x.sub end, case when x.funded is null then null else current_date + x.funded end
from (values
  ('PARK', 5, -60, 1210000, 'funded', -55, -54, -45),
  ('PARK', 6, -30, 905000, 'funded', -25, -24, -16),
  ('PARK', 7, 0, 0, 'draft', null, null, null),
  ('KAURI', 4, -45, 690000, 'funded', -40, -40, -33),
  ('KAURI', 5, -15, 612000, 'submitted', -9, -8, null)
) as x(project, number, period_to, amount, status, qs, sub, funded)
join projects p on p.code = x.project
on conflict (project_id, number) do nothing;

-- ---------------------------------------------------------------- payment claims and invoices

insert into claims (project_id, contract_id, cost_code_id, supplier, reference, kind, description, received_on, claimed, scheduled, schedule_given_on, approved, retention_held, paid_on, drawdown_id)
select p.id, c.id, cc.id, x.supplier, x.reference, x.kind, x.description, current_date + x.received, x.claimed, x.scheduled,
  case when x.sched_on is null then null else current_date + x.sched_on end, x.approved, x.ret,
  case when x.paid is null then null else current_date + x.paid end,
  (select d.id from drawdowns d where d.project_id = p.id and d.number = x.dd)
from (values
  ('PARK', 'HC-01', '500', 'Coastline Constructions Pty Ltd', 'PC-01 to PC-05', 'payment-claim', 'Progress claims 1 to 5: site establishment, piling, basement', -95, 2660000, 2660000, -88, 2660000, 133000, -82, 5),
  ('PARK', 'HC-01', '500', 'Coastline Constructions Pty Ltd', 'PC-06', 'payment-claim', 'Progress claim 6: ground floor slab, V01', -48, 905000, 862000, -41, 862000, 43100, -33, 6),
  ('PARK', 'HC-01', '500', 'Coastline Constructions Pty Ltd', 'PC-07', 'payment-claim', 'Progress claim 7: level 1 slab and columns', -18, 910000, null, null, null, 0, null, null),
  ('PARK', 'CON-01', '300', 'Studio Linea Architects', 'INV-2207', 'invoice', 'Construction phase services, stage 3', -27, 42000, null, null, 42000, 0, -12, 6),
  ('PARK', 'CON-02', '300', 'Ardent Quantity Surveyors', 'AQS-0912', 'invoice', 'QS certification, claims 6 and 7', -9, 6400, null, null, 6400, 0, null, null),
  ('PARK', 'MKT-01', '600', 'Laneway Property Marketing', 'LPM-118', 'invoice', 'Display suite fit-out and campaign', -210, 128000, null, null, 128000, 0, -195, null),
  ('PARK', null, '100', 'Settlement statement', 'LAND-PARK', 'invoice', 'Land purchase at settlement', -820, 4100000, null, null, 4100000, 0, -820, null),
  ('PARK', null, '200', 'Revenue NSW', 'DUTY-PARK', 'invoice', 'Transfer duty', -820, 214000, null, null, 214000, 0, -820, null),
  ('PARK', null, '400', 'Inner West Council', 'S711-0412', 'invoice', 'Section 7.11 contributions', -170, 296000, null, null, 296000, 0, -168, null),
  ('ELM', 'CON-01', '300', 'Fold Architecture', 'FA-3381', 'invoice', 'Design development', -44, 38000, null, null, 38000, 0, -30, null),
  ('ELM', null, '100', 'Settlement statement', 'LAND-ELM', 'invoice', 'Land purchase at settlement', -700, 2650000, null, null, 2650000, 0, -700, null),
  ('KAURI', 'CW-01', '500', 'Dunmore Civil Ltd', 'PC-01 to PC-08', 'payment-claim', 'Progress claims 1 to 8: earthworks, retaining, drainage', -70, 2040000, 2040000, -60, 2040000, 102000, -45, 4),
  ('KAURI', 'CW-01', '500', 'Dunmore Civil Ltd', 'PC-09', 'payment-claim', 'Progress claim 9: roading subbase', -38, 640000, 612000, -22, 612000, 30600, -8, 5),
  ('KAURI', 'CW-01', '500', 'Dunmore Civil Ltd', 'PC-10', 'payment-claim', 'Progress claim 10: kerb and channel, services', -11, 585000, null, null, null, 0, null, null),
  ('KAURI', null, '100', 'Settlement statement', 'LAND-KAURI', 'invoice', 'Land purchase at settlement', -610, 4200000, null, null, 4200000, 0, -610, null),
  ('KAURI', null, '400', 'Auckland Council', 'DC-22871', 'invoice', 'Development contributions, first stage', -150, 410000, null, null, 410000, 0, -140, null),
  ('RYDE', 'CON-01', '300', 'Studio Linea Architects', 'INV-2215', 'invoice', 'DA redesign for setbacks', -6, 58000, null, null, null, 0, null, null),
  ('RYDE', null, '100', 'Settlement statement', 'LAND-RYDE', 'invoice', 'Land purchase at settlement', -230, 11500000, null, null, 11500000, 0, -230, null)
) as x(project, contract, code, supplier, reference, kind, description, received, claimed, scheduled, sched_on, approved, ret, paid, dd)
join projects p on p.code = x.project
left join contracts c on c.project_id = p.id and c.number = x.contract
join cost_codes cc on cc.project_id = p.id and cc.code = x.code
on conflict (project_id, supplier, reference) do nothing;

-- ---------------------------------------------------------------- lots

insert into lots (project_id, lot_no, kind, bedrooms, internal_m2, list_price, status, price, buyer, buyer_email, foreign_buyer, firb_ref, exchanged_on, deposit, deposit_held_by,
  disclosure_given_on, gst_notice_given_on, margin_scheme_agreed, sunset_on, rescinded_on, rescind_reason, purchaser_consent_on, court_order_ref, sunset_notice_on)
select p.id, x.lot_no, x.kind, x.beds, x.m2, x.list_price, x.status, x.price, x.buyer, x.email, x.foreign_buyer, x.firb,
  case when x.exch is null then null else current_date + x.exch end, x.deposit, x.held_by,
  case when x.disc is null then null else current_date + x.disc end, case when x.gst is null then null else current_date + x.gst end, x.ms,
  case when x.sunset is null then null else current_date + x.sunset end, case when x.resc is null then null else current_date + x.resc end, x.reason, null, null,
  case when x.notice is null then null else current_date + x.notice end
from (values
  -- PARK: off the plan in NSW, sunset 70 days out, completion forecast 110 days out
  ('PARK', 'G01', 'apartment', 2, 78, 1020000, 'exchanged', 1020000, 'M. and J. Russo', 'russo@example.com', false, null, -400, 102000, 'Halden Lawyers trust account', -402, -400, true, 70, null, null, null),
  ('PARK', 'G02', 'apartment', 2, 76, 1000000, 'rescinded', 1000000, 'P. Oyelaran', 'oyelaran@example.com', false, null, -720, 100000, 'Halden Lawyers trust account', -722, -720, true, -12, -5, 'sunset', -9),
  ('PARK', 'G03', 'apartment', 1, 52, 760000, 'exchanged', 760000, 'T. Nguyen', 'tnguyen@example.com', false, null, -260, 38000, 'Halden Lawyers trust account', -262, -260, true, 70, null, null, null),
  ('PARK', 'G04', 'apartment', 1, 53, 780000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('PARK', '101', 'apartment', 2, 80, 1050000, 'exchanged', 1050000, 'Wei Zhang', 'wzhang@example.com', true, null, -300, 105000, 'Halden Lawyers trust account', -302, -300, true, 70, null, null, null),
  ('PARK', '102', 'apartment', 2, 81, 1060000, 'exchanged', 1060000, 'S. Patel', 'spatel@example.com', false, null, -380, 106000, 'Halden Lawyers trust account', -381, -380, true, 70, null, null, null),
  ('PARK', '103', 'apartment', 3, 104, 1420000, 'exchanged', 1420000, 'K. Morrison', 'kmorrison@example.com', false, null, -410, 142000, 'Halden Lawyers trust account', -411, -410, true, 70, null, null, null),
  ('PARK', '104', 'apartment', 2, 81, 1070000, 'exchanged', 1070000, 'A. Haddad', 'ahaddad@example.com', false, null, -190, 107000, 'Halden Lawyers trust account', -192, null, true, 70, null, null, null),
  ('PARK', '105', 'apartment', 1, 54, 790000, 'exchanged', 790000, 'L. Brennan', 'lbrennan@example.com', false, null, -150, 39500, 'Halden Lawyers trust account', -151, -150, true, 70, null, null, null),
  ('PARK', '106', 'apartment', 2, 82, 1080000, 'hold', null, 'Enquiry: R. Cole', null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('PARK', '201', 'apartment', 3, 106, 1480000, 'exchanged', 1480000, 'H. Tanaka', 'htanaka@example.com', true, 'FIRB N-2025-118402', -330, 148000, 'Halden Lawyers trust account', -331, -330, true, 70, null, null, null),
  ('PARK', '202', 'apartment', 2, 82, 1120000, 'exchanged', 1120000, 'D. Kowalski', 'dkowalski@example.com', false, null, -95, 112000, 'Halden Lawyers trust account', null, -95, true, 70, null, null, null),
  ('PARK', '203', 'apartment', 2, 83, 1130000, 'exchanged', 1130000, 'R. and E. Silva', 'silva@example.com', false, null, -60, 113000, 'Halden Lawyers trust account', -61, -60, false, 70, null, null, null),
  ('PARK', '204', 'apartment', 2, 83, 1140000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('PARK', '205', 'apartment', 1, 55, 820000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('PARK', '206', 'apartment', 3, 128, 1950000, 'exchanged', 1950000, 'G. Whitfield', 'gwhitfield@example.com', false, null, -230, 195000, 'Halden Lawyers trust account', -231, -230, true, 70, null, null, null),
  -- ELM: off the plan in Victoria, sunset well out
  ('ELM', 'T1', 'townhouse', 3, 168, 1240000, 'exchanged', 1240000, 'C. Ellis', 'cellis@example.com', false, null, -80, 124000, 'Mason Conveyancing trust account', null, -80, false, 600, null, null, null),
  ('ELM', 'T2', 'townhouse', 3, 168, 1250000, 'exchanged', 1250000, 'N. Okafor', 'nokafor@example.com', false, null, -64, 125000, 'Mason Conveyancing trust account', null, -64, false, 600, null, null, null),
  ('ELM', 'T3', 'townhouse', 4, 196, 1310000, 'exchanged', 1310000, 'B. Lindqvist', 'blindqvist@example.com', false, null, -41, 196500, 'Mason Conveyancing trust account', null, -41, false, 600, null, null, null),
  ('ELM', 'T4', 'townhouse', 3, 170, 1255000, 'exchanged', 1255000, 'F. Romano', 'fromano@example.com', false, null, -20, 62750, 'Mason Conveyancing trust account', null, -20, false, 600, null, null, null),
  ('ELM', 'T5', 'townhouse', 3, 170, 1260000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('ELM', 'T6', 'townhouse', 3, 170, 1265000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('ELM', 'T7', 'townhouse', 4, 198, 1320000, 'hold', null, 'Enquiry: J. Abbott', null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('ELM', 'T8', 'townhouse', 3, 172, 1180000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  -- KAURI: sections in Auckland
  ('KAURI', 'L1', 'land', null, null, 640000, 'exchanged', 640000, 'Ngata Family Trust', 'ngata@example.com', false, null, -140, 64000, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L2', 'land', null, null, 655000, 'exchanged', 655000, 'J. and S. Patel', 'jspatel@example.com', false, null, -138, 65500, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L3', 'land', null, null, 660000, 'exchanged', 660000, 'Harcourt Homes Ltd', 'build@harcourt.example.com', false, null, -120, 66000, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L4', 'land', null, null, 670000, 'exchanged', 670000, 'Harcourt Homes Ltd', 'build@harcourt.example.com', false, null, -120, 67000, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L5', 'land', null, null, 690000, 'exchanged', 690000, 'M. Tupou', 'mtupou@example.com', false, null, -96, 69000, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L6', 'land', null, null, 710000, 'exchanged', 710000, 'A. Singh', 'asingh@example.com', false, null, -88, 35500, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L7', 'land', null, null, 700000, 'exchanged', 700000, 'K. Walker', 'kwalker@example.com', false, null, -60, 70000, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L8', 'land', null, null, 720000, 'exchanged', 720000, 'Pohutukawa Builders Ltd', 'sales@pohutukawa.example.com', false, null, -45, 72000, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L9', 'land', null, null, 725000, 'exchanged', 725000, 'E. Fraser', 'efraser@example.com', false, null, -30, 72500, 'Fenwick Law trust account', null, null, false, 260, null, null, null),
  ('KAURI', 'L10', 'land', null, null, 690000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('KAURI', 'L11', 'land', null, null, 680000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('KAURI', 'L12', 'land', null, null, 675000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('KAURI', 'L13', 'land', null, null, 700000, 'hold', null, 'Enquiry: T. Rangi', null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('KAURI', 'L14', 'land', null, null, 760000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('KAURI', 'L15', 'land', null, null, 770000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('KAURI', 'L16', 'land', null, null, 780000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('KAURI', 'L17', 'land', null, null, 640000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null),
  ('KAURI', 'L18', 'land', null, null, 635000, 'available', null, null, null, false, null, null, null, null, null, null, false, null, null, null, null)
) as x(project, lot_no, kind, beds, m2, list_price, status, price, buyer, email, foreign_buyer, firb, exch, deposit, held_by, disc, gst, ms, sunset, resc, reason, notice)
join projects p on p.code = x.project
on conflict (project_id, lot_no) do nothing;

-- ---------------------------------------------------------------- approvals and conditions

insert into approvals (project_id, kind, authority, reference, status, lodged_on, rfi_due_on, decided_on, lapses_on, commenced_on)
select p.id, x.kind, x.authority, x.reference, x.status,
  case when x.lodged is null then null else current_date + x.lodged end, case when x.rfi is null then null else current_date + x.rfi end,
  case when x.decided is null then null else current_date + x.decided end, case when x.lapses is null then null else current_date + x.lapses end,
  case when x.commenced is null then null else current_date + x.commenced end
from (values
  ('PARK', 'development-consent', 'Inner West Council', 'DA2023/0412', 'approved', -1150, null, -900, 925, -150),
  ('PARK', 'construction-certificate', 'Meridian Certifiers', 'CC-0412-01', 'approved', -230, null, -168, null, -150),
  ('PARK', 'occupation-certificate', 'Meridian Certifiers', 'OC-0412', 'preparing', null, null, null, null, null),
  ('ELM', 'planning-permit', 'Whitehorse City Council', 'PLN22/0381', 'approved', -900, null, -640, 90, null),
  ('ELM', 'building-permit', 'Eastside Building Surveyors', 'BP-77120', 'preparing', null, null, null, null, null),
  ('KAURI', 'resource-consent', 'Auckland Council', 'BUN60412257', 'approved', -560, null, -470, 1355, -160),
  ('KAURI', 'subdivision', 'Auckland Council', '224C-60412257', 'preparing', null, null, null, null, null),
  ('RYDE', 'development-consent', 'City of Ryde', 'LDA2026/0088', 'rfi', -190, -4, null, null, null)
) as x(project, kind, authority, reference, status, lodged, rfi, decided, lapses, commenced)
join projects p on p.code = x.project
on conflict (project_id, reference) do nothing;

insert into conditions (approval_id, number, description, gate, status, satisfied_on, owner_id)
select a.id, x.number, x.description, x.gate, x.status, case when x.sat is null then null else current_date + x.sat end, (select id from staff where code = x.owner)
from (values
  ('DA2023/0412', 'C12', 'Section 7.11 contributions paid before the construction certificate', 'before-construction', 'satisfied', -168, 'JP'),
  ('DA2023/0412', 'C41', 'Dilapidation reports on 10 and 14 Railway Parade', 'before-construction', 'satisfied', -155, 'JP'),
  ('DA2023/0412', 'C58', 'Construction traffic management plan approved by council', 'before-construction', 'open', null, 'JP'),
  ('DA2023/0412', 'C87', 'On-site stormwater detention built to the council engineer''s design', 'during-construction', 'open', null, 'JP'),
  ('DA2023/0412', 'C112', 'Acoustic certification of rail noise treatment', 'before-occupation', 'open', null, 'JP'),
  ('DA2023/0412', 'C118', 'BASIX commitments certified', 'before-occupation', 'open', null, 'JP'),
  ('DA2023/0412', 'C130', 'Strata subdivision certificate', 'before-title', 'open', null, 'LS'),
  ('PLN22/0381', '1', 'Amended plans showing the 3 metre rear setback', 'before-construction', 'satisfied', -500, 'JP'),
  ('PLN22/0381', '14', 'Construction management plan endorsed', 'before-construction', 'open', null, 'JP'),
  ('PLN22/0381', '22', 'Development must start within two years of the permit date', 'before-construction', 'open', null, 'JP'),
  ('BUN60412257', 'E7', 'Engineering plan approval for roading and three waters', 'before-construction', 'satisfied', -170, 'AK'),
  ('BUN60412257', 'E19', 'Geotechnical completion report for lots 12 to 18', 'before-title', 'open', null, 'AK'),
  ('BUN60412257', 'S5', 'Consent notice for minimum floor levels', 'before-title', 'open', null, 'AK')
) as x(reference, number, description, gate, status, sat, owner)
join approvals a on a.reference = x.reference
on conflict (approval_id, number) do nothing;

insert into notes (project_id, body, author, created_at)
select p.id, x.body, x.author, now() - make_interval(days => x.ago)
from (values
  ('PARK', 'Coastline says the brick facade (V03) adds three weeks. Need a decision before level 2 starts.', 'JP', 12),
  ('PARK', 'Lender monitoring QS on site for drawdown 7 next week.', 'JP', 4),
  ('ELM', 'Northcote price is 9.8% over the estimate. Asked for a value engineering list.', 'JP', 10),
  ('KAURI', 'Watercare relocation (V02) not in Dunmore''s programme yet.', 'AK', 18),
  ('RYDE', 'Council wants 6 metre setback to the eastern boundary. Architect redesigning to 36 units.', 'DM', 25)
) as x(project, body, author, ago)
join projects p on p.code = x.project
where not exists (select 1 from notes n where n.project_id = p.id and n.body = x.body);
