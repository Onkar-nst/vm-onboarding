# How to send these — one by one, from your Gmail, on your trigger

Claude cannot send email for you (no send tool exists, and the connected Gmail is
read-only + a different account). So this is the setup where **you** press send —
personalized, one company at a time, whenever you want — with almost no manual work.

## What you already have

- `mailmerge-gearwall.csv` — **287** studios/production/rental companies, each with
  its own subject line and a complete, personalized email body.
- `mailmerge-onboarding.csv` — **311** marketing/creative agencies, same.

Each row's `email_body` is a finished email. The only blank is the `email` column
(the recipient address) and the three bracketed fields in your signature.

## Step 1 — fill your signature once

Open each `email-final-*.md`, set `[Your name]`, your company name (I guessed
"AI Solutions" from your address — fix if wrong), and `[phone]`. Then re-run
`python3 build_mailmerge.py` so every row picks up your real signature.

## Step 2 — add recipient addresses

The lists have company names + cities but **not email addresses** (deliberately —
no scraped personal data). Fill the `email` column with each company's public
address, found in 20 seconds on their website's contact page — usually
`info@`, `hello@`, `contact@`, or `studio@`. Do a batch of 20–30 at a time; you
only need addresses for the ones you're about to send.

## Step 3 — send one by one with a Gmail mail-merge tool

Best match for "send when I want, one by one from aisolutionsdad@gmail.com":

1. Upload the CSV to **Google Sheets** (signed in as aisolutionsdad@gmail.com).
2. Install a mail-merge add-on — **"Yet Another Mail Merge" (YAMM)** or **GMass**.
   Both send *individual* personalized emails from your own Gmail (not a visible
   group), and you trigger each run yourself.
3. Map: `email` → recipient, `subject` → subject, `email_body` → body.
4. Send a batch. YAMM free tier ≈ 50/day; Gmail personal caps ≈ 500/day total.

Alternatively, with **no tool**: open the CSV, copy a row's subject + body into a
normal Gmail compose, paste the address, send. Slower, but it's literally one row
per email.

## Step 4 — pace it (this protects your domain)

- **20–40 per day**, not hundreds at once. Bulk-identical cold email gets a Gmail
  account throttled or blocked and lands you in spam.
- Send in small regional batches (the `region` column: Maharashtra → Karnataka →
  Rest of India) so replies are easy to handle.
- Personalize the first line on the ones that matter most — the CSV gives you a
  strong draft; 10 seconds of editing on a dream client doubles the reply rate.
- Only two follow-ups, then stop (see `email-templates.md`).

## If you'd rather Claude create the drafts for you

Possible, with two changes on your side:
1. In claude.ai → Settings → Connectors, **reconnect Gmail with write/compose
   permission** (it's currently read-only).
2. Connect the **aisolutionsdad@gmail.com** account (today the connector is on a
   different account, and drafts can only be created in the connected one).

After that, Claude can create ready-to-send **drafts** in your Gmail (you'd still
press Send). Claude still cannot auto-send — that's a hard platform limit, and
honestly a good guardrail against accidental mass-sends.
