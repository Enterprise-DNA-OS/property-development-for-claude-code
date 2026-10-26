#!/usr/bin/env node
// End-to-end smoke test on a throwaway embedded database: migrate, seed, then every command
// that matters, asserting on the JSON. Passes on Windows and Linux. No network, no Postgres install.
// TEST_DATABASE_URL runs the same test against a real Postgres (CI does this).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'pd-smoke-'));
const exportDir = path.join(dataDir, 'export');
const env = { ...process.env, DATA_DIR: dataDir };
delete env.DATABASE_URL;
if (process.env.TEST_DATABASE_URL) env.DATABASE_URL = process.env.TEST_DATABASE_URL;

let step = 0;
function run(label, args, { json = true, expectFail = false } = {}) {
  step++;
  const argv = [path.join(root, 'scripts', args[0]), ...args.slice(1), ...(json ? ['--json'] : [])];
  const res = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8' });
  const ok = expectFail ? res.status !== 0 : res.status === 0;
  if (!ok) {
    console.error(`\nFAIL step ${step} (${label}): exit ${res.status}\n--- stdout\n${res.stdout}\n--- stderr\n${String(res.stderr).split('\n').filter((l) => !l.startsWith('import{')).join('\n').slice(0, 4000)}`);
    process.exit(1);
  }
  console.log(`  ok  ${String(step).padStart(2)}  ${label}`);
  if (!json || expectFail) return { stdout: res.stdout, stderr: res.stderr };
  try { return JSON.parse(res.stdout); } catch {
    console.error(`\nFAIL step ${step} (${label}): output is not JSON\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
}
function assert(cond, msg) { if (!cond) { console.error(`\nFAIL assertion: ${msg}`); process.exit(1); } }
const n = (v) => Number(v ?? 0);
const P = (...a) => ['pd.mjs', ...a];
const rule = (rows, id) => rows.find((r) => r.id === id);

console.log(`smoke: ${env.DATABASE_URL ? 'Postgres' : 'embedded database in ' + dataDir}`);
try {
  run('migrate', ['migrate.mjs'], { json: false });
  run('migrate again (idempotent)', ['migrate.mjs'], { json: false });
  run('seed', ['seed.mjs'], { json: false });
  run('seed again (idempotent)', ['seed.mjs'], { json: false });

  // ---- the overview
  const stats = run('stats', P('stats'));
  assert(stats.live_projects === 4 && stats.lots === 42 && stats.sold === 24 && stats.unsold === 18, `four projects, 42 lots, 24 sold (${JSON.stringify(stats)})`);
  assert(stats.pending_variations === 3 && stats.open_claims === 4, `three pending variations, four unpaid claims (${JSON.stringify(stats)})`);
  const projects = run('projects', P('projects'));
  const park = projects.find((p) => p.project === 'PARK');
  assert(n(park.feaso_margin_pct) === 20.3 && n(park.forecast_margin_pct) < n(park.target_margin_pct) && n(park.cost_overrun) === 337000, 'PARK: 20.3% approved, forecast under target, $337,000 over on construction');
  const card = run('project by name', P('project', 'parkside'));
  assert(card.project.code === 'PARK' && card.approvals.length === 3 && card.costs.length === 9, 'fuzzy project lookup and the project card');
  run('ambiguous project lists and exits 1', P('project', 'Road'), { json: false, expectFail: true });

  // ---- the feasibility
  const fs = run('feasos', P('feasos'));
  assert(fs.length === 7 && fs.every((f) => f.irr_pct !== null), 'seven versions, each with an IRR');
  const f = run('feaso', P('feaso', 'PARK'));
  assert(f.version === 2 && f.profit === 2986400 && f.margin_on_cost_pct === 20.3 && f.residual_land_value > 4100000, 'PARK v2: profit, margin, residual land value');
  assert(f.peak_funding > 0 && f.peak_month > 0 && f.irr_pct > 0, 'peak funding and IRR from the monthly cash flow');
  const cmp = run('compare', P('compare', 'RYDE'));
  assert(cmp.from === 1 && cmp.to === 2 && cmp.to_metrics.profit - cmp.from_metrics.profit === -3665400, 'RYDE: the setback costs $3,665,400 of profit');
  assert(cmp.rows[0].side === 'revenue' && cmp.rows[0].change === -6480000, 'revenue change listed first');
  const sens = run('sensitivity', P('sensitivity', 'ELM', '--version=2'));
  const base = sens.grid.find((r) => r.revenue_change === 0);
  assert(base.build_0 === 11.8 && base.build_10 < base.build_0 && sens.grid.find((r) => r.revenue_change === -10).build_0 < base.build_0, 'sensitivity moves the right way');
  const res = run('residual', P('residual', 'RYDE', '--margin=20'));
  assert(res.rows.length === 1 && res.rows[0].residual_land_value === 11672000, 'RYDE residual land value at 20%');
  const nv = run('feaso-new copies the approved version', P('feaso-new', 'PARK', 'Facade variation priced', '--by=JP'));
  assert(nv.version === 3 && nv.copied === 11, 'v3 drafted with 11 lines');
  const ln = run('line changes a draft', P('line', 'PARK', 'cost', 'construction', 'Construction (Coastline tender)', '7,937,000', '--version=3'));
  assert(ln.profit === 2986400 - 337000, 'v3 profit falls by the overrun');
  run('line refuses an approved version', P('line', 'PARK', 'cost', 'construction', 'Construction (Coastline tender)', '1', '--version=2'), { json: false, expectFail: true });
  run('line refuses a bad category', P('line', 'PARK', 'cost', 'snacks', 'Biscuits', '100', '--version=3'), { json: false, expectFail: true });

  // ---- costs, contracts, variations
  const costs = run('costs', P('costs', 'PARK'));
  const c500 = costs.rows.find((r) => r.code === '500');
  assert(n(c500.committed) === 7639000 && n(c500.pending_variations) === 298000 && n(c500.forecast_final) === 7937000, 'construction: committed, pending and forecast');
  const contracts = run('contracts', P('contracts', '--project=PARK'));
  assert(n(contracts.find((c) => c.number === 'HC-01').retention_held) === 176100, 'retention held on HC-01');
  const v = run('variation', P('variation', 'PARK', 'HC-01', '24,500', 'Extra waterproofing to planters'));
  assert(v.number === 'V06' && n(v.cost_code_overrun) === 337000 + 24500, 'a new variation moves the forecast');
  const d = run('decide', P('decide', 'PARK', 'HC-01', 'V03', 'approve', '--amount=180000'));
  assert(d.status === 'approved' && d.amount === 180000, 'V03 approved at the negotiated figure');
  run('decide rejects nonsense', P('decide', 'PARK', 'HC-01', 'V03', 'maybe'), { json: false, expectFail: true });

  // ---- claims and the statutory clocks
  const claims = run('claims', P('claims'));
  const pc07 = claims.find((c) => c.reference === 'PC-07');
  assert(pc07.schedule_missed === true && pc07.flag === 'SCHEDULE MISSED', 'PC-07 past the NSW 10 business day schedule deadline');
  const pc10 = claims.find((c) => c.reference === 'PC-10');
  assert(pc10.schedule_missed === false && pc10.schedule_due_on, 'PC-10 inside the NZ 20 working day window');
  const nc = run('claim', P('claim', 'PARK', 'Coastline Constructions Pty Ltd', 'PC-08', '640000', '--code=500', '--contract=HC-01', '--payment-claim'));
  assert(nc.kind === 'payment-claim' && nc.schedule_due_on && nc.pay_due_on > nc.schedule_due_on, 'new payment claim gets both clocks');
  const sc = run('schedule', P('schedule', 'PARK', 'PC-08', '600000', '--retention=30000'));
  assert(n(sc.scheduled) === 600000 && sc.schedule_late === false, 'schedule given in time');
  run('pay', P('pay', 'PARK', 'PC-08'));
  const dd = run('drawdown', P('drawdown', 'PARK'));
  assert(dd.number === 7 && dd.items.some((i) => i.reference === 'PC-08') && dd.waiting.some((w) => w.reference === 'PC-07'), 'drawdown 7 takes PC-08 and lists PC-07 as waiting');
  assert(!dd.items.some((i) => i.reference === 'LAND-PARK'), 'drawdown leaves out costs from before the last drawdown');
  const dds = run('drawdowns', P('drawdowns'));
  assert(dds.length === 5, 'five drawdowns');
  const rl = run('rules', P('rules'));
  assert(rl.length === 2 && rl.find((r) => r.jurisdiction === 'NSW').schedule_days === 10, 'NSW and NZ clocks');

  // ---- sales
  const pre = run('presales', P('presales'));
  const parkPre = pre.find((r) => r.project === 'PARK');
  assert(n(parkPre.qualifying_raw) === 11300000 && n(parkPre.qualifying_value) === 10962500 && parkPre.gap === 0, 'PARK: overseas presales capped at 20%, covenant met');
  assert(pre.find((r) => r.project === 'ELM').gap === 840000, 'ELM short $840,000');
  const lots = run('lots unsold', P('lots', 'PARK', '--unsold'));
  assert(lots.length === 5 && lots.some((l) => l.lot_no === 'G02'), 'five unsold on PARK including the rescinded G02');
  const ex = run('exchange', P('exchange', 'ELM', 'T5', '1,260,000', '--buyer=H. Webb', '--deposit=10%', '--sunset=2028-06-30', '--gst-notice=today'));
  assert(ex.lot.qualifies === true && n(ex.presales.qualifying_value) === 5060000, 'T5 exchanged and counts');
  run('exchange refuses a sold lot', P('exchange', 'ELM', 'T5', '1', '--buyer=X'), { json: false, expectFail: true });
  run('rescind under sunset without consent is refused', P('rescind', 'PARK', '105', '--reason=sunset'), { json: false, expectFail: true });
  run('settle', P('settle', 'KAURI', 'L1'));
  const sun = run('sunsets', P('sunsets', '--days=120'));
  assert(sun.length === 11 && sun.every((s) => s.at_risk), 'eleven PARK sunsets before forecast completion');

  // ---- approvals
  const ap = run('approvals', P('approvals'));
  assert(ap.find((a) => a.reference === 'LDA2026/0088').status === 'rfi', 'RYDE in RFI');
  const cond = run('conditions', P('conditions', '--project=PARK'));
  assert(cond.length === 5, 'five open conditions on PARK');
  run('satisfy', P('satisfy', 'PARK', 'DA2023/0412', 'C58'));
  run('approval update', P('approval', 'ELM', 'PLN22/0381', '--commenced=today'));

  // ---- compliance after the fixes above
  const comp = run('compliance', P('compliance'));
  assert(comp.length === 13, 'thirteen rules');
  for (const id of ['R1', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R10', 'R13']) assert(rule(comp, id).count === 1, `${id} finds the planted breach (${JSON.stringify(rule(comp, id))})`);
  assert(rule(comp, 'R2').count === 11, 'R2 eleven sunset risks');
  assert(rule(comp, 'R11').count === 0 && rule(comp, 'R12').count === 0, 'R11 and R12 clear once works started and C58 satisfied');
  assert(rule(comp, 'R9').count === 0, 'nothing overdue for payment yet');
  const att = run('attention', P('attention'));
  assert(att[0].area === 'Compliance' && att.some((a) => a.area === 'Approvals' && a.project === 'RYDE'), 'attention leads with compliance and has the RYDE information request');

  // ---- notes, new project, import, export
  run('log', P('log', 'PARK', 'Facade approved at $180,000 after a site meeting', '--by=JP'));
  const np = run('project-new', P('project-new', 'BAY', 'Bayview Nine', '--where=QLD', '--kind=apartments', '--manager=DM'));
  assert(np.code === 'BAY', 'new project');
  const dry = run('import feasibility dry run', P('import', 'estatemaster', 'feasibility', 'examples/estatemaster-feasibility.csv', '--project=BAY', '--dry-run'));
  assert(dry.would_save === 11 && dry.saved === 0 && !dry.skipped.length, 'dry run reads 11 lines, saves none');
  const imp = run('import feasibility', P('import', 'estatemaster', 'feasibility', 'examples/estatemaster-feasibility.csv', '--project=BAY'));
  assert(imp.saved === 11 && imp.version === 1, 'eleven lines into BAY v1');
  const bf = run('imported feasibility adds up', P('feaso', 'BAY'));
  assert(bf.revenue === 9360000 && bf.cost === 7785800 && bf.lines.find((l) => l.description === 'Stamp duty').category === 'acquisition' && bf.lines.find((l) => l.description === 'Council rates and land tax').category === 'holding', 'BAY totals and categories');
  run('import feasibility again (idempotent)', P('import', 'estatemaster', 'feasibility', 'examples/estatemaster-feasibility.csv', '--project=BAY', '--version=1'));
  assert(run('still eleven lines', P('feaso', 'BAY')).lines.length === 11, 'no duplicates');
  const ib = run('import budget', P('import', 'estatemaster', 'budget', 'examples/estatemaster-budget.csv', '--project=BAY'));
  assert(ib.saved === 7, 'seven cost codes');
  const is = run('import sales', P('import', 'estatemaster', 'sales', 'examples/estatemaster-sales.csv', '--project=BAY'));
  assert(is.saved === 4, 'four lots');
  const bl = run('imported lots', P('lots', 'BAY'));
  assert(bl.find((l) => l.lot_no === '1').status === 'exchanged' && n(bl.find((l) => l.lot_no === '1').deposit) === 93500 && bl.find((l) => l.lot_no === '4').status === 'hold', 'statuses and a percentage deposit');
  const exp = run('export', P('export', `--out=${exportDir}`));
  assert(exp.counts.projects === 5 && existsSync(path.join(exportDir, 'lots.csv')), 'export writes every table');

  // ---- views and documents render
  const view = run('view', ['view.mjs'], { json: false });
  assert(/view: views/.test(view.stdout), 'views render');
  const docs = run('docs', ['docs.mjs'], { json: false });
  assert(/document\(s\) rendered/.test(docs.stdout) && !/^0 document/m.test(docs.stdout), 'documents render');

  console.log(`\nPASS: ${step} steps`);
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
