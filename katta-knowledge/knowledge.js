// Katta Knowledge Interface — DEMO episode knowledge base (seed data).
// On first run seed.js writes these into the database; after that the app
// reads episodes from the Store, and new episodes are authored in the
// admin panel (or imported as JSON). The local answer engine scores
// segments against your question and cites episode + exact timestamp.
// (In production swap search() for embeddings + an LLM; the UI is unchanged.)

const SEED_EPISODES = [
  {
    id: "katta-01",
    no: 1,
    title: "Poker Brain: Decision-Making Under Uncertainty",
    date: "2025-09-04",
    duration: "58:12",
    hue: 24,
    topics: ["GTO", "poker", "decisions", "variance"],
    segments: [
      {
        t: "14:32",
        keywords: ["gto", "game", "theory", "optimal", "poker", "strategy", "exploit", "balanced"],
        text: "GTO stands for Game Theory Optimal. It comes from poker: a GTO player plays a mathematically balanced strategy that cannot be exploited, no matter what the opponent does. The insight for business is that you don't play to outguess one opponent — you build a default strategy that stays profitable against any response. In the Katta we framed it as: have a baseline playbook that doesn't depend on predicting people, then deviate only when someone shows you a clear, repeated weakness."
      },
      {
        t: "27:05",
        keywords: ["variance", "luck", "outcome", "process", "results", "judge", "decision"],
        text: "Judge decisions by process, not outcomes. In poker you can play a hand perfectly and lose — that's variance, not error. The same is true in hiring, launches and content: a good decision that fails is still a good decision. Keep a decision journal, write down why you made the call before you see the result, and review the reasoning later. Over a big enough sample, good process wins."
      },
      {
        t: "41:48",
        keywords: ["fold", "quit", "sunk", "cost", "kill", "project", "stop"],
        text: "Folding is a skill. The best players fold most hands; the best operators kill most projects early. Sunk cost is the tax you pay for refusing to fold. The rule from the session: set the kill criteria on day one — 'if this doesn't hit X by date Y, we stop' — so the decision to quit is made by the calm version of you, not the invested one."
      }
    ]
  },
  {
    id: "katta-02",
    no: 2,
    title: "Hiring: Slope Over Intercept",
    date: "2025-09-18",
    duration: "1:04:40",
    hue: 152,
    topics: ["hiring", "interviews", "talent", "culture"],
    segments: [
      {
        t: "09:14",
        keywords: ["good", "hire", "hiring", "great", "trait", "slope", "intercept", "learning", "talent", "candidate"],
        text: "What makes a good hire? Slope over intercept. Intercept is where someone starts — their current skills and pedigree. Slope is how fast they improve. In a company moving quickly, an average-intercept, high-slope person overtakes a high-intercept, flat-slope person within a year. In interviews we test slope directly: give a small real task, give honest feedback midway, and watch what they do with the feedback. The ones who fold the feedback in immediately are the hires."
      },
      {
        t: "22:51",
        keywords: ["ownership", "responsibility", "excuses", "blame", "accountability"],
        text: "The second trait is ownership. An owner talks about what they controlled; a passenger talks about what happened to them. Ask someone to walk you through a failure. Owners say 'I misjudged the timeline.' Passengers say 'the client kept changing things.' Both may be true — but only one of those people gets better next time, and only one of them can be left alone with a problem."
      },
      {
        t: "47:20",
        keywords: ["culture", "fit", "add", "values", "team", "diversity"],
        text: "Stop hiring for culture fit and start hiring for culture add. Fit optimizes for comfort — a room of people who agree quickly. Add optimizes for coverage — someone who brings a muscle the team doesn't have. The test question from the Katta: 'What will this person disagree with us about, and do we need that disagreement?' If you can't name it, you're hiring a mirror."
      }
    ]
  },
  {
    id: "katta-03",
    no: 3,
    title: "Coordination Costs: Why Companies Slow Down",
    date: "2025-10-02",
    duration: "49:58",
    hue: 205,
    topics: ["management", "writing", "meetings", "scale"],
    segments: [
      {
        t: "06:40",
        keywords: ["coordination", "cost", "costs", "scale", "slow", "communication", "alignment", "leadership"],
        text: "Leadership is mostly a war on coordination costs. Every person you add creates new communication lines, and the lines grow faster than the headcount. The fix is not more meetings — it's shared visibility. If everybody can see what everybody is doing (dashboards on the wall, written weekly notes, one source of truth), alignment happens ambiently, without anyone scheduling a call. When we see each channel's numbers on one screen, nobody has to ask 'how are we doing?'"
      },
      {
        t: "18:22",
        keywords: ["writing", "document", "memo", "write", "culture", "onboarding", "knowledge"],
        text: "Writing reduces coordination costs more than any tool. A decision that lives in one person's head must be re-explained forever; a decision written down is explained once. The house rule: if you've answered the same question twice, write the answer down and link it the third time. Onboarding, process, style rules — all of it written, so a new person can be productive on day one without borrowing a senior's whole day."
      },
      {
        t: "35:10",
        keywords: ["meetings", "meeting", "agenda", "async", "calendar", "time"],
        text: "Meetings are the most expensive way to move information. Default to async: written updates that people read on their own time. Reserve live meetings for the two things async is bad at — debate and morale. And every meeting that survives needs an owner, a written agenda, and a decision at the end, otherwise it was a status email wearing a calendar slot."
      }
    ]
  },
  {
    id: "katta-04",
    no: 4,
    title: "Risk: What to Automate, What to Guard",
    date: "2025-10-16",
    duration: "55:31",
    hue: 268,
    topics: ["risk", "software", "automation", "AI"],
    segments: [
      {
        t: "11:03",
        keywords: ["risk", "quantify", "software", "vibe", "coding", "ai", "build", "internal", "tools"],
        text: "Quantify every project by risk before you build it. The question is never 'can AI build this?' — it's 'what happens if this breaks at 2am?' A read-only dashboard that shows wrong numbers for an hour costs you nothing; a payments flow that's wrong for an hour costs you trust. So the ladder is: read-only tools first, then internal CRUD tools, then external tools, and only with real engineering review at the top of the ladder. Ninety percent of the tools a company needs live on the bottom two rungs."
      },
      {
        t: "29:47",
        keywords: ["crud", "create", "read", "update", "delete", "apps", "overpriced", "saas"],
        text: "Most business software is CRUD — create, read, update, delete — with a nice interface. For years that simplicity was hidden behind enterprise pricing. Once you can generate a CRUD tool in an afternoon, paying six figures a year for a form on top of a database stops making sense. What you're really paying vendors for now is liability and support — so for internal tools, where you are your own support, build it yourself."
      },
      {
        t: "44:12",
        keywords: ["failure", "blast", "radius", "rollback", "backup", "production"],
        text: "Design for blast radius, not for perfection. Assume the tool will fail; decide in advance how far the damage can spread. Read-only APIs, separate accounts for anything that writes, backups before every migration, and a manual override for every automation. A tool that fails loudly and small is production-ready; a tool that fails quietly and wide is a time bomb."
      }
    ]
  },
  {
    id: "katta-05",
    no: 5,
    title: "Distribution: Owning the Pipe",
    date: "2025-10-30",
    duration: "1:01:27",
    hue: 8,
    topics: ["distribution", "channels", "audience", "content"],
    segments: [
      {
        t: "07:55",
        keywords: ["distribution", "channel", "channels", "multiple", "audience", "build", "moat"],
        text: "Product gets you in the game; distribution decides who wins it. And one channel is not distribution — it's a dependency. The playbook from the session: run multiple channels across platforms, let each have its own identity, and accept that at any moment one is spiking while another is flat. That's not chaos, that's a portfolio. The moment you see them all on one dashboard, you stop panicking about single-channel dips and start noticing portfolio trends."
      },
      {
        t: "24:18",
        keywords: ["hook", "attention", "retention", "first", "seconds", "short", "form"],
        text: "On short-form, the first three to six seconds are the entire game. The viewer decides to stay before they've heard your argument, so the hook is not an intro — it's a promise with tension in it. Show the payoff visual immediately, open a loop the viewer needs closed, and never spend the first seconds on your name or a logo. Retention graphs don't lie: fix second three before you polish minute two."
      },
      {
        t: "50:02",
        keywords: ["speed", "trend", "news", "fast", "publish", "moment"],
        text: "Speed is a distribution strategy. When news breaks, the first good take wins most of the attention; the best take that ships six hours late fights for scraps. That's why the process is codified — templates, checklists, pre-agreed styles — so a breaking-news reel can go from announcement to published in twenty minutes without a quality collapse. You can only be fast if you've decided things in advance."
      }
    ]
  },
  {
    id: "katta-06",
    no: 6,
    title: "Leverage: Doing More Per Decision",
    date: "2025-11-13",
    duration: "52:44",
    hue: 45,
    topics: ["leverage", "delegation", "systems", "compounding"],
    segments: [
      {
        t: "12:30",
        keywords: ["leverage", "code", "media", "labor", "capital", "compound"],
        text: "Leverage is output per decision. Labor and capital are the old levers; code and media are the new ones, because they work while you sleep and cost nothing to replicate. A video explains something once to a million people; a tool answers a question forever. The session's framing: every week, convert at least one repeated human effort into either a piece of media or a piece of software. That's how a small team behaves like a big one."
      },
      {
        t: "26:44",
        keywords: ["delegation", "delegate", "trust", "outcome", "micromanage", "brief"],
        text: "Delegate outcomes, not tasks. A task brief creates a human API you have to keep calling; an outcome brief creates an owner. Say what done looks like, the constraints, and the deadline — then resist the urge to specify the how. The first two deliveries will be 80% of what you'd have done, and the third will be better than yours. Micromanagement is choosing permanent 100% over compounding 120%."
      },
      {
        t: "39:58",
        keywords: ["checklist", "system", "process", "repeatable", "quality", "codify"],
        text: "If it happens twice, it's a process; if it's a process, it gets a checklist. Codifying isn't bureaucracy — it's how you make quality boring. Every editing style, every launch, every onboarding gets written down as steps with owners. Creativity lives inside the checklist's gaps, and the checklist is what lets a new person produce house-quality work in week one."
      }
    ]
  },
  {
    id: "katta-07",
    no: 7,
    title: "Money Talks: Pricing and Negotiation",
    date: "2025-11-27",
    duration: "57:09",
    hue: 190,
    topics: ["pricing", "negotiation", "value", "sales"],
    segments: [
      {
        t: "10:26",
        keywords: ["pricing", "price", "value", "charge", "anchor", "cost"],
        text: "Price on value, not on cost. Your cost structure is your problem; the customer only weighs the price against what the outcome is worth to them. Anchor high with a version that includes everything, let the middle option be the one you actually want to sell, and never apologize for a price you can justify with outcomes. If nobody ever says 'that's expensive', you're leaving money on the table."
      },
      {
        t: "31:40",
        keywords: ["negotiation", "batna", "walk", "away", "alternative", "leverage", "deal"],
        text: "Your real power in any negotiation is your best alternative — what happens if this deal dies. Build the alternative before the negotiation, not during it: a second buyer, a second supplier, a pipeline. Then you can be warm in tone and hard on numbers, because you're not negotiating from fear. The person who can genuinely walk away rarely has to."
      },
      {
        t: "45:03",
        keywords: ["free", "cheap", "positioning", "premium", "discount", "brand"],
        text: "Discounts are a drug: instant relief, long-term positioning damage. Instead of cutting price, cut scope — same rate, smaller package. It protects the price integrity of the full offering and gives the buyer a real choice instead of a signal that your first number was fiction."
      }
    ]
  },
  {
    id: "katta-08",
    no: 8,
    title: "Learning Speed: The Only Durable Edge",
    date: "2025-12-11",
    duration: "50:15",
    hue: 320,
    topics: ["learning", "feedback", "skills", "career"],
    segments: [
      {
        t: "08:47",
        keywords: ["learning", "learn", "fast", "skill", "edge", "career", "compound"],
        text: "In a world where tools change every six months, the durable edge isn't any single skill — it's the speed at which you acquire the next one. Learning speed compounds like interest: the person who learns 10% faster isn't 10% ahead in five years, they're operating in a different league. Protect learning time on the calendar like revenue depends on it, because eventually it does."
      },
      {
        t: "21:33",
        keywords: ["feedback", "loop", "iterate", "ship", "public", "critique"],
        text: "Shorten the feedback loop and learning takes care of itself. Ship small things in public, get judged, adjust, repeat. One real critique from the market teaches more than a month of private polishing. The practical rule from the session: nothing sits unshipped for more than a week — cut scope until a week is enough."
      },
      {
        t: "36:59",
        keywords: ["teach", "explain", "writing", "understand", "feynman"],
        text: "The fastest way to find the holes in your understanding is to explain the thing to someone else. If you can't write it simply, you don't know it yet. That's the second reason for a writing culture: every document someone writes to teach the team is also the moment the writer discovers what they'd been faking."
      }
    ]
  }
];

// Suggested questions shown as chips under the input
const SUGGESTIONS = [
  "What is GTO?",
  "What makes a good hire?",
  "How do we reduce coordination costs?",
  "What should we vibe code first?",
  "Why do we need multiple channels?",
  "How should I price our work?",
  "How do I delegate without micromanaging?",
  "How do I learn faster?"
];
