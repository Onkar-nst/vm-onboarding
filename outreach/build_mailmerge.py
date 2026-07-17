#!/usr/bin/env python3
"""
Turn the prospect markdown lists into personalized mail-merge CSVs.

Each output row is a complete, ready-to-send email: the founder-voice template
below with the company name and a personalized opening line woven in. Load the
CSV into a Gmail mail-merge tool (see HOW-TO-SEND.md), fill the `email` column
with each company's public address, and send one by one on your own trigger.

Run:  python3 build_mailmerge.py
"""

import csv
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))

SENDER = """[Your name]
Founder, AI Solutions
aisolutionsdad@gmail.com · [phone]"""

GEARWALL_BODY = """Hi {company} team,

{opening}

When several crews share one equipment room, the same three things happen on loop: nobody knows who has the camera, two shoots get booked on the same kit, and a Rs 2-lakh camera body goes "missing" until someone finds it in a cupboard weeks later.

I'm a builder, not a salesperson. I made Gear Wall because I kept watching good studios lose real money and shoot days to this. It's a simple browser app your whole team uses with zero training:

- The Wall: every camera, lens, light and mic with live status - free, in use (by whom, which shoot, how long), or damaged.
- Booking calendar with approvals: crews request gear for a date range; clashes are flagged before they happen; a manager approves in one tap.
- QR pickup & return: a sticker on each item - scan out, scan back. Condition is logged both ways, overdue returns are flagged automatically, and you get a full history per item.

Setup takes about an hour, and it works on any phone or laptop. Can I send you a live link to click around yourself, or grab 15 minutes this week?

{sender}

If gear tracking isn't a headache for you, just reply "no" and I won't write again."""

ONBOARDING_BODY = """Hi {company} team,

{opening}

Every agency has the same quiet leak: the process lives in a document nobody reads, so each new joiner burns a senior person's whole day - and you still discover the gaps three weeks later, in front of a client.

I'm a builder, not a salesperson. I made the Onboarding Academy because I watched this quietly cost teams their best people's time. You paste in the process you've already written, and it becomes an interactive course:

- Modules that unlock one by one: each ends with a quick check, so you know they actually read it (and wrong answers show you exactly what they missed).
- A final quiz plus a real day-one assignment: they do one actual piece of work against your checklist and submit it.
- Leads review only the gaps: feedback lands on the exact items that failed, and they fix and resubmit. New joiners do real work in week one, not week four.

A course takes an afternoon to build - no IT needed - and you can run separate tracks for designers, writers and account teams. Can I send you a live link to try, or grab 15 minutes this week?

{sender}

Not a fit? Just reply "no" and I won't write again."""

GEARWALL_SUBJECT = "{company}: who has your camera right now?"
ONBOARDING_SUBJECT = "{company}: new joiners productive on day one"

GEARWALL_OPENING = "I'll be quick - {company} is exactly who Gear Wall is built for: {hook}."
ONBOARDING_OPENING = "I'll be quick - {company} is exactly who the Onboarding Academy is built for: {hook}."


def soften_hook(hook):
    """Lowercase the first letter only when it's an ordinary capitalized word,
    so 'Multiple crews...' -> 'multiple crews...' but 'D2C', 'QR', '1,000+' stay."""
    hook = hook.strip().rstrip(".")
    if len(hook) >= 2 and hook[0].isupper() and hook[1].islower():
        return hook[0].lower() + hook[1:]
    return hook


def parse(md_path):
    region = ""
    rows = []
    for line in open(md_path, encoding="utf-8"):
        s = line.strip()
        if s.startswith("## Bucket"):
            if "Maharashtra" in s:
                region = "Maharashtra"
            elif "Karnataka" in s:
                region = "Karnataka"
            else:
                region = "Rest of India"
            continue
        if not s.startswith("|"):
            continue
        cells = [c.strip() for c in s.split("|")[1:-1]]
        if len(cells) != 4:
            continue
        if cells[0] in ("Company", "") or set(cells[0]) <= {"-"}:
            continue
        company, city, segment, hook = (c.replace("&amp;", "&") for c in cells)
        rows.append((region, company, city, segment, hook))
    return rows


def build(md_name, csv_name, subject_t, opening_t, body_t):
    rows = parse(os.path.join(HERE, md_name))
    out = os.path.join(HERE, csv_name)
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["region", "company", "city", "segment", "email", "subject", "email_body"])
        for region, company, city, segment, hook in rows:
            opening = opening_t.format(company=company, hook=soften_hook(hook))
            body = body_t.format(company=company, opening=opening, sender=SENDER)
            subject = subject_t.format(company=company)
            w.writerow([region, company, city, segment, "", subject, body])
    print(f"{csv_name}: {len(rows)} rows")
    return len(rows)


if __name__ == "__main__":
    build("prospects-gearwall.md", "mailmerge-gearwall.csv",
          GEARWALL_SUBJECT, GEARWALL_OPENING, GEARWALL_BODY)
    build("prospects-onboarding.md", "mailmerge-onboarding.csv",
          ONBOARDING_SUBJECT, ONBOARDING_OPENING, ONBOARDING_BODY)
