# Admissions CRM — enquiry to enrolment for schools & colleges

A complete admissions-funnel CRM an institution can run the day it's installed:
no per-seat licence, no dedicated administrator, no six-month implementation.
It models admissions **natively** — stages, counsellors, documents, fees,
seats — instead of forcing an admissions office to bend a generic sales CRM.

**Try it:** `./run.sh` from the repo root → http://localhost:4173/CRM/
(default admin PIN **1234**, change it in Settings). The public enquiry form
lives at http://localhost:4173/CRM/enquiry.html — submit it and watch the lead
appear on the counsellors' board, auto-assigned, with the SLA clock running.

## Why this exists (the market gap)

The incumbents price small institutions out and overwhelm them operationally:

| Product | Reality |
|---|---|
| Slate (Technolutions) | $30,000/yr floor, needs a dedicated full-time admin, 6–24 month implementations |
| Salesforce Education Cloud | $50–100k+/yr plus consultants |
| Element451 | ~$20–40k/yr, US-centric |
| Generic CRMs (HubSpot etc.) | "Do not natively model applications, intakes, offers, document review or enrolment" — their own partners' words |

A mid-size Indian college runs admissions on **Excel + WhatsApp + memory**.
Leads from fairs, portals and walk-ins land in different notebooks; nobody
calls the website enquiry for two days; documents go missing; the director
finds out in July that Google Ads produced 400 leads and 3 admissions.
This product is aimed exactly there.

## What it does

**Dashboard** — open leads, weighted pipeline value, SLA breaches, stalled
leads, average first-response time; admission funnel with per-stage drop-off;
counsellor leaderboard vs target; source conversion and cost-per-admission.

**My Day** — each counsellor's working queue: SLA-breached new leads first,
then overdue / due-today / upcoming follow-ups, then high-score leads going
cold with nothing scheduled. The screen answers "who do I call right now?"

**Pipeline** — drag-and-drop kanban across a fully editable stage list
(default: New → Contacted → Qualified → Campus Visit → Applied → Documents →
Fee Pending → Enrolled / Lost). Table view with bulk reassign / bulk stage
move / bulk follow-up. Moving to Lost demands a reason; moving to Enrolled
shows the fee position and document gaps before you confirm.

**Lead 360 drawer** — every call, WhatsApp, email, visit, note, stage change
and payment on one timeline; document checklist (missing → received →
verified); fee ledger with receipts; one-tap call / WhatsApp deep links;
template messages with merge fields, previewed per lead before sending.

**Lead scoring** — five weighted signals (engagement, funnel progress,
recency, source quality, academic fit), weights tunable in Settings. Hot /
warm / cold bands sort every queue so mornings start with the right calls.

**SLAs** — a first-response timer on every new lead (default 60 min) and a
per-stage stall limit. Breaches surface on the dashboard, the board cards and
My Day. This single feature is the pitch: response time is the strongest
conversion lever an admissions office controls.

**Admissions desk** — document verification queue sorted by "needs a human
now", and a fee desk: outstanding instalments, mark-paid with auto receipts,
collection progress per programme against confirmed enrolments.

**Outreach** — WhatsApp / email / SMS templates with `{{merge}}` fields, and
bulk sends to a filtered segment that log a touch on every lead and export a
mail-merge-ready CSV. The CRM never pretends to send — it composes, hands to
the channel you already use, and records.

**Events** — open days, fairs, webinars with cost and footfall; a fast
capture form for the registration desk (name + phone + programme, Enter,
next) that dedupes against existing leads; ROI per event down to
cost-per-admission.

**Reports** — stage-to-stage conversion, loss reasons, source ROI (spend →
leads → cost/lead → enrolments → cost/admission → fee revenue → ROI
multiple), counsellor performance (conversion, avg response, overdue count),
12-week enquiry trend, programme demand vs seat capacity.

**Manage** — programmes (fee, seats, intake, document checklist), team,
sources (spend + quality), pipeline stages, and CSV import with column
mapping and duplicate skipping.

**Public enquiry form** (`enquiry.html`) — embeddable capture page writing
into the same data layer: auto-assigned to the least-loaded counsellor,
SLA clock started, repeat submissions attached to the existing record.

## Architecture

Same database-ready layer as every Katta app:

| File | Role |
|---|---|
| `config.js` | the only file you touch to deploy (adapter, namespace) |
| `store.js` | `Store` facade + `LocalAdapter` (localStorage) + `RestAdapter` (any HTTP backend) |
| `seed.js` | a full demo admission season, loaded only when the DB is empty |
| `app.js` | boot, cache, scoring, SLAs, Dashboard, My Day |
| `pipeline.js` | board, table, bulk ops, lead 360 drawer, messaging |
| `manage.js` | admissions desk, manage screens, CSV import, settings, backup |
| `reports.js` | outreach, events, reports |
| `enquiry.html` | public capture form |

All persistence goes through `Store.list / put / remove / getMeta / setMeta`
(async). Point `config.js` at a REST backend implementing the 6-endpoint
contract in `store.js` and nothing else changes. Settings → Export backup
(JSON) is the migration path.

Roles: counsellors/telecallers see their own leads; admins see everything and
unlock Manage/Settings with the PIN. Server-side enforcement comes with the
REST adapter (`Authorization` header is already sent).

## Selling it

- **Wedge**: "Your website enquiries wait days for a call. This makes the
  wait visible — and makes the first counsellor free to call in minutes."
- **Demo**: open the seeded season, show the dashboard's SLA-breach tile,
  then submit the public form live and watch it land on the board.
- **Pricing anchor**: incumbents start at ₹3–8L/yr for this feature set.
  A flat ₹40–60k/yr per institution with WhatsApp-first workflows undercuts
  every serious competitor while staying 10× cheaper to support.
- **Land-and-expand**: one admission season of data makes switching away
  painful; the fee desk and reports are what the director renews for.

Tested end-to-end in `.tests/harness.html` (35 CRM checks: seeding, capture,
dedupe, board moves, lost/enrol flows, documents, payments, tasks, PIN gate,
CSV import, settings, reports, events, public form).
