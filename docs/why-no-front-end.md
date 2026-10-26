# Why there is no front end

EstateMaster is a feasibility model and a project register, licensed per user and per module. The records underneath are ordinary: projects, feasibility lines, cost codes, contracts, claims, lots, approvals. What you pay for each year is the layer on top that lets people who do not write SQL get at them. Input screens, reports, an Excel link.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, describe what you want, and it writes the query, runs it, and explains the answer. Ask a question the dashboard never had a chart for and you still get an answer.

## What you gain

- **Better answers.** A dashboard shows what the vendor decided to chart. Here you ask your own question, in your own words, and get it answered against your own data.
- **No seats.** Everyone who needs to look can look. The bill does not grow with headcount.
- **Your data in your Postgres.** Plain tables. Back them up, query them from anything, leave any time. There is no export step because there is nothing to leave.
- **A process that matches you.** When your way of working changes, you add a command. You do not wait for a feature request to clear.

## What you give up

- **A spreadsheet-style model to type into.** EstateMaster's input screens and its Excel link let an analyst tweak a cash flow cell by cell. Here you change a line by asking, and the cash flow is simpler: even spreading over months, not S-curves.
- **Charts on screen.** Cash flow graphs and sensitivity charts are tables here, or a page from `npm run view`.
- **A phone app.** It runs where Claude Code runs. Site staff log notes through whoever has it open.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for businesses that want someone to call.

## Who this fits

Small teams who already use Claude Code, or who would rather learn to ask than learn another interface. If your team lives in a cash flow model all day, keep EstateMaster for that and use this for everything around it. If you need the answers more than the screens, this is cheaper, faster and yours.

Installed and run for you: https://enterprisedna.co/omni/instead-of/estatemaster
