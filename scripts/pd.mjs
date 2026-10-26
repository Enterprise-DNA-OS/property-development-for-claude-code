#!/usr/bin/env node
// property-development-for-claude-code: the one CLI. The slash commands call this; so can you.
//
//   node scripts/pd.mjs <command> [args] [--flags] [--json]
//   npm run pd -- <command> ...
//
// Run with no arguments (or `help`) for the command list.
//
// This records what a property developer keeps for its projects: the feasibility in versions,
// the budget by cost code against contracts, variations and payment claims, the lot and presale
// register against the lender's hurdle, drawdowns, approvals and their conditions. It sends
// nothing and pays nothing: payment schedules, drawdown packs and buyer letters are drafted here,
// a person sends them, and money moves through the business's own bank and accounts.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick, yesNo } from './lib/csv.mjs';
import { table, isoDate, truncate, heading } from './lib/format.mjs';

// ---------------------------------------------------------------- settings

// Sunset dates this close are flagged.
const SUNSET_WARN_DAYS = 90;
// An approval lapsing inside this window with no works started is flagged.
const LAPSE_WARN_DAYS = 180;
// A variation waiting this long for a decision is flagged.
const VARIATION_STALE_DAYS = 14;
// A payment schedule due inside this many days is flagged before it is missed.
const SCHEDULE_WARN_DAYS = 3;
// A lot on hold this long is flagged.
const HOLD_STALE_DAYS = 21;

const STAGES = ['acquisition', 'feasibility', 'approvals', 'presales', 'construction', 'completion', 'settled', 'abandoned'];
const COST_CATEGORIES = ['land', 'acquisition', 'professional-fees', 'statutory', 'construction', 'contingency', 'marketing', 'selling', 'finance', 'holding', 'other'];
const REVENUE_CATEGORIES = ['sales', 'rent', 'other-income'];

// ---------------------------------------------------------------- arguments

const BOOL_FLAGS = new Set(['json', 'help', 'all', 'dry-run', 'open', 'foreign', 'payment-claim', 'margin-scheme', 'unsold', 'sold']);

function parseArgv(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { flags.help = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let name, value;
      if (eq > -1) { name = a.slice(2, eq); value = a.slice(eq + 1); }
      else {
        name = a.slice(2);
        const next = argv[i + 1];
        if (BOOL_FLAGS.has(name) || next === undefined || next.startsWith('--')) value = true;
        else value = argv[++i];
      }
      flags[name] = value;
    } else args.push(a);
  }
  return { args, flags };
}

class CliError extends Error {
  constructor(message, code = 1) { super(message); this.code = code; }
}

const n = (v) => Number(v ?? 0);
const str = (v) => (v === true || v === undefined || v === null ? '' : String(v));
const $ = (v) => (v === null || v === undefined || v === '' ? '' : `${n(v) < 0 ? '-' : ''}$${Math.abs(Math.round(n(v))).toLocaleString('en-AU')}`);
const pct = (v) => (v === null || v === undefined || v === '' ? '' : `${n(v).toFixed(1)}%`);
const signed = (v) => (n(v) > 0 ? `+${$(v)}` : $(v));

function today() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const addDays = (date, days) => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + days); return isoDate(d); };

function parseDate(v, what = 'date') {
  if (!v || v === true) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.toLowerCase() === 'today') return today();
  if (s.toLowerCase() === 'yesterday') return addDays(today(), -1);
  // Australian and New Zealand exports write DD/MM/YYYY.
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  throw new CliError(`"${v}" is not a ${what}. Use YYYY-MM-DD.`);
}

// "$1,250,000", "1250000", "1.25m", "850k" and "(12,000)" are all amounts. Brackets are negative.
function parseMoney(v, what = 'amount') {
  if (v === undefined || v === null || v === '' || v === true) return null;
  let s = String(v).trim().toLowerCase();
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()$,\s-]/g, '').replace(/^(aud|nzd)/, '');
  let mult = 1;
  if (s.endsWith('m')) { mult = 1e6; s = s.slice(0, -1); } else if (s.endsWith('k')) { mult = 1e3; s = s.slice(0, -1); }
  const x = Number(s) * mult;
  if (!s || !Number.isFinite(x)) throw new CliError(`"${v}" is not an ${what}.`);
  return Math.round((neg ? -x : x) * 100) / 100;
}

// ---------------------------------------------------------------- lookups

let db;
let JSON_OUT = false;

function ambiguous(what, rows, label) {
  return new CliError(`More than one ${what} matches. Be more specific:\n${rows.map((r) => `  ${label(r)}`).join('\n')}`);
}

async function findProject(ref) {
  if (!ref || ref === true) throw new CliError('Which project? Give its code (PARK) or part of its name.');
  const rows = await db.query(`select p.*, s.code as manager from projects p left join staff s on s.id = p.manager_id
    where lower(p.code) = lower($1) or p.name ilike $2 or p.address ilike $2 order by p.code`, [ref, `%${ref}%`]);
  const exact = rows.filter((r) => r.code.toLowerCase() === String(ref).toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No project "${ref}". Run: pd projects`);
  throw ambiguous('project', rows, (r) => `${r.code}  ${r.name}`);
}

async function findFeaso(p, version) {
  const rows = version
    ? await db.query(`select * from feasibilities where project_id = $1 and version = $2`, [p.id, Number(version)])
    : await db.query(`select * from feasibilities where project_id = $1 order by (status = 'approved') desc, version desc limit 1`, [p.id]);
  if (!rows.length) throw new CliError(version ? `${p.code} has no feasibility version ${version}. Run: pd feasos ${p.code}` : `${p.code} has no feasibility yet. Start one: pd feaso-new ${p.code} "label"`);
  return rows[0];
}

async function findLot(p, ref) {
  if (!ref || ref === true) throw new CliError(`Which lot on ${p.code}? Give the lot number.`);
  const rows = await db.query(`select * from lots where project_id = $1 and (lower(lot_no) = lower($2) or buyer ilike $3) order by lot_no`, [p.id, ref, `%${ref}%`]);
  const exact = rows.filter((r) => r.lot_no.toLowerCase() === String(ref).toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No lot "${ref}" on ${p.code}. Run: pd lots ${p.code}`);
  throw ambiguous('lot', rows, (r) => `${r.lot_no}  ${r.status}  ${r.buyer || ''}`);
}

async function findContract(p, ref) {
  if (!ref || ref === true) throw new CliError(`Which contract on ${p.code}? Give its number (HC-01) or the supplier.`);
  const rows = await db.query(`select * from contracts where project_id = $1 and (lower(number) = lower($2) or supplier ilike $3) order by number`, [p.id, ref, `%${ref}%`]);
  const exact = rows.filter((r) => r.number.toLowerCase() === String(ref).toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No contract "${ref}" on ${p.code}. Run: pd contracts --project=${p.code}`);
  throw ambiguous('contract', rows, (r) => `${r.number}  ${r.supplier}`);
}

async function findCostCode(p, ref) {
  if (!ref || ref === true) throw new CliError(`Which cost code on ${p.code}? Give the code (500) or its name.`);
  const rows = await db.query(`select * from cost_codes where project_id = $1 and (code = $2 or description ilike $3 or category = lower($2)) order by code`, [p.id, String(ref), `%${ref}%`]);
  const exact = rows.filter((r) => r.code === String(ref));
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No cost code "${ref}" on ${p.code}. Run: pd costs ${p.code}`);
  throw ambiguous('cost code', rows, (r) => `${r.code}  ${r.description}`);
}

async function findClaim(p, ref) {
  if (!ref || ref === true) throw new CliError(`Which claim on ${p.code}? Give its reference (PC-07).`);
  const rows = await db.query(`select * from claims where project_id = $1 and (lower(reference) = lower($2) or reference ilike $3) order by received_on`, [p.id, ref, `%${ref}%`]);
  const exact = rows.filter((r) => r.reference.toLowerCase() === String(ref).toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No claim "${ref}" on ${p.code}. Run: pd claims --project=${p.code}`);
  throw ambiguous('claim', rows, (r) => `${r.reference}  ${r.supplier}  ${$(r.claimed)}`);
}

function out(data, human) {
  if (JSON_OUT) console.log(JSON.stringify(data, null, 2));
  else console.log(typeof human === 'function' ? human(data) : human);
}

// ---------------------------------------------------------------- the feasibility maths

// Monthly cash flow from the lines: each spread evenly over its months. Costs out, revenue in.
function cashflow(lines) {
  const months = Math.max(1, ...lines.map((l) => n(l.start_month) + n(l.span_months) - 1));
  const flows = new Array(months).fill(0);
  for (const l of lines) {
    const each = n(l.amount) / n(l.span_months);
    for (let m = n(l.start_month); m < n(l.start_month) + n(l.span_months); m++) flows[m - 1] += l.side === 'revenue' ? each : -each;
  }
  return flows;
}

// Monthly IRR by bisection, annualised. Null when the flows never change sign.
function irr(flows) {
  const npv = (r) => flows.reduce((s, f, i) => s + f / (1 + r) ** i, 0);
  if (!flows.some((f) => f < 0) || !flows.some((f) => f > 0)) return null;
  let lo = -0.99, hi = 1;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
  }
  return Math.round(((1 + (lo + hi) / 2) ** 12 - 1) * 1000) / 10;
}

function metrics(lines, target) {
  const rev = lines.filter((l) => l.side === 'revenue').reduce((s, l) => s + n(l.amount), 0);
  const cost = lines.filter((l) => l.side === 'cost').reduce((s, l) => s + n(l.amount), 0);
  const land = lines.filter((l) => l.category === 'land').reduce((s, l) => s + n(l.amount), 0);
  const flows = cashflow(lines);
  let cum = 0, peak = 0, peakMonth = 0;
  flows.forEach((f, i) => { cum += f; if (cum < peak) { peak = cum; peakMonth = i + 1; } });
  const profit = rev - cost;
  const m = n(target) / 100;
  return {
    revenue: rev, cost, profit, land,
    margin_on_cost_pct: cost ? Math.round((1000 * profit) / cost) / 10 : null,
    margin_on_revenue_pct: rev ? Math.round((1000 * profit) / rev) / 10 : null,
    irr_pct: irr(flows),
    peak_funding: Math.round(-peak), peak_month: peakMonth, months: flows.length,
    // The most the land can cost and still make the target margin, other costs held.
    residual_land_value: Math.round(rev / (1 + m) - (cost - land)),
    // How far sales can fall before the profit is gone.
    break_even_revenue_drop_pct: rev ? Math.round((1000 * profit) / rev) / 10 : null,
  };
}

async function feasoLines(f) {
  return db.query(`select * from feasibility_lines where feasibility_id = $1 order by side desc, start_month, description`, [f.id]);
}

// ---------------------------------------------------------------- overview

async function stats() {
  const [s] = await db.query(`select
    (select count(*) from projects where stage not in ('settled', 'abandoned'))::int as live_projects,
    (select count(*) from lots)::int as lots,
    (select count(*) from lots where status in ('exchanged', 'settled'))::int as sold,
    (select count(*) from lots where status in ('available', 'hold', 'rescinded'))::int as unsold,
    (select coalesce(sum(expected_price), 0) from lot_book) as gross_realisation,
    (select coalesce(sum(price), 0) from lots where status = 'exchanged') as exchanged_value,
    (select count(*) from claims where paid_on is null)::int as open_claims,
    (select count(*) from variations where status = 'pending')::int as pending_variations,
    (select coalesce(sum(overrun), 0) from cost_position) as cost_overrun`);
  const by = await db.query(`select stage, count(*)::int as projects from projects group by stage order by array_position($1::text[], stage)`, [STAGES]);
  const checks = await runChecks();
  s.breaches = checks.filter((c) => c.severity === 'breach').reduce((t, c) => t + c.rows.length, 0);
  s.risks = checks.filter((c) => c.severity === 'risk').reduce((t, c) => t + c.rows.length, 0);
  s.by_stage = by;
  out(s, (d) => [heading('Harbour view: every project at once'),
    `  Live projects  ${d.live_projects}   (${d.by_stage.map((b) => `${b.stage} ${b.projects}`).join(', ')})`,
    `  Lots           ${d.lots}: ${d.sold} sold, ${d.unsold} unsold. Exchanged and not settled: ${$(d.exchanged_value)}`,
    `  Revenue        ${$(d.gross_realisation)} expected across every lot (contract price where sold, list price where not)`,
    `  Costs          ${$(d.cost_overrun)} forecast over budget. ${d.pending_variations} variations waiting on a decision`,
    `  Claims         ${d.open_claims} unpaid`,
    `  Compliance     ${d.breaches} breaches, ${d.risks} risks (pd compliance)`].join('\n'));
}

async function projects() {
  const rows = await db.query(`select * from project_position order by array_position($1::text[], stage), project`, [STAGES]);
  out(rows, (r) => [heading('Projects: the approved feasibility against the forecast now'), table(r, [
    { key: 'project', label: 'Project' }, { key: 'name', label: 'Name', width: 24 }, { key: 'stage', label: 'Stage' }, { key: 'manager', label: 'Mgr' },
    { key: 'feaso_margin_pct', label: 'Feaso margin', align: 'right', format: pct },
    { key: 'forecast_margin_pct', label: 'Forecast margin', align: 'right', format: pct },
    { key: 'target_margin_pct', label: 'Target', align: 'right', format: pct },
    { key: 'forecast_profit', label: 'Forecast profit', align: 'right', format: $ },
    { key: 'cost_overrun', label: 'Over budget', align: 'right', format: $ },
    { key: 'sold', label: 'Sold', align: 'right' }, { key: 'unsold', label: 'Unsold', align: 'right' },
  ]), '', '  Margin is profit on cost. Forecast revenue uses contract prices where sold and list prices where not.'].join('\n'));
}

async function projectCard(args) {
  const p = await findProject(args[0]);
  const [pos] = await db.query(`select * from project_position where project_id = $1`, [p.id]);
  const [pre] = await db.query(`select * from presale_position where project_id = $1`, [p.id]);
  const approvals = await db.query(`select kind, reference, status, decided_on, lapses_on, days_to_lapse, commenced_on, open_conditions from approval_status where project_id = $1 order by lodged_on nulls last`, [p.id]);
  const costs = await db.query(`select code, description, budget, committed, actual, forecast_final, overrun from cost_position where project_id = $1 order by code`, [p.id]);
  const notes = await db.query(`select created_at::date as on, author, body from notes where project_id = $1 order by created_at desc limit 5`, [p.id]);
  const data = { project: p, position: pos, presales: pre, approvals, costs, notes };
  out(data, (d) => [heading(`${p.code} ${p.name}: ${p.address || ''}`),
    `  ${p.kind}, ${p.jurisdiction}, ${p.currency}. Stage: ${p.stage} for ${pos.days_in_stage} days. Manager: ${p.manager || 'nobody'}.`,
    `  Feasibility v${pos.feaso_version ?? '-'}: revenue ${$(pos.feaso_revenue)}, cost ${$(pos.feaso_cost)}, profit ${$(pos.feaso_profit)} (${pct(pos.feaso_margin_pct)} on cost)`,
    `  Forecast now:    revenue ${$(pos.forecast_revenue)}, cost ${$(pos.forecast_cost)}, profit ${$(pos.forecast_profit)} (${pct(pos.forecast_margin_pct)} on cost, target ${pct(p.target_margin_pct)})`,
    p.lender ? `  Lender ${p.lender}: facility ${$(p.facility_limit)}, presale hurdle ${$(pre.hurdle)}, qualifying presales ${$(pre.qualifying_value)}${n(pre.qualifying_value) < n(pre.hurdle) ? `, SHORT BY ${$(n(pre.hurdle) - n(pre.qualifying_value))}` : ', covenant met'}` : '  No lender recorded.',
    p.completion_forecast_on ? `  Completion forecast ${isoDate(p.completion_forecast_on)}` : '',
    '', '  Approvals', table(d.approvals, [{ key: 'kind', label: 'Kind' }, { key: 'reference', label: 'Ref' }, { key: 'status', label: 'Status' }, { key: 'lapses_on', label: 'Lapses', format: isoDate }, { key: 'commenced_on', label: 'Commenced', format: isoDate }, { key: 'open_conditions', label: 'Open conds', align: 'right' }]),
    '', '  Cost report', table(d.costs, [{ key: 'code', label: 'Code' }, { key: 'description', label: 'Item' }, { key: 'budget', label: 'Budget', align: 'right', format: $ }, { key: 'committed', label: 'Committed', align: 'right', format: $ }, { key: 'actual', label: 'Spent', align: 'right', format: $ }, { key: 'forecast_final', label: 'Forecast', align: 'right', format: $ }, { key: 'overrun', label: 'Over', align: 'right', format: $ }]),
    d.notes.length ? '\n  Notes\n' + d.notes.map((x) => `  ${isoDate(x.on)}  ${x.author || ''}  ${x.body}`).join('\n') : ''].filter((x) => x !== '').join('\n'));
}

async function staff() {
  const rows = await db.query(`select s.code, s.full_name, s.role,
    (select string_agg(p.code, ', ' order by p.code) from projects p where p.manager_id = s.id and p.stage not in ('settled', 'abandoned')) as projects,
    (select count(*) from conditions c where c.owner_id = s.id and c.status = 'open')::int as open_conditions
    from staff s order by s.code`);
  out(rows, (r) => [heading('Staff'), table(r, [{ key: 'code', label: 'Code' }, { key: 'full_name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'projects', label: 'Projects' }, { key: 'open_conditions', label: 'Open conditions', align: 'right' }])].join('\n'));
}

// ---------------------------------------------------------------- feasibility

async function feasos(args) {
  const params = [];
  let where = '';
  if (args[0]) { const p = await findProject(args[0]); params.push(p.id); where = 'where t.project_id = $1'; }
  const rows = await db.query(`select t.*, s.code as by from feasibility_totals t join feasibilities f on f.id = t.feasibility_id left join staff s on s.id = f.prepared_by ${where} order by t.project, t.version`, params);
  for (const r of rows) {
    const lines = await db.query(`select * from feasibility_lines where feasibility_id = $1`, [r.feasibility_id]);
    const m = metrics(lines, r.target_margin_pct);
    r.irr_pct = m.irr_pct; r.peak_funding = m.peak_funding;
  }
  out(rows, (r) => [heading('Feasibility versions'), table(r, [
    { key: 'project', label: 'Project' }, { key: 'version', label: 'v', align: 'right' }, { key: 'label', label: 'Label', width: 34 }, { key: 'status', label: 'Status' },
    { key: 'prepared_on', label: 'Prepared', format: isoDate }, { key: 'revenue', label: 'Revenue', align: 'right', format: $ }, { key: 'cost', label: 'Cost', align: 'right', format: $ },
    { key: 'profit', label: 'Profit', align: 'right', format: $ }, { key: 'margin_on_cost_pct', label: 'Margin', align: 'right', format: pct }, { key: 'irr_pct', label: 'IRR', align: 'right', format: pct },
    { key: 'peak_funding', label: 'Peak funding', align: 'right', format: $ },
  ])].join('\n'));
}

async function feaso(args, flags) {
  const p = await findProject(args[0]);
  const f = await findFeaso(p, flags.version);
  const lines = await feasoLines(f);
  const m = metrics(lines, p.target_margin_pct);
  const byCat = {};
  for (const l of lines) byCat[`${l.side}:${l.category}`] = (byCat[`${l.side}:${l.category}`] || 0) + n(l.amount);
  const data = { project: p.code, version: f.version, label: f.label, status: f.status, target_margin_pct: n(p.target_margin_pct), ...m, lines };
  out(data, (d) => [heading(`${p.code} feasibility v${f.version}: ${f.label} (${f.status})`),
    table(lines, [{ key: 'side', label: 'Side' }, { key: 'category', label: 'Category' }, { key: 'description', label: 'Line', width: 44 }, { key: 'amount', label: 'Amount', align: 'right', format: $ }, { key: 'start_month', label: 'From month', align: 'right' }, { key: 'span_months', label: 'Months', align: 'right' }]),
    '',
    `  Revenue ${$(d.revenue)}   Cost ${$(d.cost)}   Profit ${$(d.profit)}`,
    `  Margin on cost ${pct(d.margin_on_cost_pct)} (target ${pct(d.target_margin_pct)})   Margin on revenue ${pct(d.margin_on_revenue_pct)}   IRR ${d.irr_pct === null ? 'n/a' : pct(d.irr_pct)} a year`,
    `  Peak funding ${$(d.peak_funding)} in month ${d.peak_month} of ${d.months}`,
    `  Residual land value at ${pct(d.target_margin_pct)}: ${$(d.residual_land_value)} (land in this version: ${$(d.land)})`,
    `  Sales can fall ${pct(d.break_even_revenue_drop_pct)} before the profit is gone.`,
    '', '  All figures ex GST. Cash flow spreads each line evenly over its months; IRR is monthly, annualised.'].join('\n'));
}

async function compare(args) {
  const p = await findProject(args[0]);
  const all = await db.query(`select * from feasibilities where project_id = $1 order by version`, [p.id]);
  if (all.length < 2 && !args[1]) throw new CliError(`${p.code} has only one feasibility version.`);
  const a = args[1] ? await findFeaso(p, args[1]) : all[all.length - 2];
  const b = args[2] ? await findFeaso(p, args[2]) : all[all.length - 1];
  const la = await feasoLines(a), lb = await feasoLines(b);
  const cats = [...new Set([...la, ...lb].map((l) => `${l.side}:${l.category}`))];
  const sum = (ls, k) => ls.filter((l) => `${l.side}:${l.category}` === k).reduce((s, l) => s + n(l.amount), 0);
  const rows = cats.map((k) => ({ side: k.split(':')[0], category: k.split(':')[1], a: sum(la, k), b: sum(lb, k), change: sum(lb, k) - sum(la, k) })).filter((r) => r.a || r.b);
  rows.sort((x, y) => (x.side === y.side ? Math.abs(y.change) - Math.abs(x.change) : x.side === 'revenue' ? -1 : 1));
  const ma = metrics(la, p.target_margin_pct), mb = metrics(lb, p.target_margin_pct);
  const data = { project: p.code, from: a.version, to: b.version, rows, from_metrics: ma, to_metrics: mb };
  out(data, (d) => [heading(`${p.code}: feasibility v${a.version} (${a.label}) against v${b.version} (${b.label})`),
    table(rows, [{ key: 'side', label: 'Side' }, { key: 'category', label: 'Category' }, { key: 'a', label: `v${a.version}`, align: 'right', format: $ }, { key: 'b', label: `v${b.version}`, align: 'right', format: $ }, { key: 'change', label: 'Change', align: 'right', format: signed }]),
    '',
    `  Profit   ${$(ma.profit)} -> ${$(mb.profit)} (${signed(mb.profit - ma.profit)})`,
    `  Margin   ${pct(ma.margin_on_cost_pct)} -> ${pct(mb.margin_on_cost_pct)} on cost (target ${pct(p.target_margin_pct)})`,
    `  IRR      ${ma.irr_pct === null ? 'n/a' : pct(ma.irr_pct)} -> ${mb.irr_pct === null ? 'n/a' : pct(mb.irr_pct)}`,
    `  Residual land value ${$(ma.residual_land_value)} -> ${$(mb.residual_land_value)}`].join('\n'));
}

async function sensitivity(args, flags) {
  const p = await findProject(args[0]);
  const f = await findFeaso(p, flags.version);
  const lines = await feasoLines(f);
  const revSteps = [-10, -5, 0, 5];
  const buildSteps = [-5, 0, 5, 10, 15];
  const grid = revSteps.map((r) => {
    const row = { revenue_change: r };
    for (const b of buildSteps) {
      const adj = lines.map((l) => ({ ...l, amount: l.side === 'revenue' ? n(l.amount) * (1 + r / 100) : ['construction', 'contingency'].includes(l.category) ? n(l.amount) * (1 + b / 100) : n(l.amount) }));
      row[`build_${b}`] = metrics(adj, p.target_margin_pct).margin_on_cost_pct;
    }
    return row;
  });
  out({ project: p.code, version: f.version, target_margin_pct: n(p.target_margin_pct), grid }, (d) => [heading(`${p.code} v${f.version}: margin on cost as sales prices and build cost move`),
    table(grid, [{ key: 'revenue_change', label: 'Sales prices', format: (v) => `${v > 0 ? '+' : ''}${v}%` }, ...buildSteps.map((b) => ({ key: `build_${b}`, label: `Build ${b > 0 ? '+' : ''}${b}%`, align: 'right', format: (v) => `${pct(v)}${n(v) < n(p.target_margin_pct) ? ' *' : ''}` }))]),
    '', `  * below the ${pct(p.target_margin_pct)} target. Build cost moves construction and contingency; everything else held.`].join('\n'));
}

async function residual(args, flags) {
  const p = await findProject(args[0]);
  const f = await findFeaso(p, flags.version);
  const lines = await feasoLines(f);
  const margins = flags.margin ? [Number(flags.margin)] : [15, 18, 20, 22, 25];
  const rows = margins.map((m) => ({ target_margin_pct: m, residual_land_value: metrics(lines, m).residual_land_value }));
  const land = lines.filter((l) => l.category === 'land').reduce((s, l) => s + n(l.amount), 0);
  out({ project: p.code, version: f.version, land, rows }, () => [heading(`${p.code} v${f.version}: the most you can pay for the land`),
    table(rows, [{ key: 'target_margin_pct', label: 'Margin on cost', format: pct }, { key: 'residual_land_value', label: 'Residual land value', align: 'right', format: $ }, { key: 'residual_land_value', label: 'Against land in feaso', align: 'right', format: (v) => signed(v - land) }]),
    '', `  Land in this version: ${$(land)}. Acquisition costs and finance are held at the feasibility's figures.`].join('\n'));
}

async function feasoNew(args, flags) {
  const p = await findProject(args[0]);
  const label = args.slice(1).join(' ').trim() || str(flags.label);
  if (!label) throw new CliError('pd feaso-new <project> "label" [--from=<version>]');
  const [{ next }] = await db.query(`select coalesce(max(version), 0) + 1 as next from feasibilities where project_id = $1`, [p.id]);
  const [f] = await db.query(`insert into feasibilities (project_id, version, label, prepared_by) values ($1, $2, $3, (select id from staff where code = $4)) returning *`, [p.id, next, label, str(flags.by).toUpperCase() || null]);
  let copied = 0;
  if (flags.from || next > 1) {
    const src = await findFeaso(p, flags.from || null);
    if (src.id !== f.id) {
      await db.query(`insert into feasibility_lines (feasibility_id, side, category, description, amount, start_month, span_months)
        select $1, side, category, description, amount, start_month, span_months from feasibility_lines where feasibility_id = $2`, [f.id, src.id]);
      [{ copied }] = await db.query(`select count(*)::int as copied from feasibility_lines where feasibility_id = $1`, [f.id]);
    }
  }
  out({ project: p.code, version: f.version, label, copied }, (d) => `  ${d.project} feasibility v${d.version} "${d.label}" started as a draft${d.copied ? `, ${d.copied} lines copied` : ''}. Change lines with: pd line ${d.project} ...`);
}

async function line(args, flags) {
  const p = await findProject(args[0]);
  const [side, category] = [str(args[1]).toLowerCase(), str(args[2]).toLowerCase()];
  const description = args[3];
  const amount = parseMoney(args[4]);
  const cats = side === 'revenue' ? REVENUE_CATEGORIES : COST_CATEGORIES;
  if (!['revenue', 'cost'].includes(side) || !cats.includes(category) || !description || amount === null)
    throw new CliError(`pd line <project> revenue|cost <category> "description" <amount> [--start=month] [--span=months] [--version]\n  cost categories: ${COST_CATEGORIES.join(', ')}\n  revenue categories: ${REVENUE_CATEGORIES.join(', ')}`);
  const f = await findFeaso(p, flags.version);
  if (f.status !== 'draft') throw new CliError(`v${f.version} is ${f.status}. Start a new version to change it: pd feaso-new ${p.code} "label"`);
  await db.query(`insert into feasibility_lines (feasibility_id, side, category, description, amount, start_month, span_months) values ($1,$2,$3,$4,$5,$6,$7)
    on conflict (feasibility_id, side, description) do update set category = excluded.category, amount = excluded.amount,
      start_month = coalesce($8, feasibility_lines.start_month), span_months = coalesce($9, feasibility_lines.span_months)`,
  [f.id, side, category, description, amount, Number(flags.start || 1), Number(flags.span || 1), flags.start ? Number(flags.start) : null, flags.span ? Number(flags.span) : null]);
  const m = metrics(await feasoLines(f), p.target_margin_pct);
  out({ project: p.code, version: f.version, description, amount, ...m }, (d) => `  ${p.code} v${f.version}: "${description}" ${$(amount)}. Profit now ${$(d.profit)}, ${pct(d.margin_on_cost_pct)} on cost.`);
}

async function approveFeaso(args) {
  const p = await findProject(args[0]);
  const f = await findFeaso(p, args[1]);
  await db.query(`update feasibilities set status = 'superseded' where project_id = $1 and status = 'approved' and id <> $2`, [p.id, f.id]);
  await db.query(`update feasibilities set status = 'approved', approved_on = current_date where id = $1`, [f.id]);
  out({ project: p.code, version: f.version }, (d) => `  ${d.project} v${d.version} approved; earlier approved versions marked superseded. Cost code budgets are unchanged: update them with pd budget if they should follow.`);
}

// ---------------------------------------------------------------- costs, contracts, variations

async function costs(args) {
  const p = await findProject(args[0]);
  const rows = await db.query(`select * from cost_position where project_id = $1 order by code`, [p.id]);
  const tot = rows.reduce((t, r) => { for (const k of ['budget', 'committed', 'pending_variations', 'actual', 'forecast_final', 'overrun', 'cost_to_complete']) t[k] = (t[k] || 0) + n(r[k]); return t; }, {});
  out({ project: p.code, rows, totals: tot }, () => [heading(`${p.code} cost report: budget, committed, spent, forecast`),
    table([...rows, { code: '', description: 'Total', ...tot }], [
      { key: 'code', label: 'Code' }, { key: 'description', label: 'Item', width: 32 }, { key: 'budget', label: 'Budget', align: 'right', format: $ },
      { key: 'committed', label: 'Committed', align: 'right', format: $ }, { key: 'pending_variations', label: 'Pending vars', align: 'right', format: $ },
      { key: 'actual', label: 'Spent', align: 'right', format: $ }, { key: 'forecast_final', label: 'Forecast final', align: 'right', format: $ },
      { key: 'overrun', label: 'Over budget', align: 'right', format: $ }, { key: 'cost_to_complete', label: 'To complete', align: 'right', format: $ }]),
    '', '  Forecast final is the larger of the budget and committed plus pending variations, never less than spent. Finance sits in the feasibility, not here.'].join('\n'));
}

async function contracts(flags) {
  const params = [];
  let where = '';
  if (flags.project) { const p = await findProject(flags.project); params.push(p.id); where = 'where project_id = $1'; }
  const rows = await db.query(`select * from contract_position ${where} order by project, number`, params);
  out(rows, (r) => [heading('Contracts: value, variations, claimed and retention'), table(r, [
    { key: 'project', label: 'Project' }, { key: 'number', label: 'No.' }, { key: 'supplier', label: 'Supplier', width: 30 }, { key: 'value', label: 'Value', align: 'right', format: $ },
    { key: 'approved_variations', label: 'Approved vars', align: 'right', format: $ }, { key: 'pending_variations', label: 'Pending vars', align: 'right', format: $ },
    { key: 'revised_value', label: 'Revised', align: 'right', format: $ }, { key: 'claimed_to_date', label: 'Claimed', align: 'right', format: $ },
    { key: 'retention_held', label: 'Retention held', align: 'right', format: $ }])].join('\n'));
}

async function contractNew(args, flags) {
  const p = await findProject(args[0]);
  const number = str(args[1]).toUpperCase();
  const supplier = args[2];
  const value = parseMoney(flags.value);
  if (!number || !supplier || value === null || !flags.code) throw new CliError('pd contract-new <project> <NUMBER> "Supplier" --value=7450000 --code=500 [--kind=construction|civil|consultant|marketing|other] [--retention=5] [--signed=YYYY-MM-DD]');
  const cc = await findCostCode(p, flags.code);
  await db.query(`insert into contracts (project_id, cost_code_id, number, supplier, kind, value, signed_on, retention_pct) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [p.id, cc.id, number, supplier, str(flags.kind) || 'construction', value, parseDate(flags.signed) || today(), Number(flags.retention || 0)]);
  out({ project: p.code, number, supplier, value }, (d) => `  ${d.project} ${d.number} ${d.supplier} for ${$(d.value)} added against ${cc.code} ${cc.description}.`);
}

async function variation(args, flags) {
  const p = await findProject(args[0]);
  const c = await findContract(p, args[1]);
  const amount = parseMoney(args[2]);
  const description = args.slice(3).join(' ').trim();
  if (amount === null || !description) throw new CliError('pd variation <project> <contract> <amount> "description" [--date]');
  const [{ next }] = await db.query(`select 'V' || lpad((count(*) + 1)::text, 2, '0') as next from variations where contract_id = $1`, [c.id]);
  await db.query(`insert into variations (contract_id, number, description, amount, raised_on) values ($1,$2,$3,$4,$5)`, [c.id, next, description, amount, parseDate(flags.date) || today()]);
  const [cc] = await db.query(`select * from cost_position where cost_code_id = $1`, [c.cost_code_id]);
  out({ project: p.code, contract: c.number, number: next, amount, cost_code_overrun: cc ? n(cc.overrun) : null }, (d) => `  ${d.project} ${d.contract} ${d.number} ${$(d.amount)} raised, pending.${cc ? ` ${cc.code} ${cc.description} now forecast ${$(cc.overrun)} over budget.` : ''}`);
}

async function decide(args, flags) {
  const p = await findProject(args[0]);
  const c = await findContract(p, args[1]);
  const num = str(args[2]).toUpperCase();
  const verdict = str(args[3]).toLowerCase();
  if (!num || !['approve', 'reject'].includes(verdict)) throw new CliError('pd decide <project> <contract> <V01> approve|reject [--amount=agreed figure]');
  const [v] = await db.query(`select * from variations where contract_id = $1 and upper(number) = $2`, [c.id, num]);
  if (!v) throw new CliError(`No variation ${num} on ${c.number}.`);
  const amount = parseMoney(flags.amount) ?? v.amount;
  await db.query(`update variations set status = $2, decided_on = current_date, amount = $3 where id = $1`, [v.id, verdict === 'approve' ? 'approved' : 'rejected', amount]);
  out({ project: p.code, contract: c.number, variation: num, status: verdict === 'approve' ? 'approved' : 'rejected', amount }, (d) => `  ${d.project} ${d.contract} ${d.variation} ${d.status}${d.status === 'approved' ? ` at ${$(d.amount)}` : ''}.`);
}

async function budget(args) {
  const p = await findProject(args[0]);
  const code = str(args[1]);
  const amount = parseMoney(args[2]);
  if (!code || amount === null) throw new CliError('pd budget <project> <code> <amount> ["description"]');
  const description = args.slice(3).join(' ').trim();
  const [row] = await db.query(`insert into cost_codes (project_id, code, category, description, budget) values ($1,$2,$3,$4,$5)
    on conflict (project_id, code) do update set budget = excluded.budget returning *`, [p.id, code, 'other', description || `Code ${code}`, amount]);
  out(row, (d) => `  ${p.code} ${d.code} ${d.description}: budget ${$(d.budget)}.`);
}

// ---------------------------------------------------------------- claims and drawdowns

async function claims(flags) {
  const params = [];
  const where = [];
  if (flags.project) { const p = await findProject(flags.project); params.push(p.id); where.push(`project_id = $${params.length}`); }
  if (flags.open || !flags.all) where.push('paid_on is null');
  const rows = await db.query(`select * from claim_clock ${where.length ? 'where ' + where.join(' and ') : ''} order by coalesce(schedule_due_on, received_on)`, params);
  const flag = (r) => (r.schedule_missed ? 'SCHEDULE MISSED' : r.schedule_late ? 'schedule late' : r.payment_overdue ? 'PAYMENT OVERDUE' : r.kind === 'payment-claim' && !r.schedule_given_on && r.schedule_due_on ? `schedule by ${isoDate(r.schedule_due_on)}` : '');
  out(rows.map((r) => ({ ...r, flag: flag(r) })), (r) => [heading(flags.all ? 'Every claim and invoice' : 'Claims and invoices not yet paid'), table(r, [
    { key: 'project', label: 'Project' }, { key: 'supplier', label: 'Supplier', width: 28 }, { key: 'reference', label: 'Ref' }, { key: 'kind', label: 'Kind' },
    { key: 'received_on', label: 'Received', format: isoDate }, { key: 'claimed', label: 'Claimed', align: 'right', format: $ }, { key: 'scheduled', label: 'Scheduled', align: 'right', format: $ },
    { key: 'pay_due_on', label: 'Pay by', format: isoDate }, { key: 'flag', label: 'Clock' }]),
    '', '  Clocks count weekdays only (public holidays are not taken out, so the real deadline is never earlier). Rules: pd rules.'].join('\n'));
}

async function claimNew(args, flags) {
  const p = await findProject(args[0]);
  const supplier = args[1];
  const reference = args[2];
  const amount = parseMoney(args[3]);
  if (!supplier || !reference || amount === null || !flags.code) throw new CliError('pd claim <project> "Supplier" <REF> <amount> --code=500 [--contract=HC-01] [--payment-claim] [--date=received] ["--desc=..."]');
  const cc = await findCostCode(p, flags.code);
  const c = flags.contract ? await findContract(p, flags.contract) : null;
  await db.query(`insert into claims (project_id, contract_id, cost_code_id, supplier, reference, kind, description, received_on, claimed) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [p.id, c?.id || null, cc.id, supplier, reference, flags['payment-claim'] ? 'payment-claim' : 'invoice', str(flags.desc) || null, parseDate(flags.date) || today(), amount]);
  const [r] = await db.query(`select * from claim_clock where project_id = $1 and supplier = $2 and reference = $3`, [p.id, supplier, reference]);
  out(r, (d) => `  ${p.code} ${d.reference} from ${d.supplier} for ${$(d.claimed)} recorded.${d.schedule_due_on ? ` Payment schedule due by ${isoDate(d.schedule_due_on)}, payment by ${isoDate(d.pay_due_on)}.` : d.kind === 'payment-claim' ? ` No statutory clock recorded for ${p.jurisdiction}: check the contract and add the rule with /customise.` : ''}`);
}

async function schedule(args, flags) {
  const p = await findProject(args[0]);
  const cl = await findClaim(p, args[1]);
  const amount = parseMoney(args[2]);
  if (amount === null) throw new CliError('pd schedule <project> <claim ref> <scheduled amount> [--date] [--retention=amount held]');
  const ret = flags.retention !== undefined ? parseMoney(flags.retention) : 0;
  await db.query(`update claims set scheduled = $2, approved = $2, schedule_given_on = $3, retention_held = $4 where id = $1`, [cl.id, amount, parseDate(flags.date) || today(), ret]);
  const [r] = await db.query(`select * from claim_clock where claim_id = $1`, [cl.id]);
  out(r, (d) => `  ${p.code} ${d.reference}: schedule of ${$(d.scheduled)} against ${$(d.claimed)} claimed, given ${isoDate(d.schedule_given_on)}${d.schedule_late ? ' (AFTER the deadline of ' + isoDate(d.schedule_due_on) + ')' : ''}. Pay by ${isoDate(d.pay_due_on) || 'the contract date'}. Write the reasons for any shortfall in the schedule itself: /draft-payment-schedule.`);
}

async function pay(args, flags) {
  const p = await findProject(args[0]);
  const cl = await findClaim(p, args[1]);
  await db.query(`update claims set paid_on = $2, approved = coalesce(approved, scheduled, claimed) where id = $1`, [cl.id, parseDate(flags.date) || today()]);
  out({ project: p.code, reference: cl.reference, paid_on: parseDate(flags.date) || today() }, (d) => `  ${d.project} ${d.reference} marked paid ${d.paid_on}.`);
}

async function drawdowns(flags) {
  const params = [];
  let where = '';
  if (flags.project) { const p = await findProject(flags.project); params.push(p.id); where = 'where d.project_id = $1'; }
  const rows = await db.query(`select p.code as project, d.number, d.period_to, d.status, d.amount, d.qs_certified_on, d.submitted_on, d.funded_on,
    (select count(*) from claims c where c.drawdown_id = d.id)::int as items
    from drawdowns d join projects p on p.id = d.project_id ${where} order by p.code, d.number`, params);
  out(rows, (r) => [heading('Drawdowns'), table(r, [{ key: 'project', label: 'Project' }, { key: 'number', label: 'No.', align: 'right' }, { key: 'period_to', label: 'Period to', format: isoDate }, { key: 'status', label: 'Status' }, { key: 'amount', label: 'Amount', align: 'right', format: $ }, { key: 'items', label: 'Items', align: 'right' }, { key: 'qs_certified_on', label: 'QS certified', format: isoDate }, { key: 'funded_on', label: 'Funded', format: isoDate }])].join('\n'));
}

// Builds the next drawdown from approved claims not yet in one. Nothing goes to the lender from here.
async function drawdown(args, flags) {
  const p = await findProject(args[0]);
  let [d] = await db.query(`select * from drawdowns where project_id = $1 and status = 'draft' order by number desc limit 1`, [p.id]);
  if (!d) {
    [d] = await db.query(`insert into drawdowns (project_id, number, period_to) values ($1, (select coalesce(max(number), 0) + 1 from drawdowns where project_id = $1), $2) returning *`, [p.id, parseDate(flags.to) || today()]);
  }
  // Only costs since the last drawdown: anything older was paid from equity or another facility.
  const [{ since }] = await db.query(`select max(period_to) as since from drawdowns where project_id = $1 and status <> 'draft'`, [p.id]);
  const items = await db.query(`update claims set drawdown_id = $2 where project_id = $1 and drawdown_id is null and approved is not null and received_on <= $3
    and ($4::date is null or received_on > $4::date) returning reference, supplier, approved, retention_held`, [p.id, d.id, d.period_to, since]);
  const all = await db.query(`select c.reference, c.supplier, cc.code, coalesce(c.approved, c.scheduled, c.claimed) as amount, c.retention_held, c.paid_on from claims c left join cost_codes cc on cc.id = c.cost_code_id where c.drawdown_id = $1 order by cc.code, c.reference`, [d.id]);
  const total = all.reduce((t, r) => t + n(r.amount) - n(r.retention_held), 0);
  await db.query(`update drawdowns set amount = $2 where id = $1`, [d.id, total]);
  const waiting = await db.query(`select reference, supplier, claimed from claims where project_id = $1 and drawdown_id is null and approved is null and kind = 'payment-claim'`, [p.id]);
  out({ project: p.code, number: d.number, added: items.length, items: all, total, waiting }, (x) => [heading(`${p.code} drawdown ${d.number} (draft, period to ${isoDate(d.period_to)})`),
    table(all, [{ key: 'code', label: 'Code' }, { key: 'reference', label: 'Ref' }, { key: 'supplier', label: 'Supplier' }, { key: 'amount', label: 'Approved', align: 'right', format: $ }, { key: 'retention_held', label: 'Retention', align: 'right', format: $ }]),
    '', `  Total to draw ${$(total)} (approved less retention). ${items.length} added this run.`,
    waiting.length ? `  Not in it, no payment schedule yet: ${waiting.map((w) => `${w.reference} ${w.supplier} ${$(w.claimed)}`).join('; ')}` : '',
    '  The QS certifies, a person submits. /draft-drawdown writes the cover letter.'].filter(Boolean).join('\n'));
}

async function rules() {
  const rows = await db.query(`select * from jurisdiction_rules order by jurisdiction`);
  out(rows, (r) => [heading('Payment claim clocks by jurisdiction'), table(r, [{ key: 'jurisdiction', label: 'Where' }, { key: 'schedule_days', label: 'Schedule (days)', align: 'right' }, { key: 'pay_days', label: 'Pay (days)', align: 'right' }, { key: 'source', label: 'Source', width: 90 }]), '', '  A contract can shorten these. Add a jurisdiction or change one with /customise.'].join('\n'));
}

// ---------------------------------------------------------------- sales

async function lots(args, flags) {
  const params = [];
  const where = [];
  const ref = args[0] || flags.project;
  if (ref) { const p = await findProject(ref); params.push(p.id); where.push(`project_id = $${params.length}`); }
  if (flags.status) { params.push(str(flags.status)); where.push(`status = $${params.length}`); }
  if (flags.unsold) where.push(`status in ('available', 'hold', 'rescinded')`);
  if (flags.sold) where.push(`status in ('exchanged', 'settled')`);
  const rows = await db.query(`select * from lot_book ${where.length ? 'where ' + where.join(' and ') : ''} order by project, lot_no`, params);
  out(rows, (r) => [heading('The lot book'), table(r, [
    { key: 'project', label: 'Project' }, { key: 'lot_no', label: 'Lot' }, { key: 'kind', label: 'Kind' }, { key: 'bedrooms', label: 'Bed', align: 'right' }, { key: 'status', label: 'Status' },
    { key: 'expected_price', label: 'Price', align: 'right', format: $ }, { key: 'buyer', label: 'Buyer', width: 22 }, { key: 'deposit_pct', label: 'Deposit', align: 'right', format: pct },
    { key: 'qualifies', label: 'Counts', format: (v, row) => (row.status === 'exchanged' ? (v ? 'yes' : 'NO') : '') }, { key: 'days_to_sunset', label: 'Sunset in', align: 'right', format: (v, row) => (row.status === 'exchanged' && v !== null ? `${v}d` : '') }]),
    '', '  Price is the contract price where sold and the list price where not. Counts: whether the lender counts it toward the presale covenant.'].join('\n'));
}

async function presales() {
  const rows = await db.query(`select * from presale_position where facility_limit is not null order by project`);
  for (const r of rows) r.gap = Math.max(0, n(r.hurdle) - n(r.qualifying_value));
  out(rows, (r) => [heading('Presales against the lender\'s hurdle'), table(r, [
    { key: 'project', label: 'Project' }, { key: 'lender', label: 'Lender', width: 28 }, { key: 'facility_limit', label: 'Facility', align: 'right', format: $ },
    { key: 'presale_cover_pct', label: 'Cover', align: 'right', format: pct }, { key: 'hurdle', label: 'Hurdle', align: 'right', format: $ },
    { key: 'exchanged_value', label: 'Exchanged', align: 'right', format: $ }, { key: 'qualifying_value', label: 'Qualifying', align: 'right', format: $ },
    { key: 'gap', label: 'Short by', align: 'right', format: (v) => (n(v) ? $(v) : 'met') }, { key: 'unsold', label: 'Unsold lots', align: 'right' }]),
    '', '  Qualifying: exchanged with at least the lender\'s minimum deposit, overseas buyers counted only up to the lender\'s cap.'].join('\n'));
}

async function exchange(args, flags) {
  const p = await findProject(args[0]);
  const l = await findLot(p, args[1]);
  const price = parseMoney(args[2]);
  if (price === null || !flags.buyer) throw new CliError('pd exchange <project> <lot> <price> --buyer="Name" --deposit=10% or amount [--date] [--sunset=YYYY-MM-DD] [--foreign] [--firb=ref] [--disclosure=date] [--gst-notice=date] [--margin-scheme] [--held-by=".."]');
  if (['exchanged', 'settled'].includes(l.status)) throw new CliError(`${p.code} lot ${l.lot_no} is already ${l.status} (${l.buyer}).`);
  const dep = str(flags.deposit).endsWith('%') ? Math.round(price * Number(str(flags.deposit).slice(0, -1))) / 100 : parseMoney(flags.deposit) ?? 0;
  const on = parseDate(flags.date) || today();
  await db.query(`update lots set status = 'exchanged', price = $2, buyer = $3, deposit = $4, exchanged_on = $5, sunset_on = $6, foreign_buyer = $7, firb_ref = $8,
    disclosure_given_on = $9, gst_notice_given_on = $10, margin_scheme_agreed = $11, deposit_held_by = coalesce($12, deposit_held_by), buyer_email = coalesce($13, buyer_email),
    rescinded_on = null, rescind_reason = null, purchaser_consent_on = null, court_order_ref = null, sunset_notice_on = null where id = $1`,
  [l.id, price, str(flags.buyer), dep, on, parseDate(flags.sunset), !!flags.foreign, str(flags.firb) || null, parseDate(flags.disclosure), parseDate(flags['gst-notice']), !!flags['margin-scheme'], str(flags['held-by']) || null, str(flags.email) || null]);
  const [b] = await db.query(`select * from lot_book where lot_id = $1`, [l.id]);
  const [pp] = await db.query(`select * from presale_position where project_id = $1`, [p.id]);
  out({ lot: b, presales: pp }, (d) => `  ${p.code} lot ${l.lot_no} exchanged to ${d.lot.buyer} at ${$(price)}, deposit ${pct(d.lot.deposit_pct)}${d.lot.qualifies ? '' : ' (does NOT count toward the presale covenant)'}. Qualifying presales now ${$(d.presales.qualifying_value)} of ${$(d.presales.hurdle)}. Run pd compliance to check the paperwork.`);
}

async function settle(args, flags) {
  const p = await findProject(args[0]);
  const l = await findLot(p, args[1]);
  if (l.status !== 'exchanged') throw new CliError(`${p.code} lot ${l.lot_no} is ${l.status}, not exchanged.`);
  await db.query(`update lots set status = 'settled', settled_on = $2 where id = $1`, [l.id, parseDate(flags.date) || today()]);
  out({ project: p.code, lot: l.lot_no, settled_on: parseDate(flags.date) || today() }, (d) => `  ${d.project} lot ${d.lot} settled ${d.settled_on}.`);
}

async function rescind(args, flags) {
  const p = await findProject(args[0]);
  const l = await findLot(p, args[1]);
  const reason = str(flags.reason).toLowerCase();
  if (!reason) throw new CliError('pd rescind <project> <lot> --reason=sunset|cooling-off|default|other [--consent=date] [--court-order=ref] [--notice=date served] [--date]');
  if (reason === 'sunset' && !flags.consent && !flags['court-order'])
    throw new CliError(`Rescinding under a sunset clause needs the purchaser's written consent or a court order (NSW Conveyancing Act s66ZS, VIC Sale of Land Act s10B). Record it with --consent=<date> or --court-order=<ref>. Nothing changed.`);
  await db.query(`update lots set status = 'rescinded', rescinded_on = $2, rescind_reason = $3, purchaser_consent_on = $4, court_order_ref = $5, sunset_notice_on = coalesce($6, sunset_notice_on) where id = $1`,
    [l.id, parseDate(flags.date) || today(), reason, parseDate(flags.consent), str(flags['court-order']) || null, parseDate(flags.notice)]);
  out({ project: p.code, lot: l.lot_no, reason }, (d) => `  ${d.project} lot ${d.lot} rescinded (${d.reason}). It now counts as unsold; the deposit refund is for your solicitor.`);
}

async function sunsets(flags) {
  const days = Number(flags.days || 365);
  const rows = await db.query(`select b.project, b.lot_no, b.buyer, b.price, b.sunset_on, b.days_to_sunset, p.completion_forecast_on, p.plan_registered_on,
    (p.plan_registered_on is null and p.completion_forecast_on is not null and b.sunset_on < p.completion_forecast_on) as at_risk
    from lot_book b join projects p on p.id = b.project_id where b.status = 'exchanged' and b.sunset_on is not null and b.days_to_sunset <= $1 order by b.sunset_on, b.project, b.lot_no`, [days]);
  out(rows, (r) => [heading(`Sunset dates in the next ${days} days`), table(r, [
    { key: 'project', label: 'Project' }, { key: 'lot_no', label: 'Lot' }, { key: 'buyer', label: 'Buyer', width: 24 }, { key: 'price', label: 'Price', align: 'right', format: $ },
    { key: 'sunset_on', label: 'Sunset', format: isoDate }, { key: 'days_to_sunset', label: 'Days', align: 'right' }, { key: 'completion_forecast_on', label: 'Completion fcst', format: isoDate },
    { key: 'at_risk', label: 'Risk', format: (v) => (v ? 'SUNSET BEFORE COMPLETION' : '') }]),
    '', '  A sunset date before completion is a contract the buyer can walk from, and the vendor cannot end it without their consent or a court order.'].join('\n'));
}

// ---------------------------------------------------------------- approvals

async function approvals(flags) {
  const params = [];
  let where = '';
  if (flags.project) { const p = await findProject(flags.project); params.push(p.id); where = 'where project_id = $1'; }
  const rows = await db.query(`select * from approval_status ${where} order by project, lodged_on nulls last`, params);
  out(rows, (r) => [heading('Approvals'), table(r, [
    { key: 'project', label: 'Project' }, { key: 'kind', label: 'Kind' }, { key: 'authority', label: 'Authority', width: 26 }, { key: 'reference', label: 'Ref' }, { key: 'status', label: 'Status' },
    { key: 'rfi_due_on', label: 'RFI due', format: isoDate }, { key: 'days_with_authority', label: 'Days in', align: 'right' }, { key: 'lapses_on', label: 'Lapses', format: isoDate },
    { key: 'commenced_on', label: 'Commenced', format: isoDate }, { key: 'open_conditions', label: 'Open conds', align: 'right' }])].join('\n'));
}

async function conditions(flags) {
  const params = [];
  const where = [];
  if (flags.project) { const p = await findProject(flags.project); params.push(p.id); where.push(`a.project_id = $${params.length}`); }
  if (!flags.all) where.push(`c.status = 'open'`);
  const rows = await db.query(`select p.code as project, p.stage, a.reference, c.number, c.gate, c.status, c.description, s.code as owner, c.satisfied_on
    from conditions c join approvals a on a.id = c.approval_id join projects p on p.id = a.project_id left join staff s on s.id = c.owner_id
    ${where.length ? 'where ' + where.join(' and ') : ''} order by p.code, array_position(array['before-construction','during-construction','before-occupation','before-title','ongoing'], c.gate), c.number`, params);
  out(rows, (r) => [heading(flags.all ? 'Conditions of consent' : 'Conditions still open'), table(r, [
    { key: 'project', label: 'Project' }, { key: 'reference', label: 'Consent' }, { key: 'number', label: 'No.' }, { key: 'gate', label: 'Must be met' }, { key: 'description', label: 'Condition', width: 60 }, { key: 'owner', label: 'Owner' }, { key: 'status', label: 'Status' }])].join('\n'));
}

async function satisfy(args, flags) {
  const p = await findProject(args[0]);
  const [c] = await db.query(`select c.* from conditions c join approvals a on a.id = c.approval_id where a.project_id = $1 and lower(a.reference) = lower($2) and lower(c.number) = lower($3)`, [p.id, args[1], args[2]]);
  if (!c) throw new CliError('pd satisfy <project> <consent reference> <condition number> [--date]');
  await db.query(`update conditions set status = 'satisfied', satisfied_on = $2 where id = $1`, [c.id, parseDate(flags.date) || today()]);
  out({ project: p.code, condition: c.number }, (d) => `  ${d.project} condition ${d.condition} satisfied.`);
}

async function approvalUpdate(args, flags) {
  const p = await findProject(args[0]);
  const [a] = await db.query(`select * from approvals where project_id = $1 and lower(reference) = lower($2)`, [p.id, args[1]]);
  if (!a) throw new CliError(`pd approval <project> <reference> [--status] [--rfi-due] [--decided] [--lapses] [--commenced]. No approval "${args[1]}" on ${p.code}.`);
  const sets = { status: str(flags.status) || a.status, rfi_due_on: flags['rfi-due'] ? parseDate(flags['rfi-due']) : a.rfi_due_on, decided_on: flags.decided ? parseDate(flags.decided) : a.decided_on,
    lapses_on: flags.lapses ? parseDate(flags.lapses) : a.lapses_on, commenced_on: flags.commenced ? parseDate(flags.commenced) : a.commenced_on };
  await db.query(`update approvals set status = $2, rfi_due_on = $3, decided_on = $4, lapses_on = $5, commenced_on = $6 where id = $1`, [a.id, sets.status, sets.rfi_due_on, sets.decided_on, sets.lapses_on, sets.commenced_on]);
  out({ project: p.code, reference: a.reference, ...sets }, (d) => `  ${d.project} ${d.reference}: ${d.status}${d.lapses_on ? `, lapses ${isoDate(d.lapses_on)}` : ''}${d.commenced_on ? `, works commenced ${isoDate(d.commenced_on)}` : ''}.`);
}

async function stage(args) {
  const p = await findProject(args[0]);
  const s = str(args[1]).toLowerCase();
  if (!STAGES.includes(s)) throw new CliError(`pd stage <project> ${STAGES.join('|')}`);
  await db.query(`update projects set stage = $2, stage_since = current_date where id = $1`, [p.id, s]);
  out({ project: p.code, stage: s }, (d) => `  ${d.project} moved to ${d.stage}.`);
}

async function log(args, flags) {
  const p = await findProject(args[0]);
  const body = args.slice(1).join(' ').trim();
  if (!body) throw new CliError('What happened? pd log <project> "note text"');
  await db.query(`insert into notes (project_id, body, author) values ($1,$2,$3)`, [p.id, body, str(flags.by) || null]);
  out({ project: p.code, body }, () => `  Noted on ${p.code}.`);
}

async function projectNew(args, flags) {
  const code = str(args[0]).toUpperCase();
  const name = args.slice(1).join(' ').trim();
  const jur = str(flags.where).toUpperCase();
  if (!/^[A-Z0-9-]{2,12}$/.test(code) || !name || !jur) throw new CliError('pd project-new <CODE> "Name" --where=NSW|VIC|QLD|WA|SA|TAS|ACT|NT|NZ --kind=apartments|townhouses|land-subdivision|mixed-use|commercial|industrial [--address] [--manager=JP] [--target=20]');
  await db.query(`insert into projects (code, name, address, jurisdiction, currency, kind, manager_id, target_margin_pct) values ($1,$2,$3,$4,$5,$6,(select id from staff where code = $7),$8)`,
    [code, name, str(flags.address) || null, jur, jur === 'NZ' ? 'NZD' : 'AUD', str(flags.kind) || 'apartments', str(flags.manager).toUpperCase() || null, Number(flags.target || 20)]);
  out({ code, name }, (d) => `  ${d.code} ${d.name} added at feasibility. Next: pd feaso-new ${d.code} "First pass", or import an EstateMaster feasibility.`);
}

// ---------------------------------------------------------------- compliance and attention

// Each rule: an id, the check, the source (in docs/compliance.md), and a query returning one row per breach.
const CHECKS = [
  { id: 'R1', severity: 'breach', check: 'Sunset rescission only with consent or a court order, after 28 days\' notice', source: 'Conveyancing Act 1919 (NSW) s66ZS; Sale of Land Act 1962 (Vic) s10B',
    sql: `select b.project || ' lot ' || b.lot_no || ': rescinded ' || b.rescinded_on || ' under the sunset clause, ' ||
      case when b.purchaser_consent_on is null and b.court_order_ref is null then 'no consent or court order recorded' else 'notice served ' || coalesce((b.rescinded_on - l.sunset_notice_on)::text, 'never') || ' days before' end as detail
      from lot_book b join lots l on l.id = b.lot_id where b.rescind_reason = 'sunset' and b.jurisdiction in ('NSW', 'VIC')
      and ((b.purchaser_consent_on is null and b.court_order_ref is null) or l.sunset_notice_on is null or b.rescinded_on - l.sunset_notice_on < 28)` },
  { id: 'R2', severity: 'risk', check: 'Sunset dates fall before forecast completion', source: 'The contracts; Conveyancing Act 1919 (NSW) s66ZS; Sale of Land Act 1962 (Vic) ss10A-10F',
    sql: `select b.project || ' lot ' || b.lot_no || ' (' || b.buyer || '): sunset ' || b.sunset_on || ', completion forecast ' || p.completion_forecast_on as detail
      from lot_book b join projects p on p.id = b.project_id where b.status = 'exchanged' and p.plan_registered_on is null and p.completion_forecast_on is not null and b.sunset_on < p.completion_forecast_on` },
  { id: 'R3', severity: 'breach', check: 'NSW off the plan: disclosure statement attached before the buyer signed', source: 'Conveyancing Act 1919 (NSW) s66ZM',
    sql: `select project || ' lot ' || lot_no || ' (' || buyer || '): exchanged ' || exchanged_on || ', ' || coalesce('disclosure given ' || disclosure_given_on, 'no disclosure statement recorded') as detail
      from lot_book b join projects p on p.id = b.project_id where b.jurisdiction = 'NSW' and b.status in ('exchanged', 'settled') and b.kind <> 'commercial'
      and (p.plan_registered_on is null or p.plan_registered_on > b.exchanged_on) and (b.disclosure_given_on is null or b.disclosure_given_on > b.exchanged_on)` },
  { id: 'R4', severity: 'breach', check: 'VIC off the plan: deposit no more than 10%, held on trust', source: 'Sale of Land Act 1962 (Vic) s9AA; s9AE',
    sql: `select project || ' lot ' || lot_no || ' (' || buyer || '): deposit ' || deposit_pct || '% of ' || dollars(price) || case when not deposit_in_trust then ', not held on trust' else '' end as detail
      from lot_book b join projects p on p.id = b.project_id where b.jurisdiction = 'VIC' and b.status = 'exchanged' and p.plan_registered_on is null and (b.deposit_pct > 10 or not b.deposit_in_trust)` },
  { id: 'R5', severity: 'breach', check: 'GST at settlement: withholding notice given to the buyer', source: 'Taxation Administration Act 1953 Sch 1 s14-255 (withholding under s14-250)',
    sql: `select project || ' lot ' || lot_no || ' (' || buyer || '): exchanged ' || exchanged_on || ', no withholding notice recorded' as detail
      from lot_book where jurisdiction <> 'NZ' and status in ('exchanged', 'settled') and kind not in ('commercial', 'car-space') and gst_notice_given_on is null` },
  { id: 'R6', severity: 'breach', check: 'Margin scheme agreed in writing with the buyer', source: 'A New Tax System (Goods and Services Tax) Act 1999 s75-5(1A)',
    sql: `select b.project || ' lot ' || b.lot_no || ' (' || b.buyer || '): project uses the margin scheme, no written agreement on the contract' as detail
      from lot_book b join projects p on p.id = b.project_id where p.margin_scheme and b.jurisdiction <> 'NZ' and b.status in ('exchanged', 'settled') and not b.margin_scheme_agreed` },
  { id: 'R7', severity: 'breach', check: 'Overseas buyers of new dwellings have foreign investment approval', source: 'Foreign Acquisitions and Takeovers Act 1975 (Cth)',
    sql: `select b.project || ' lot ' || b.lot_no || ' (' || b.buyer || '): overseas buyer, no FIRB approval and no exemption certificate on the project' as detail
      from lot_book b join projects p on p.id = b.project_id where b.jurisdiction <> 'NZ' and b.foreign_buyer and b.status in ('exchanged', 'settled') and b.firb_ref is null and p.firb_exemption_ref is null` },
  { id: 'R8', severity: 'breach', check: 'Payment schedule given in time for every payment claim', source: 'Security of Payment Act 1999 (NSW) s14(4); Construction Contracts Act 2002 (NZ) ss21-22',
    sql: `select project || ' ' || reference || ' from ' || supplier || ': ' || dollars(claimed) || ' claimed ' || received_on || ', schedule due ' || schedule_due_on ||
      case when schedule_missed then ', none given: the full claim is now payable' else ', given late on ' || schedule_given_on end as detail
      from claim_clock where schedule_missed or schedule_late` },
  { id: 'R9', severity: 'breach', check: 'Payment claims paid by the due date', source: 'Security of Payment Act 1999 (NSW) s11(1A); Construction Contracts Act 2002 (NZ) s18',
    sql: `select project || ' ' || reference || ' from ' || supplier || ': due ' || pay_due_on || ', unpaid' as detail from claim_clock where payment_overdue` },
  { id: 'R10', severity: 'breach', check: 'NZ retention money held on trust in a separate account', source: 'Construction Contracts Act 2002 (NZ) ss18C-18D',
    sql: `select p.code || ': ' || dollars(sum(c.retention_held)) || ' retention held from ' || string_agg(distinct c.supplier, ', ') || ', no trust account recorded' as detail
      from claims c join projects p on p.id = c.project_id where p.jurisdiction = 'NZ' and p.retention_trust_account is null and c.retention_held > 0 group by p.code` },
  { id: 'R11', severity: 'risk', check: 'Approvals about to lapse with no works started', source: 'Environmental Planning and Assessment Act 1979 (NSW) s4.53; Resource Management Act 1991 (NZ) s125; Planning and Environment Act 1987 (Vic) s68',
    sql: `select project || ' ' || reference || ' (' || kind || '): lapses ' || lapses_on || ', ' || days_to_lapse || ' days, no works commenced' as detail
      from approval_status where status = 'approved' and commenced_on is null and lapses_on is not null and days_to_lapse <= ${LAPSE_WARN_DAYS}` },
  { id: 'R12', severity: 'breach', check: 'Conditions met before the stage they gate', source: 'The conditions of each consent',
    sql: `select p.code || ' ' || a.reference || ' condition ' || c.number || ': ' || c.description || ' (must be met ' || replace(c.gate, '-', ' ') || ', project is in ' || p.stage || ')' as detail
      from conditions c join approvals a on a.id = c.approval_id join projects p on p.id = a.project_id where c.status = 'open'
      and ((c.gate = 'before-construction' and p.stage in ('construction', 'completion', 'settled')) or (c.gate = 'before-occupation' and p.stage in ('settled')))` },
  { id: 'R13', severity: 'breach', check: 'Presale covenant met once construction is funded', source: 'The facility agreement with the lender',
    sql: `select pp.project || ': qualifying presales ' || dollars(pp.qualifying_value) || ' against a hurdle of ' || dollars(pp.hurdle) as detail
      from presale_position pp join projects p on p.id = pp.project_id where p.stage in ('construction', 'completion') and pp.hurdle is not null and pp.qualifying_value < pp.hurdle` },
];

async function runChecks() {
  const res = [];
  for (const c of CHECKS) res.push({ ...c, rows: await db.query(c.sql) });
  return res;
}

async function compliance() {
  const res = await runChecks();
  const rows = res.map((r) => ({ id: r.id, severity: r.severity, check: r.check, count: r.rows.length, worst: r.rows[0]?.detail || 'clean', source: r.source, all: r.rows.map((x) => x.detail) }));
  out(rows, (r) => [heading('Compliance: the records against the rules in docs/compliance.md'), table(r, [
    { key: 'id', label: 'Rule' }, { key: 'severity', label: 'Kind' }, { key: 'check', label: 'Check', width: 62 }, { key: 'count', label: 'Found', align: 'right' }, { key: 'worst', label: 'First example', width: 90 }]),
    '', '  A records check, not legal advice. Your solicitor, certifier and lender make the calls. Sources are in docs/compliance.md.'].join('\n'));
}

async function attention() {
  const items = [];
  const add = (area, project, what, action) => items.push({ area, project, what, action });
  const ACTIONS = {
    R1: 'Stop: get the purchaser\'s written consent or a court order with your solicitor', R2: 'Press the builder on the programme; your solicitor on extensions',
    R3: 'Your solicitor: what the buyer can do and how to fix it', R4: 'Your solicitor: refund the excess or put it on trust', R5: 'Send the withholding notice before settlement',
    R6: 'Agree the margin scheme in writing before settlement, or ask the ATO for more time', R7: 'Get the FIRB approval number from the buyer\'s solicitor',
    R8: 'The full claim is payable: pay it, or dispute with your solicitor', R9: 'Pay it today', R10: 'Open the retention trust account and record it',
    R11: 'Start works before the lapse date or apply to extend', R12: 'Get the condition signed off this week', R13: 'Talk to the lender before the next drawdown',
  };
  for (const c of await runChecks()) {
    const byProject = {};
    for (const r of c.rows) (byProject[r.detail.split(/[ :]/)[0]] ||= []).push(r.detail);
    for (const [project, rows] of Object.entries(byProject)) {
      const what = rows.length > 3 ? `${c.id} ${rows.length} items, e.g. ${rows[0]}` : null;
      if (what) add(c.severity === 'breach' ? 'Compliance' : 'Risk', project, what, ACTIONS[c.id]);
      else for (const d of rows) add(c.severity === 'breach' ? 'Compliance' : 'Risk', project, `${c.id} ${d}`, ACTIONS[c.id]);
    }
  }
  for (const r of await db.query(`select project, reference, supplier, claimed, schedule_due_on from claim_clock where kind = 'payment-claim' and schedule_given_on is null and not schedule_missed and schedule_due_on <= $1::date`, [addDays(today(), SCHEDULE_WARN_DAYS + 2)]))
    add('Claims', r.project, `${r.reference} ${r.supplier} ${$(r.claimed)}: payment schedule due ${isoDate(r.schedule_due_on)}`, 'Assess with the QS and give the schedule (/draft-payment-schedule)');
  for (const r of await db.query(`select cp.project, cp.number, v.number as v, v.description, v.amount, current_date - v.raised_on as days from variations v join contract_position cp on cp.contract_id = v.contract_id where v.status = 'pending' and current_date - v.raised_on >= $1 order by v.raised_on`, [VARIATION_STALE_DAYS]))
    add('Costs', r.project, `${r.number} ${r.v} ${$(r.amount)} "${truncate(r.description, 50)}" waiting ${r.days} days`, 'Approve, reject or negotiate');
  for (const r of await db.query(`select project, code, description, overrun from cost_position where overrun > 0 order by overrun desc`))
    add('Costs', r.project, `${r.code} ${r.description} forecast ${$(r.overrun)} over budget`, 'Draw on contingency or re-forecast the feasibility');
  for (const r of await db.query(`select project, forecast_margin_pct, target_margin_pct from project_position where forecast_margin_pct < target_margin_pct and stage not in ('settled', 'abandoned')`))
    add('Margin', r.project, `forecast margin ${pct(r.forecast_margin_pct)} against a ${pct(r.target_margin_pct)} target`, 'Review the feasibility with the director');
  for (const r of await db.query(`select t.project, t.version, t.label, t.margin_on_cost_pct, t.target_margin_pct from feasibility_totals t where t.status = 'draft' and t.margin_on_cost_pct < t.target_margin_pct`))
    add('Margin', r.project, `draft v${r.version} "${r.label}" shows ${pct(r.margin_on_cost_pct)} on cost, under the ${pct(r.target_margin_pct)} target`, 'Decide before it is approved (/compare)');
  for (const r of await db.query(`select pp.project, pp.qualifying_value, pp.hurdle, pp.unsold from presale_position pp join projects p on p.id = pp.project_id where p.stage in ('presales', 'approvals') and pp.hurdle is not null and pp.qualifying_value < pp.hurdle`))
    add('Sales', r.project, `presales ${$(r.qualifying_value)} of a ${$(r.hurdle)} hurdle, short ${$(n(r.hurdle) - n(r.qualifying_value))}; ${r.unsold} lots unsold`, 'Push the unsold lots or talk to the lender');
  for (const r of await db.query(`select project, lot_no, buyer, deposit_pct from lot_book where status = 'exchanged' and not qualifies`))
    add('Sales', r.project, `lot ${r.lot_no} (${r.buyer}) on a ${pct(r.deposit_pct)} deposit does not count toward the presale covenant`, 'Ask for a deposit top-up or a bond');
  for (const r of await db.query(`select project, lot_no, buyer from lot_book where status = 'hold' and (select current_date - updated_at::date from lots where id = lot_id) >= $1`, [HOLD_STALE_DAYS]))
    add('Sales', r.project, `lot ${r.lot_no} on hold for ${r.buyer || 'nobody'} for ${HOLD_STALE_DAYS}+ days`, 'Exchange or release it');
  for (const r of await db.query(`select project, reference, rfi_due_on from approval_status where status = 'rfi' and rfi_due_on < current_date`))
    add('Approvals', r.project, `${r.reference}: council's information request was due ${isoDate(r.rfi_due_on)}`, 'Send the response or ask council for more time');
  for (const r of await db.query(`select b.project, b.lot_no, b.buyer, b.sunset_on, b.days_to_sunset from lot_book b join projects p on p.id = b.project_id where b.status = 'exchanged' and b.days_to_sunset between 0 and $1
    and not (p.plan_registered_on is null and p.completion_forecast_on is not null and b.sunset_on < p.completion_forecast_on) order by b.sunset_on`, [SUNSET_WARN_DAYS]))
    add('Sunset', r.project, `lot ${r.lot_no} (${r.buyer}) sunset ${isoDate(r.sunset_on)}, ${r.days_to_sunset} days`, 'Check the programme against it');
  for (const r of await db.query(`select p.code as project, d.number from drawdowns d join projects p on p.id = d.project_id where d.status = 'draft'`))
    add('Finance', r.project, `drawdown ${r.number} still a draft`, 'Build it with pd drawdown and get the QS certificate');
  for (const r of await db.query(`select code as project, facility_expires_on, facility_expires_on - current_date as days from projects where facility_expires_on is not null and completion_forecast_on > facility_expires_on - 60`))
    add('Finance', r.project, `facility expires ${isoDate(r.facility_expires_on)} (${r.days} days), within 60 days of forecast completion`, 'Start the extension conversation with the lender');
  const order = ['Compliance', 'Claims', 'Risk', 'Approvals', 'Finance', 'Costs', 'Margin', 'Sales', 'Sunset'];
  items.sort((a, b) => order.indexOf(a.area) - order.indexOf(b.area));
  out(items, (r) => [heading(`Needs attention: ${r.length} items, worst first`), table(r, [{ key: 'area', label: 'Area' }, { key: 'project', label: 'Project' }, { key: 'what', label: 'What', width: 100 }, { key: 'action', label: 'Do' , width: 60 }])].join('\n'));
}

// ---------------------------------------------------------------- import and export

// EstateMaster DF and DM print their reports to Excel. Save the sheet as CSV and bring it in.
// Column names vary by template and version, so each import accepts the common names and says
// what it could not read. Nothing is saved on --dry-run.
async function importCmd(args, flags) {
  const [source, kind, file] = args;
  if (source !== 'estatemaster' || !['feasibility', 'budget', 'sales'].includes(kind) || !file)
    throw new CliError('pd import estatemaster <feasibility|budget|sales> <file.csv> --project=CODE [--version=N for feasibility] [--dry-run]');
  const p = await findProject(flags.project);
  const rows = parseCsv(readFileSync(path.resolve(process.cwd(), file), 'utf8'));
  const dry = !!flags['dry-run'];
  const skipped = [];
  let saved = 0;
  if (!dry) await db.exec('BEGIN');
  try {
    if (kind === 'feasibility') {
      let f;
      if (!dry) {
        const label = str(flags.label) || `Imported from EstateMaster ${path.basename(file)}`;
        const existing = flags.version ? await db.query(`select * from feasibilities where project_id = $1 and version = $2`, [p.id, Number(flags.version)]) : [];
        f = existing[0] || (await db.query(`insert into feasibilities (project_id, version, label) values ($1, (select coalesce(max(version), 0) + 1 from feasibilities where project_id = $1), $2) returning *`, [p.id, label]))[0];
        if (f.status !== 'draft') throw new CliError(`v${f.version} is ${f.status}; import into a new version instead.`);
      }
      for (const [i, r] of rows.entries()) {
        const desc = pick(r, 'Description', 'Item', 'Line Item', 'Name');
        const amount = parseMoney(pick(r, 'Amount', 'Total', 'Total (ex GST)', 'Amount (ex GST)', 'Value'));
        const cat = mapCategory(pick(r, 'Category', 'Section', 'Group', 'Cost Category', 'Type'), desc);
        if (!desc || amount === null || !cat) { skipped.push(`row ${i + 2}: ${desc || '(no description)'}`); continue; }
        const start = Number(pick(r, 'Start', 'Start Month', 'Month') || 1) || 1;
        const span = Number(pick(r, 'Span', 'Months', 'Duration', 'Span Months') || 1) || 1;
        if (!dry) await db.query(`insert into feasibility_lines (feasibility_id, side, category, description, amount, start_month, span_months) values ($1,$2,$3,$4,$5,$6,$7)
          on conflict (feasibility_id, side, description) do update set amount = excluded.amount, category = excluded.category, start_month = excluded.start_month, span_months = excluded.span_months`,
        [f.id, cat.side, cat.category, desc, Math.abs(amount), start, span]);
        saved++;
      }
      if (f) flags.version = f.version;
    } else if (kind === 'budget') {
      for (const [i, r] of rows.entries()) {
        const code = pick(r, 'Code', 'Cost Code', 'Account');
        const desc = pick(r, 'Description', 'Item', 'Name');
        const budgetAmt = parseMoney(pick(r, 'Budget', 'Current Budget', 'Approved Budget', 'Amount'));
        if (!code || budgetAmt === null) { skipped.push(`row ${i + 2}: ${code || desc || '(blank)'}`); continue; }
        const cat = mapCategory(pick(r, 'Category', 'Section', 'Group'), desc);
        if (!dry) await db.query(`insert into cost_codes (project_id, code, category, description, budget) values ($1,$2,$3,$4,$5) on conflict (project_id, code) do update set budget = excluded.budget, description = excluded.description`,
          [p.id, code, cat?.category || 'other', desc || `Code ${code}`, budgetAmt]);
        saved++;
      }
    } else {
      for (const [i, r] of rows.entries()) {
        const lotNo = pick(r, 'Lot', 'Lot No', 'Unit', 'Unit No', 'Lot Number');
        if (!lotNo) { skipped.push(`row ${i + 2}: no lot number`); continue; }
        const list = parseMoney(pick(r, 'List Price', 'Asking Price', 'Price List', 'Gross Price'));
        const price = parseMoney(pick(r, 'Sale Price', 'Contract Price', 'Sold Price'));
        const statusRaw = pick(r, 'Status', 'Sale Status').toLowerCase();
        const status = /settled/.test(statusRaw) ? 'settled' : /exchang|sold|contract|unconditional/.test(statusRaw) ? 'exchanged' : /hold|reserved|eoi/.test(statusRaw) ? 'hold' : /rescind|cancel/.test(statusRaw) ? 'rescinded' : 'available';
        const depRaw = pick(r, 'Deposit', 'Deposit Paid');
        const deposit = depRaw.endsWith('%') && price ? Math.round(price * Number(depRaw.slice(0, -1))) / 100 : parseMoney(depRaw);
        if (!dry) await db.query(`insert into lots (project_id, lot_no, kind, bedrooms, list_price, status, price, buyer, exchanged_on, deposit, sunset_on, foreign_buyer)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          on conflict (project_id, lot_no) do update set list_price = coalesce(excluded.list_price, lots.list_price), status = excluded.status, price = coalesce(excluded.price, lots.price),
            buyer = coalesce(excluded.buyer, lots.buyer), exchanged_on = coalesce(excluded.exchanged_on, lots.exchanged_on), deposit = coalesce(excluded.deposit, lots.deposit), sunset_on = coalesce(excluded.sunset_on, lots.sunset_on)`,
        [p.id, lotNo, mapLotKind(pick(r, 'Type', 'Product', 'Kind')), Number(pick(r, 'Beds', 'Bedrooms')) || null, list, status, price, pick(r, 'Purchaser', 'Buyer') || null,
          parseDate(pick(r, 'Exchange Date', 'Exchanged', 'Contract Date')), deposit, parseDate(pick(r, 'Sunset Date', 'Sunset')), yesNo(pick(r, 'Foreign Buyer', 'FIRB', 'Overseas'))]);
        saved++;
      }
    }
    if (!dry) await db.exec('COMMIT');
  } catch (e) {
    if (!dry) await db.exec('ROLLBACK');
    throw e;
  }
  out({ project: p.code, kind, file, rows: rows.length, saved: dry ? 0 : saved, would_save: saved, skipped, dry_run: dry, version: flags.version || null }, (d) => [
    `  ${d.dry_run ? 'Dry run: would import' : 'Imported'} ${d.would_save} of ${d.rows} ${kind} rows into ${d.project}${d.version ? ` feasibility v${d.version}` : ''}.`,
    d.skipped.length ? `  Could not read ${d.skipped.length}: ${d.skipped.slice(0, 8).join('; ')}${d.skipped.length > 8 ? ' ...' : ''}` : '',
    d.dry_run ? '' : '  Put the totals next to the same EstateMaster report before you rely on them.'].filter(Boolean).join('\n'));
}

function mapCategory(raw, desc) {
  const s = `${raw} ${desc}`.toLowerCase();
  if (/revenue|sales|sale proceeds|gross realisation/.test(s) && !/commission|selling cost|agent/.test(s)) return { side: 'revenue', category: 'sales' };
  if (/rent|lease income/.test(s)) return { side: 'revenue', category: 'rent' };
  if (/other income|interest income/.test(s)) return { side: 'revenue', category: 'other-income' };
  if (/stamp duty|transfer duty|acquisition|land legal/.test(s)) return { side: 'cost', category: 'acquisition' };
  if (/rates|land tax|holding|insurance/.test(s)) return { side: 'cost', category: 'holding' };
  if (/\bland\b|site purchase|purchase price/.test(s)) return { side: 'cost', category: 'land' };
  if (/consultant|professional|architect|engineer|design|planner|surveyor|\bqs\b/.test(s)) return { side: 'cost', category: 'professional-fees' };
  if (/statutory|council|contribution|levy|da fee|permit|authorit/.test(s)) return { side: 'cost', category: 'statutory' };
  if (/contingenc/.test(s)) return { side: 'cost', category: 'contingency' };
  if (/construct|build|civil|works/.test(s)) return { side: 'cost', category: 'construction' };
  if (/marketing|advertis|display/.test(s)) return { side: 'cost', category: 'marketing' };
  if (/commission|selling|agent/.test(s)) return { side: 'cost', category: 'selling' };
  if (/interest|finance|loan|facility|establishment fee|line fee/.test(s)) return { side: 'cost', category: 'finance' };
  if (raw || desc) return { side: 'cost', category: 'other' };
  return null;
}

function mapLotKind(raw) {
  const s = String(raw || '').toLowerCase();
  if (/town/.test(s)) return 'townhouse';
  if (/house|dwelling/.test(s)) return 'house';
  if (/land|lot|section/.test(s)) return 'land';
  if (/retail|commercial|office/.test(s)) return 'commercial';
  if (/car/.test(s)) return 'car-space';
  return 'apartment';
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCmd(flags) {
  const dir = path.resolve(REPO_ROOT, str(flags.out) || 'exports');
  mkdirSync(dir, { recursive: true });
  const tables = ['staff', 'projects', 'feasibilities', 'feasibility_lines', 'cost_codes', 'contracts', 'variations', 'drawdowns', 'claims', 'jurisdiction_rules', 'lots', 'approvals', 'conditions', 'notes'];
  const counts = {};
  for (const t of tables) {
    const rows = await db.query(`select * from ${t} order by created_at`);
    const cols = rows.length ? Object.keys(rows[0]) : [];
    writeFileSync(path.join(dir, `${t}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n');
    counts[t] = rows.length;
  }
  out({ dir, counts }, () => `  Exported ${tables.length} tables to ${path.relative(REPO_ROOT, dir) || dir}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
}

// ---------------------------------------------------------------- dispatch table

const HELP = `pd: the property development CLI. Add --json to any read for machine output.

  Overview      stats | attention | compliance | projects | project <p> | staff | rules
                project-new <CODE> "name" --where=NSW|VIC|QLD|..|NZ --kind [--manager] [--target] | stage <p> <stage> | log <p> "note" [--by]
  Feasibility   feasos [<p>] | feaso <p> [--version] | compare <p> [vA vB] | sensitivity <p> [--version] | residual <p> [--margin] [--version]
                feaso-new <p> "label" [--from=version] | line <p> revenue|cost <category> "description" <amount> [--start] [--span] [--version] | approve-feaso <p> <version>
  Costs         costs <p> | contracts [--project] | contract-new <p> <NO> "supplier" --value --code [--retention] | budget <p> <code> <amount> ["desc"]
                variation <p> <contract> <amount> "description" | decide <p> <contract> <V01> approve|reject [--amount]
  Claims        claims [--project] [--all] | claim <p> "supplier" <REF> <amount> --code [--contract] [--payment-claim] [--date]
                schedule <p> <REF> <amount> [--date] [--retention] | pay <p> <REF> [--date] | drawdowns [--project] | drawdown <p> [--to=date]
  Sales         lots [<p>] [--status] [--sold] [--unsold] | presales | sunsets [--days=365]
                exchange <p> <lot> <price> --buyer --deposit=10% [--date] [--sunset] [--foreign] [--firb] [--disclosure] [--gst-notice] [--margin-scheme]
                settle <p> <lot> [--date] | rescind <p> <lot> --reason [--consent] [--court-order] [--notice]
  Approvals     approvals [--project] | approval <p> <ref> [--status] [--rfi-due] [--decided] [--lapses] [--commenced]
                conditions [--project] [--all] | satisfy <p> <consent ref> <condition no> [--date]
  Data          import estatemaster <feasibility|budget|sales> <file.csv> --project [--version] [--dry-run] | export [--out=dir]`;

const COMMANDS = {
  stats: () => stats(), attention: () => attention(), compliance: () => compliance(), projects: () => projects(), project: (a) => projectCard(a), staff: () => staff(), rules: () => rules(),
  'project-new': (a, f) => projectNew(a, f), stage: (a) => stage(a), log: (a, f) => log(a, f),
  feasos: (a) => feasos(a), feaso: (a, f) => feaso(a, f), compare: (a) => compare(a), sensitivity: (a, f) => sensitivity(a, f), residual: (a, f) => residual(a, f),
  'feaso-new': (a, f) => feasoNew(a, f), line: (a, f) => line(a, f), 'approve-feaso': (a) => approveFeaso(a),
  costs: (a) => costs(a), contracts: (a, f) => contracts(f), 'contract-new': (a, f) => contractNew(a, f), budget: (a) => budget(a), variation: (a, f) => variation(a, f), decide: (a, f) => decide(a, f),
  claims: (a, f) => claims(f), claim: (a, f) => claimNew(a, f), schedule: (a, f) => schedule(a, f), pay: (a, f) => pay(a, f), drawdowns: (a, f) => drawdowns(f), drawdown: (a, f) => drawdown(a, f),
  lots: (a, f) => lots(a, f), presales: () => presales(), sunsets: (a, f) => sunsets(f), exchange: (a, f) => exchange(a, f), settle: (a, f) => settle(a, f), rescind: (a, f) => rescind(a, f),
  approvals: (a, f) => approvals(f), approval: (a, f) => approvalUpdate(a, f), conditions: (a, f) => conditions(f), satisfy: (a, f) => satisfy(a, f),
  import: (a, f) => importCmd(a, f), export: (a, f) => exportCmd(f),
};

const { args, flags } = parseArgv(process.argv.slice(2));
JSON_OUT = !!flags.json;
const cmd = args.shift();
if (!cmd || cmd === 'help' || flags.help || !COMMANDS[cmd]) {
  console.log(HELP);
  process.exit(cmd && cmd !== 'help' && !COMMANDS[cmd] ? 1 : 0);
}
db = await getDb();
try {
  await COMMANDS[cmd](args, flags);
} catch (e) {
  if (e instanceof CliError) { console.error(e.message); process.exitCode = e.code; }
  else { console.error(e.stack || e.message); process.exitCode = 2; }
} finally {
  await db.close();
}
