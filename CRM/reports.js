/* Admissions CRM — Outreach (templates + bulk campaigns), Events, Reports.
 * The reports here are the ones an admissions director actually asks for:
 * where the money went, which counsellor converts, and where leads die.
 */

/* ---------------- Outreach ---------------- */

function renderOutreach() {
  const leads = visibleLeads();
  $("#view").innerHTML = `
    <div class="toolbar">
      <div><h2>Outreach</h2><div class="sub-note">Message templates with merge fields, and bulk sends to a filtered segment.</div></div>
      <div class="spacer"></div>
      <button class="btn" id="oCampaign">Bulk send…</button>
      <button class="btn brand" id="oAdd">+ New template</button>
    </div>

    <div class="section">
      <h3>Templates</h3>
      <div class="sub-note">Available merge fields: <span class="mono" style="font-size:12px">{{name}} {{firstname}} {{course}} {{fee}} {{intake}} {{org}} {{year}} {{counsellor}} {{city}} {{docchecklist}}</span></div>
      <div class="grid3" style="margin-top:14px">
        ${cache.templates.map(t => `
          <div class="section" style="margin:0;box-shadow:none;background:var(--panel2)">
            <div style="display:flex;align-items:center;gap:8px">
              <span class="badge plain" style="background:var(--${t.channel === "whatsapp" ? "green" : t.channel === "email" ? "violet" : "blue"}-soft);color:var(--${t.channel === "whatsapp" ? "green" : t.channel === "email" ? "violet" : "blue"})">${esc(t.channel)}</span>
              <div style="flex:1"></div>
              <button class="btn xs" data-tedit="${t.id}">Edit</button>
              <button class="btn xs ghost" data-tdel="${t.id}">Delete</button>
            </div>
            <h3 style="font-size:14px;margin:10px 0 6px">${esc(t.name)}</h3>
            ${t.subject ? `<div style="font-size:12px;color:var(--muted);margin-bottom:6px"><b>Subject:</b> ${esc(t.subject)}</div>` : ""}
            <div style="font-size:12.5px;color:var(--ink2);line-height:1.6;max-height:120px;overflow:hidden">${esc(t.body)}</div>
          </div>`).join("") || `<div class="empty">No templates yet.</div>`}
      </div>
    </div>

    <div class="section">
      <h3>Communication volume</h3>
      <div class="sub-note">Logged messages and calls across the season, by channel.</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Channel</th><th class="num">This week</th><th class="num">This month</th><th class="num">All time</th></tr></thead>
        <tbody>${["call", "whatsapp", "email", "visit", "note"].map(t => {
          const all = cache.activities.filter(a => a.type === t);
          const wk = all.filter(a => a.ts > Date.now() - 7 * DAYMS).length;
          const mo = all.filter(a => a.ts > Date.now() - 30 * DAYMS).length;
          return `<tr><td>${ACT_ICON[t]} ${ACT_LABEL[t]}</td><td class="num">${wk}</td><td class="num">${mo}</td><td class="num">${all.length}</td></tr>`;
        }).join("")}</tbody></table></div>
    </div>`;

  $("#oAdd").addEventListener("click", () => showTemplateModal(null));
  $("#oCampaign").addEventListener("click", showCampaignModal);
  $$("[data-tedit]").forEach(b => b.addEventListener("click", () => showTemplateModal(b.dataset.tedit)));
  $$("[data-tdel]").forEach(b => b.addEventListener("click", async () => {
    const t = cache.templates.find(x => x.id === b.dataset.tdel);
    if (!t) return;
    await Store.remove("templates", t.id);
    await addLog(`Template deleted: ${t.name}.`);
    await refresh(); toast("Template deleted"); render();
  }));
}

function showTemplateModal(id) {
  const t = id ? cache.templates.find(x => x.id === id) : null;
  openModal(`
    <h3>${t ? "Edit template" : "New template"}</h3>
    <div class="sub">Merge fields in double braces are replaced per lead when you send.</div>
    <div class="row2">
      <div><label>Name *</label><input id="tpName" value="${esc(t ? t.name : "")}"></div>
      <div><label>Channel</label><select id="tpChan">${["whatsapp", "email", "sms"].map(c => `<option ${t && t.channel === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    </div>
    <label>Subject (email only)</label><input id="tpSubj" value="${esc(t ? t.subject : "")}">
    <label>Body *</label><textarea id="tpBody" style="min-height:170px">${esc(t ? t.body : "")}</textarea>
    <div class="hint">Available: {{name}} {{firstname}} {{course}} {{fee}} {{intake}} {{org}} {{year}} {{counsellor}} {{phone}} {{email}} {{city}} {{docchecklist}}</div>
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="tpGo">Save</button></div>`, true);
  $("#tpGo").addEventListener("click", async () => {
    const name = $("#tpName").value.trim();
    if (!name) { $("#tpName").focus(); return; }
    const body = $("#tpBody").value.trim();
    if (!body) { $("#tpBody").focus(); return; }
    let doc = t;
    if (!doc) doc = { id: await Store.nextId("TPL") };
    Object.assign(doc, { name, channel: $("#tpChan").value, subject: $("#tpSubj").value.trim(), body });
    await Store.put("templates", doc);
    await addLog(`Template ${t ? "updated" : "created"}: ${name}.`);
    await refresh(); closeModal(); toast(`${name} saved`); render();
  });
  $("#tpName").focus();
}

/* Bulk send — builds the segment, previews the first message, then logs the
 * send against every lead. It deliberately does NOT pretend to deliver mail:
 * it produces a per-lead CSV the institution feeds to its own mail-merge or
 * WhatsApp Business tool, and records that the touch happened. */
function showCampaignModal() {
  openModal(`
    <h3>Bulk send</h3>
    <div class="sub">Pick a segment and a template. The CRM builds a personalised message per lead, logs it on each timeline, and exports a merge-ready CSV.</div>
    <div class="row2">
      <div><label>Stage</label><select id="bcStage"><option value="">Any open stage</option>${cache.stages.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
      <div><label>Programme</label><select id="bcCourse"><option value="">All programmes</option>${cache.courses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
    </div>
    <div class="row2">
      <div><label>Score band</label><select id="bcBand"><option value="">Any</option><option value="hot">Hot only</option><option value="warm">Warm and above</option></select></div>
      <div><label>Template</label><select id="bcTpl">${cache.templates.map(t => `<option value="${t.id}">${esc(t.name)} — ${t.channel}</option>`).join("")}</select></div>
    </div>
    <div id="bcCount" class="hint"></div>
    <label>Preview (first matching lead)</label>
    <div class="preview" id="bcPrev">—</div>
    <div class="actions">
      <button class="btn" data-close>Cancel</button>
      <button class="btn brand" id="bcGo">Log sends &amp; export CSV</button>
    </div>`, true);

  const segment = () => {
    const st = $("#bcStage").value, co = $("#bcCourse").value, bd = $("#bcBand").value;
    return visibleLeads().filter(l => {
      if (st ? l.stage !== st : !isOpen(l)) return false;
      if (co && l.courseId !== co) return false;
      if (bd === "hot" && scoreBand(scoreLead(l)) !== "hot") return false;
      if (bd === "warm" && scoreBand(scoreLead(l)) === "cold") return false;
      return true;
    });
  };
  const paint = () => {
    const seg = segment();
    const t = cache.templates.find(x => x.id === $("#bcTpl").value);
    $("#bcCount").innerHTML = `<b>${seg.length}</b> lead${seg.length === 1 ? "" : "s"} match this segment.`;
    $("#bcPrev").textContent = seg.length && t
      ? (t.subject ? "Subject: " + applyTemplate(t.subject, seg[0]) + "\n\n" : "") + applyTemplate(t.body, seg[0])
      : "No leads match.";
  };
  ["#bcStage", "#bcCourse", "#bcBand", "#bcTpl"].forEach(s => $(s).addEventListener("change", paint));
  paint();

  $("#bcGo").addEventListener("click", async () => {
    const seg = segment();
    const t = cache.templates.find(x => x.id === $("#bcTpl").value);
    if (!seg.length || !t) { toast("Nothing to send"); return; }
    const rows = [["Lead ID", "Name", "Phone", "Email", "Channel", "Subject", "Message"]];
    for (const l of seg) {
      rows.push([l.id, l.name, l.phone, l.email, t.channel,
        t.subject ? applyTemplate(t.subject, l) : "", applyTemplate(t.body, l)]);
      await logActivity(l.id, t.channel === "email" ? "email" : "whatsapp", `Campaign: "${t.name}"`);
    }
    downloadFile(`campaign-${t.name.toLowerCase().replace(/\W+/g, "-")}-${todayStr()}.csv`, toCsv(rows), "text/csv");
    await addLog(`Bulk send "${t.name}" logged against ${seg.length} leads.`);
    await refresh(); closeModal(); toast(`${seg.length} messages logged and exported`); render();
  });
}

/* ---------------- Events ---------------- */

function renderEvents() {
  const evs = cache.allEvents.slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const today = todayStr();

  $("#view").innerHTML = `
    <div class="toolbar">
      <div><h2>Events</h2><div class="sub-note">Open days, education fairs and webinars — and the enquiries each one actually produced.</div></div>
      <div class="spacer"></div>
      <button class="btn brand" id="eAdd">+ New event</button>
    </div>

    <div class="section">
      <h3>Event ROI</h3>
      <div class="sub-note">Leads are attributed to an event by the source you tag them with. Cost-per-enrolment is the number worth arguing about.</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Event</th><th>Date</th><th>Type</th><th class="num">Cost</th><th class="num">Expected</th><th class="num">Attended</th><th class="num">Leads</th><th class="num">Enrolled</th><th class="num">Cost/adm.</th><th></th></tr></thead>
        <tbody>${evs.map(e => {
          const linked = cache.leads.filter(l => l.eventId === e.id);
          const won = linked.filter(isWon).length;
          const past = (e.date || "") < today;
          return `<tr ${e.active === false ? 'style="opacity:0.5"' : ""}>
            <td><b>${esc(e.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(e.venue || "")}</div></td>
            <td style="font-size:12.5px;white-space:nowrap">${esc(e.date || "—")}${past ? "" : ' <span class="tag cold">upcoming</span>'}</td>
            <td style="font-size:12.5px">${esc(e.type)}</td>
            <td class="num">${moneyShort(e.cost)}</td>
            <td class="num">${e.expected || "—"}</td>
            <td class="num">${e.attended || 0}</td>
            <td class="num">${linked.length}</td>
            <td class="num" style="color:var(--green)">${won}</td>
            <td class="num" style="font-weight:700">${won ? moneyShort(e.cost / won) : "—"}</td>
            <td style="white-space:nowrap">
              <button class="btn xs" data-eedit="${e.id}">Edit</button>
              <button class="btn xs brand" data-ecap="${e.id}">Capture</button>
            </td></tr>`;
        }).join("") || `<tr><td colspan="10"><div class="empty">No events yet.</div></td></tr>`}
      </tbody></table></div>
    </div>`;

  $("#eAdd").addEventListener("click", () => showEventModal(null));
  $$("[data-eedit]").forEach(b => b.addEventListener("click", () => showEventModal(b.dataset.eedit)));
  $$("[data-ecap]").forEach(b => b.addEventListener("click", () => showEventCapture(b.dataset.ecap)));
}

function showEventModal(id) {
  const e = id ? cache.allEvents.find(x => x.id === id) : null;
  openModal(`
    <h3>${e ? "Edit event" : "New event"}</h3>
    <div class="sub">Cost drives the ROI table; attendance is what you record on the day.</div>
    <label>Name *</label><input id="evName" value="${esc(e ? e.name : "")}">
    <div class="row2">
      <div><label>Type</label><select id="evType">${["Open Day", "Education Fair", "Webinar", "School Visit", "Seminar"].map(t => `<option ${e && e.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></div>
      <div><label>Date</label><input id="evDate" type="date" value="${esc(e ? e.date : todayStr())}"></div>
    </div>
    <label>Venue</label><input id="evVenue" value="${esc(e ? e.venue : "")}">
    <div class="row2">
      <div><label>Cost</label><input id="evCost" type="number" min="0" value="${e ? e.cost : 0}"></div>
      <div><label>Expected footfall</label><input id="evExp" type="number" min="0" value="${e ? e.expected : 100}"></div>
    </div>
    <label>Actual attendance</label><input id="evAtt" type="number" min="0" value="${e ? e.attended || 0 : 0}">
    <div class="actions"><button class="btn" data-close>Cancel</button><button class="btn brand" id="evGo">Save</button></div>`);
  $("#evGo").addEventListener("click", async () => {
    const name = $("#evName").value.trim();
    if (!name) { $("#evName").focus(); return; }
    let doc = e;
    if (!doc) doc = { id: await Store.nextId("EVT"), active: true };
    Object.assign(doc, {
      name, type: $("#evType").value, date: $("#evDate").value, venue: $("#evVenue").value.trim(),
      cost: Number($("#evCost").value) || 0, expected: Number($("#evExp").value) || 0,
      attended: Number($("#evAtt").value) || 0
    });
    await Store.put("events", doc);
    await addLog(`Event ${e ? "updated" : "created"}: ${name}.`);
    await refresh(); closeModal(); toast(`${name} saved`); render();
  });
  $("#evName").focus();
}

/* On-the-day capture: the desk at a fair needs one fast form, not the full
 * enquiry modal. Name + phone + programme, and it lands in the pipeline tagged
 * to the event so the ROI table fills itself. */
function showEventCapture(eventId) {
  const e = cache.allEvents.find(x => x.id === eventId);
  openModal(`
    <h3>Capture enquiry — ${esc(e.name)}</h3>
    <div class="sub">Fast capture for the registration desk. Leads are tagged to this event for ROI.</div>
    <div class="row2">
      <div><label>Name *</label><input id="ecName"></div>
      <div><label>Phone *</label><input id="ecPhone" inputmode="tel"></div>
    </div>
    <div class="row2">
      <div><label>City</label><input id="ecCity"></div>
      <div><label>Programme</label><select id="ecCourse">${cache.courses.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
    </div>
    <div id="ecDup"></div>
    <div class="actions">
      <button class="btn" data-close>Done</button>
      <button class="btn brand" id="ecGo">Save &amp; add another</button>
    </div>`);

  const save = async () => {
    const name = $("#ecName").value.trim();
    const phone = $("#ecPhone").value.trim();
    if (!name) { $("#ecName").focus(); return; }
    if (!phone) { $("#ecPhone").focus(); return; }
    const dup = findDuplicate(phone, "", null);
    if (dup) {
      $("#ecDup").innerHTML = `<div class="warn-box"><b>${esc(dup.name)} (${esc(dup.id)})</b> already exists with this number. Logged a campus-visit touch on the existing lead instead.</div>`;
      await logActivity(dup.id, "visit", `Attended ${e.name}`);
      dup.eventId = dup.eventId || e.id;
      await Store.put("leads", dup);
    } else {
      const courseId = $("#ecCourse").value;
      const src = cache.sources.find(s => s.name.toLowerCase().includes("fair") || s.name.toLowerCase().includes("walk")) || cache.sources[0];
      const id = await Store.nextId("LD");
      await Store.put("leads", {
        id, name, phone, email: "", city: $("#ecCity").value.trim(),
        guardianName: "", guardianPhone: "", courseId, sourceId: src ? src.id : null,
        ownerId: await pickOwner(courseId), stage: cache.stages[0].id,
        createdAt: Date.now(), lastActivityAt: Date.now(), eventId: e.id,
        marks12: 0, prevSchool: "", notes: "Met at " + e.name,
        firstResponseMins: null, enrolledAt: null, lostReason: null, docs: {}, tags: ["event"]
      });
      await refresh();
      await logActivity(id, "visit", `Met at ${e.name}`);
      $("#ecDup").innerHTML = `<div class="ok-box">${esc(name)} added to the pipeline.</div>`;
    }
    e.attended = (e.attended || 0) + 1;
    await Store.put("events", e);
    await refresh();
    $("#ecName").value = ""; $("#ecPhone").value = ""; $("#ecCity").value = "";
    $("#ecName").focus();
    toast("Captured — " + (e.attended) + " logged at this event");
    render();
  };
  $("#ecGo").addEventListener("click", save);
  $("#ecPhone").addEventListener("keydown", ev => { if (ev.key === "Enter") save(); });
  $("#ecName").focus();
}

/* ---------------- Reports ---------------- */

function renderReports() {
  const leads = visibleLeads();
  const won = leads.filter(isWon);
  const lost = leads.filter(isLost);
  const closed = won.length + lost.length;

  // time to convert
  const convDays = won.filter(l => l.enrolledAt).map(l => (l.enrolledAt - l.createdAt) / DAYMS);
  const avgConv = convDays.length ? Math.round(convDays.reduce((a, b) => a + b, 0) / convDays.length) : 0;

  // total spend and blended cost per admission
  const spend = cache.sources.reduce((s, x) => s + (x.spend || 0), 0);
  const revenue = won.reduce((s, l) => s + courseById(l.courseId).fee, 0);

  // loss reasons
  const reasons = {};
  lost.forEach(l => { const r = l.lostReason || "Not specified"; reasons[r] = (reasons[r] || 0) + 1; });
  const reasonRows = Object.entries(reasons).sort((a, b) => b[1] - a[1]);

  // enquiries per week, last 12 weeks
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const end = startOfToday() - i * 7 * DAYMS + DAYMS;
    const start = end - 7 * DAYMS;
    weeks.push({ n: leads.filter(l => l.createdAt >= start && l.createdAt < end).length, start });
  }
  const wkMax = Math.max(1, ...weeks.map(w => w.n));

  $("#view").innerHTML = `
    <div class="toolbar">
      <div><h2>Reports</h2><div class="sub-note">${cache.settings.academicYear} season · ${leads.length} enquiries · ${closed} closed</div></div>
    </div>

    <div class="stats">
      <div class="stat green"><div class="n">${leads.length ? Math.round((won.length / leads.length) * 100) : 0}%</div><div class="l">Enquiry → enrolled</div><div class="d">${won.length} of ${leads.length}</div></div>
      <div class="stat brand"><div class="n">${moneyShort(revenue)}</div><div class="l">Confirmed fee revenue</div><div class="d">from ${won.length} enrolments</div></div>
      <div class="stat amber"><div class="n">${avgConv}</div><div class="l">Avg days to enrol</div><div class="d">enquiry → confirmed</div></div>
      <div class="stat blue"><div class="n">${won.length ? moneyShort(spend / won.length) : "—"}</div><div class="l">Blended cost/adm.</div><div class="d">${moneyShort(spend)} total spend</div></div>
      <div class="stat violet"><div class="n">${revenue && spend ? (revenue / spend).toFixed(1) + "×" : "—"}</div><div class="l">Return on spend</div><div class="d">fee revenue ÷ marketing</div></div>
      <div class="stat red"><div class="n">${lost.length}</div><div class="l">Lost</div><div class="d">${closed ? Math.round((lost.length / closed) * 100) : 0}% of closed</div></div>
    </div>

    <div class="grid2">
      <div class="section">
        <h3>Stage-to-stage conversion</h3>
        <div class="sub-note">Of everyone who reached a stage, how many moved on. Your weakest link is where to spend management attention.</div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Transition</th><th class="num">Reached</th><th class="num">Advanced</th><th class="num">Conversion</th><th class="num">Lost here</th></tr></thead>
          <tbody>${(() => {
            const st = cache.stages.filter(s => s.kind !== "lost");
            return st.map((s, i) => {
              if (i === st.length - 1) return "";
              const next = st[i + 1];
              const reached = leads.filter(l => (stageById(l.stage).order || 0) >= s.order && !isLost(l)).length;
              const adv = leads.filter(l => (stageById(l.stage).order || 0) >= next.order && !isLost(l)).length;
              const pct = reached ? Math.round((adv / reached) * 100) : 0;
              const lostHere = lost.filter(l => l.lastStageOrder === s.order).length;
              return `<tr>
                <td style="font-size:12.5px">${esc(s.name)} → ${esc(next.name)}</td>
                <td class="num">${reached}</td><td class="num">${adv}</td>
                <td class="num" style="color:${pct >= 70 ? "var(--green)" : pct >= 45 ? "var(--amber)" : "var(--red)"};font-weight:700">${pct}%</td>
                <td class="num" style="color:var(--muted)">${reached - adv}</td></tr>`;
            }).join("");
          })()}</tbody></table></div>
      </div>

      <div class="section">
        <h3>Why we lose</h3>
        <div class="sub-note">Loss reasons captured at the moment a lead was marked lost.</div>
        ${reasonRows.length ? reasonRows.map(([r, n]) => {
          const pct = Math.round((n / lost.length) * 100);
          return `<div style="margin-bottom:12px">
            <div style="display:flex;font-size:13px;margin-bottom:5px"><span style="flex:1">${esc(r)}</span><b class="mono">${n} · ${pct}%</b></div>
            <div class="bar red"><b style="width:${pct}%"></b></div>
          </div>`;
        }).join("") : `<div class="empty">No losses recorded yet.</div>`}
      </div>
    </div>

    <div class="section">
      <h3>Source performance</h3>
      <div class="sub-note">The full picture: what each channel cost, what it produced, and what an admission from it actually costs.</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Source</th><th class="num">Spend</th><th class="num">Leads</th><th class="num">Cost/lead</th><th class="num">Enrolled</th><th class="num">Conv.</th><th class="num">Cost/adm.</th><th class="num">Fee revenue</th><th class="num">ROI</th></tr></thead>
        <tbody>${cache.sources.map(s => {
          const ls = leads.filter(l => l.sourceId === s.id);
          const w = ls.filter(isWon);
          const rev = w.reduce((sum, l) => sum + courseById(l.courseId).fee, 0);
          return { s, n: ls.length, w: w.length, rev, conv: ls.length ? Math.round((w.length / ls.length) * 100) : 0 };
        }).filter(r => r.n).sort((a, b) => b.rev - a.rev).map(r => `
          <tr>
            <td><b>${esc(r.s.name)}</b></td>
            <td class="num">${moneyShort(r.s.spend)}</td>
            <td class="num">${r.n}</td>
            <td class="num">${r.n ? moneyShort(r.s.spend / r.n) : "—"}</td>
            <td class="num">${r.w}</td>
            <td class="num" style="color:${r.conv >= 20 ? "var(--green)" : r.conv >= 10 ? "var(--amber)" : "var(--red)"}">${r.conv}%</td>
            <td class="num">${r.w ? moneyShort(r.s.spend / r.w) : "—"}</td>
            <td class="num">${moneyShort(r.rev)}</td>
            <td class="num" style="font-weight:700;color:${r.s.spend && r.rev / r.s.spend >= 3 ? "var(--green)" : "var(--ink)"}">${r.s.spend ? (r.rev / r.s.spend).toFixed(1) + "×" : "organic"}</td>
          </tr>`).join("")}
      </tbody></table></div>
    </div>

    <div class="grid2">
      <div class="section">
        <h3>Counsellor performance</h3>
        <div class="sub-note">Conversion and responsiveness, not just volume.</div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Counsellor</th><th class="num">Leads</th><th class="num">Enrolled</th><th class="num">Conv.</th><th class="num">Avg response</th><th class="num">Calls</th><th class="num">Overdue</th></tr></thead>
          <tbody>${cache.users.filter(u => u.role !== "admin").map(u => {
            const mine = cache.leads.filter(l => l.ownerId === u.id);
            const w = mine.filter(isWon).length;
            const acts = cache.activities.filter(a => a.userId === u.id && a.type === "call").length;
            const overdue = cache.tasks.filter(t => !t.done && t.userId === u.id && t.dueAt < startOfToday()).length;
            const resp = mine.map(l => l.firstResponseMins).filter(v => v != null);
            const avgR = resp.length ? Math.round(resp.reduce((a, b) => a + b, 0) / resp.length) : null;
            const conv = mine.length ? Math.round((w / mine.length) * 100) : 0;
            return { u, n: mine.length, w, conv, avgR, acts, overdue };
          }).sort((a, b) => b.conv - a.conv).map(r => `
            <tr>
              <td><b>${esc(r.u.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(r.u.role)}</div></td>
              <td class="num">${r.n}</td>
              <td class="num" style="color:var(--green)">${r.w}</td>
              <td class="num" style="font-weight:700;color:${r.conv >= 20 ? "var(--green)" : r.conv >= 10 ? "var(--amber)" : "var(--red)"}">${r.conv}%</td>
              <td class="num">${r.avgR == null ? "—" : r.avgR + "m"}</td>
              <td class="num">${r.acts}</td>
              <td class="num" style="color:${r.overdue ? "var(--red)" : "var(--muted)"}">${r.overdue}</td>
            </tr>`).join("")}
        </tbody></table></div>
      </div>

      <div class="section">
        <h3>Enquiry volume — last 12 weeks</h3>
        <div class="sub-note">Weekly intake. Spot the campaign spikes and the dead weeks.</div>
        <div class="mini-bars">
          ${weeks.map(w => `<i class="${w.n === wkMax ? "hi" : ""}" style="height:${Math.max(3, (w.n / wkMax) * 100)}%" title="${w.n} enquiries"></i>`).join("")}
        </div>
        <div class="mini-labels">${weeks.map((w, i) => `<span>${i % 2 === 0 ? new Date(w.start).toLocaleDateString([], { day: "numeric", month: "short" }) : ""}</span>`).join("")}</div>
        <div class="hint" style="margin-top:14px">Peak week: <b>${wkMax}</b> enquiries · total in period: <b>${weeks.reduce((a, b) => a + b.n, 0)}</b></div>
      </div>
    </div>

    <div class="section">
      <h3>Programme demand vs capacity</h3>
      <div class="sub-note">Where the seats actually are, and where you are over-recruiting.</div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Programme</th><th class="num">Enquiries</th><th class="num">In pipeline</th><th class="num">Enrolled</th><th class="num">Seats</th><th style="width:150px">Fill</th><th class="num">Revenue</th></tr></thead>
        <tbody>${cache.courses.map(c => {
          const ls = leads.filter(l => l.courseId === c.id);
          const w = ls.filter(isWon).length;
          const pct = c.seats ? Math.round((w / c.seats) * 100) : 0;
          return `<tr>
            <td><b>${esc(c.name)}</b><div style="font-size:11.5px;color:var(--muted)">${esc(c.intake || "")} · ${money(c.fee)}</div></td>
            <td class="num">${ls.length}</td>
            <td class="num">${ls.filter(isOpen).length}</td>
            <td class="num" style="color:var(--green)">${w}</td>
            <td class="num">${c.seats}</td>
            <td><div class="bar ${pct >= 90 ? "green" : pct >= 50 ? "amber" : "red"}"><b style="width:${Math.min(100, pct)}%"></b></div>
                <div style="font-size:11px;color:var(--muted);margin-top:4px">${pct}% · ${seatsLeft(c.id)} left</div></td>
            <td class="num">${moneyShort(w * c.fee)}</td></tr>`;
        }).join("")}</tbody></table></div>
    </div>`;
}
