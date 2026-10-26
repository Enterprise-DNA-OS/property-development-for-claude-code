# Property Development for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs doing today? What is overdue? | `/attention` |
| The Monday meeting | `/weekly-review` |
| How is the business going, in short | `/stats` |
| Every project, margins against the feasibility | `/projects` |
| One project in full; a new project | `/project` |
| A feasibility, IRR, peak funding; change or approve a version | `/feaso` |
| What changed between versions | `/compare` |
| What if prices fall or the build rises | `/sensitivity` |
| What can we pay for a site | `/residual` |
| The cost report | `/costs` |
| Contracts and retention | `/contracts` |
| A variation raised or decided | `/variation` |
| A payment claim, a schedule, a payment | `/claims` |
| Write the payment schedule | `/draft-payment-schedule` |
| The next drawdown | `/drawdown` |
| The drawdown letter | `/draft-drawdown` |
| Lots, buyers, deposits | `/lots` |
| Are we over the lender's presale hurdle | `/presales` |
| A sale, settlement or rescission | `/exchange` |
| Sunset dates and buyers who can walk | `/sunsets` |
| A progress letter to buyers | `/draft-buyer-update` |
| The lender's monthly report | `/draft-lender-report` |
| Consents, permits, information requests | `/approvals` |
| Conditions of consent | `/conditions` |
| Are we compliant | `/compliance` |
| Branded reports and letters | `/documents` |
| Printable dashboards; a new one | `/view`, `/new-view` |
| Bring in EstateMaster data | `/import` |
| Everything out to CSV | `/export` |
| Add something | `/add` |
| Note a call or meeting | `/log` |
| Change a field, rule or stage | `/customise` |

If an ask fits nothing here, run the CLI directly (`npm run pd -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- Never rescind a contract, serve a notice or give a payment schedule from here. Draft it to `drafts/`; the solicitor or the development manager serves it.
- Never change an approved feasibility. Start a new version (`feaso-new`), change that, and let the director approve it.
- Money is ex GST in the project's own currency. Say so when a figure goes in a letter.
- Compliance answers cite the rule and its source from `docs/compliance.md`. They are records checks, not legal advice.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off EstateMaster.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/estatemaster
