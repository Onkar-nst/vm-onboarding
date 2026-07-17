// Onboarding Academy — demo seed.
// Transforms the demo course content in data.js (COURSE) into database
// collections on first run. Real deployments set loadDemoSeed:false and
// author courses in the built-in Course Builder instead.

async function loadSeedIfEmpty() {
  const seeded = await Store.getMeta("seeded");
  const courses = await Store.list("courses");
  if (seeded || courses.length) return false;
  await writeSeed();
  return true;
}

async function writeSeed() {
  const now = Date.now();

  await Store.put("settings", {
    id: "settings",
    orgName: "Team VM",
    adminPin: "1234"
  });

  // demo course from data.js
  const courseId = "CRS-001";
  await Store.put("courses", {
    id: courseId,
    title: "Editor Onboarding — Short-Form Video",
    tagline: COURSE.tagline,
    icon: "🎬",
    active: true,
    order: 1,
    finalQuiz: {
      passScore: COURSE.finalQuiz.passScore,
      questions: COURSE.finalQuiz.questions.map(q => ({ q: q.q, options: [...q.options], correct: q.correct }))
    },
    assignment: {
      title: COURSE.finalEdit.title,
      brief: COURSE.finalEdit.brief,
      checklist: [...COURSE.finalEdit.checklist]
    },
    createdAt: now
  });

  let order = 1;
  for (const m of COURSE.modules) {
    await Store.put("modules", {
      id: "MOD-" + m.id,
      courseId,
      order: order++,
      title: m.title,
      icon: m.icon,
      minutes: m.minutes,
      intro: m.intro,
      sections: m.sections.map(s => ({ h: s.h, body: s.body })),
      quiz: { q: m.quiz.q, options: [...m.quiz.options], correct: m.quiz.correct, explain: m.quiz.explain }
    });
  }

  await Store.put("people", { id: "PPL-001", name: "Priya (Lead)", role: "lead", active: true, createdAt: now });
  await Store.put("people", { id: "PPL-002", name: "Arjun", role: "trainee", active: true, createdAt: now });

  // demo trainee mid-way through, with a submission waiting for review
  await Store.put("progress", {
    id: "PPL-002:" + courseId,
    personId: "PPL-002",
    courseId,
    passed: COURSE.modules.map(m => "MOD-" + m.id),           // all modules done
    wrongAnswers: [
      { moduleId: "MOD-pacing", module: "Pacing", question: COURSE.modules[1].quiz.q, picked: COURSE.modules[1].quiz.options[0], at: now - 86400000 }
    ],
    finalQuiz: { score: 7, total: COURSE.finalQuiz.questions.length, wrong: [COURSE.finalQuiz.questions[2].q], at: now - 82800000 }
  });
  await Store.put("submissions", {
    id: "SUB-001",
    personId: "PPL-002",
    courseId,
    link: "https://drive.google.com/demo-final-edit",
    notes: "Struggled a bit with the collage hook guides — flagged where I wasn't sure.",
    checklist: COURSE.finalEdit.checklist.map(() => true),
    at: now - 79200000,
    status: "submitted",   // submitted | changes_requested | approved
    feedback: "",
    gapItems: [],
    reviewedAt: null
  });

  await Store.setMeta("seq.PPL", 10);
  await Store.setMeta("seq.SUB", 10);
  await Store.setMeta("seq.CRS", 10);
  await Store.setMeta("seq.MOD", 100);
  await Store.setMeta("seeded", true);
}
