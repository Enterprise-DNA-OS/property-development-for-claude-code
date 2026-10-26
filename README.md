<h1 align="center">Property Development for Claude Code</h1>

<p align="center">
  <strong>The open-source property development system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your EstateMaster data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=estatemaster">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/estatemaster?utm_source=github&utm_medium=readme&utm_campaign=estatemaster">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-estatemaster">Instead of EstateMaster</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Property Development for Claude Code does the job you pay EstateMaster for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the EstateMaster dashboard cannot.

EstateMaster (now ARGUS EstateMaster, from Altus Group) is licensed per user and per module, Development Feasibility and Development Management priced separately on yearly subscriptions quoted privately, with training sold on top ([altusgroup.com](https://www.altusgroup.com/argus/products/argus-estatemaster/)). Every analyst, development manager and director who needs the numbers is another licence.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=estatemaster).

It is for property developers in New Zealand and Australia running a handful of projects at once: apartments, townhouses, land subdivisions. It holds the feasibility in versions (with IRR, peak funding, residual land value and a sensitivity grid), the cost report by cost code against contracts and variations, payment claims with their security of payment deadlines, the lot and presale register against the lender's covenant, drawdowns, approvals and their conditions. Thirteen compliance checks cover sunset clauses, off the plan disclosure and deposits, GST at settlement, the margin scheme, overseas buyers, payment schedules and retention trusts, each with its source.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/property-development-for-claude-code.git
cd property-development-for-claude-code
npm install
npm run demo
```

`npm run demo` creates the database and loads Harbour & Hill Developments (a made-up developer with four projects in Sydney, Melbourne and Auckland: a builder's payment claim with no payment schedule past the 10 business day deadline, eleven off the plan contracts whose sunset date falls before forecast completion, a lot rescinded under the sunset clause without the buyer's consent, a sale with no disclosure statement, a Victorian deposit of 15%, a missing GST withholding notice, a margin scheme sale with no written agreement, an overseas buyer with no approval number, retention held on a New Zealand job with no trust account, a planning permit 90 days from lapsing with no works started, a council information request past due, $298,000 of variations waiting on a decision, and presales $840,000 short of the lender's hurdle), then prints the projects, the presales and the compliance check.

Then open the folder in Claude Code and type:

```
/attention
```

Try `/project PARK`, `/feaso RYDE`, `/compare RYDE`, `/claims`, `/sunsets`. When you are ready for real data, delete `.data/` and start with `/import`.

Fill in the "Who this is for" block in [CLAUDE.md](CLAUDE.md), and put your business name, logo and colours in [brand.json](brand.json) so the lender reports and buyer letters carry them.

## Your first hour: ten things to ask for

1. "What needs attention today?"
2. "Coastline's progress claim 8 came in this morning for $640,000. Record it and tell me when the schedule is due."
3. "Show me Parkside in full."
4. "Start a new feasibility for Ryde with construction at $19.8m and tell me what it does to the margin."
5. "What is the most we can pay for the Ryde site at 20% on cost?"
6. "Lot 204 at Parkside exchanged today to K. Ward at $1,140,000, 10% deposit, sunset 30 June 2028."
7. "Which buyers can walk away if the build runs late?"
8. "Build drawdown 7 for Parkside and draft the letter to Eastbank."
9. "Bring in this EstateMaster feasibility and sales register for Bayview."
10. "Approve variation V03 at $180,000 and note why." 

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that wants a decision, worst first: breaches, claim clocks, approvals, finance, costs, margin, sales. |
| `/weekly-review` | The Monday development meeting, written from three commands. |
| `/stats` | The portfolio in six lines. |
| `/projects` | Every project: stage, approved margin against forecast margin, profit, overrun, lots sold. |
| `/project` | One project in full: feasibility, lender, approvals, cost report, notes. Add a project. |
| `/feaso` | A feasibility with IRR, peak funding and residual land value. Start a version, change a line, approve it. |
| `/compare` | What changed between two feasibility versions, and what it did to the profit. |
| `/sensitivity` | Margin as sales prices and build cost move. |
| `/residual` | The most you can pay for the land at each target margin. |
| `/costs` | The cost report: budget, committed, pending variations, spent, forecast, to complete. |
| `/contracts` | Contracts, variations, claimed to date and retention. Add a contract. |
| `/variation` | Raise a variation, approve or reject one. |
| `/claims` | Payment claims and invoices with their security of payment deadlines. Record a claim, a schedule, a payment. |
| `/draft-payment-schedule` | Draft a valid payment schedule with the reasons for any shortfall. |
| `/drawdown` | Build the next drawdown from approved claims since the last one. |
| `/draft-drawdown` | Draft the drawdown request letter to the lender. |
| `/lots` | The lot book: status, price, buyer, deposit, whether it counts, days to sunset. |
| `/presales` | Qualifying presales against each lender's hurdle. |
| `/exchange` | Record a sale, a settlement or a rescission, with the paperwork the checks need. |
| `/sunsets` | Sunset dates coming up, and every one before forecast completion. |
| `/draft-buyer-update` | Draft the construction progress letter to off the plan buyers. |
| `/draft-lender-report` | Draft the monthly report to the lender. |
| `/approvals` | Consents and permits: information requests, lapse dates, works commenced, open conditions. |
| `/conditions` | Conditions of consent still open, by the stage they gate. |
| `/compliance` | Thirteen rules checked against the records, each with its source. |
| `/documents` | The lender report, feasibility summaries and buyer updates in your brand. |
| `/view` | This week, costs and sales as printable pages. |
| `/new-view` | Add a dashboard in plain language. |
| `/import` | Bring a project across from EstateMaster exports. |
| `/export` | Every table to CSV. |
| `/add` | Add anything by asking; routes to the right command. |
| `/log` | A dated note on a project. |
| `/customise` | Change a field, a rule or a stage in plain language. |

Every command is a short recipe over one CLI: `npm run pd -- help` lists it all.

## Ten questions answered from your own records

Every one is a real command on the demo data today.

1. Which payment claims need a payment schedule this week, and which have already missed the deadline? (`claims`)
2. Which buyers have a sunset date before the forecast completion, and how much contract value is that? (`sunsets`)
3. Do our qualifying presales meet each lender's covenant, counting only full deposits and capping overseas buyers? (`presales`)
4. What did the council's setback request do to profit, margin and IRR on Ryde, line by line? (`compare RYDE`)
5. What is the most we can pay for a site at 15%, 20% or 25% on cost? (`residual`)
6. How far can sales prices fall and the build cost rise before Elm Street misses its target margin? (`sensitivity ELM --version=2`)
7. Which cost codes are forecast over budget once pending variations land? (`costs`)
8. Which variations have waited more than two weeks for a decision? (`attention`)
9. Which approvals lapse within six months with no works started, and which conditions gate the next stage? (`approvals`, `conditions`)
10. Which sales are missing a disclosure statement, a GST withholding notice, a margin scheme agreement or an overseas buyer's approval? (`compliance`)

## Instead of EstateMaster

Set up your projects by asking for them, export the feasibility, the budget and the sales register from EstateMaster to Excel and save each as CSV, then:

```
npm run pd -- import estatemaster feasibility feaso.csv --project=BAY --dry-run
npm run pd -- import estatemaster feasibility feaso.csv --project=BAY
npm run pd -- import estatemaster budget budget.csv --project=BAY
npm run pd -- import estatemaster sales sales.csv --project=BAY
```

Put revenue, cost and profit next to the same EstateMaster reports before you switch. The full guide, what maps and what does not: [docs/replace-estatemaster.md](docs/replace-estatemaster.md). The rules the compliance check uses, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
property-development-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/pd.mjs            the one CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis, the compliance rules and the EstateMaster guide
  documents.json, views.json  the paperwork and dashboards, as SQL
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Property Development for Claude Code for your business, migrates your EstateMaster data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=estatemaster)
- Read more: [enterprisedna.co/omni/instead-of/estatemaster](https://enterprisedna.co/omni/instead-of/estatemaster?utm_source=github&utm_medium=readme&utm_campaign=estatemaster)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
