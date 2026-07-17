// VM Onboarding — course content
// Eight short modules. Each module ends with a quick-check MCQ that must be
// passed to unlock the next one. After all eight: a final quiz, then the
// Final Edit assignment.

const COURSE = {
  team: "Team VM",
  tagline: "Everything you need to start editing on day one.",
  modules: [
    {
      id: "welcome",
      title: "Welcome & Setup",
      minutes: 4,
      icon: "👋",
      intro: "Where everything lives, and how your machine should be set up before you touch a timeline.",
      sections: [
        {
          h: "Where assets live",
          body: `All raw footage, project files and exports live in one place so nobody ever hunts for files:
          <ul>
            <li><b>Raw reels footage:</b> <code>R:/VM/reels/&lt;date&gt;-&lt;slug&gt;/raw</code></li>
            <li><b>Project files:</b> <code>R:/VM/reels/&lt;date&gt;-&lt;slug&gt;/project</code></li>
            <li><b>Brand assets (logos, lower-thirds, SFX):</b> <code>R:/VM/assets</code></li>
            <li><b>Final exports:</b> <code>R:/VM/exports</code> — never export to your desktop.</li>
          </ul>
          If a folder doesn't exist yet, copy the <code>_TEMPLATE</code> folder. Never invent your own structure.`
        },
        {
          h: "Project settings",
          body: `Every reel is a vertical <b>1080 &times; 1920</b> sequence in Premiere Pro, 30fps, square pixels.
          Name the sequence <code>&lt;date&gt;-&lt;slug&gt;-v1</code>. Autosave every 5 minutes to the project folder.
          Long-form videos are 3840 &times; 2160 — but you will not touch long-form until week two.`
        },
        {
          h: "The one rule you must know today",
          body: `<b>For at least 90% of a reel, VM's face should NOT be on screen.</b>
          The face appears only to punch a key line. Everything else is visuals: screen recordings,
          articles, B-roll, typography. If your timeline is a talking head, you've done it wrong.`
        }
      ],
      quiz: {
        q: "Roughly how much of a reel should NOT show VM's face?",
        options: ["About 30%", "About 50%", "At least 90%", "It doesn't matter as long as the audio is clean"],
        correct: 2,
        explain: "The face is a punctuation mark, not the wallpaper. At least 90% of the reel is visuals, not the talking head."
      }
    },
    {
      id: "pacing",
      title: "Pacing",
      minutes: 5,
      icon: "⚡",
      intro: "Speed is the house style. Here is how we keep a viewer for 40 straight seconds.",
      sections: [
        {
          h: "Cut every silence",
          body: `The voice track (recorded or ElevenLabs-generated) gets every breath and gap removed
          before anything else happens. Target gap between sentences: <b>&le; 150ms</b>.
          The pipeline order is fixed: <b>clean the audio first → export the paced file → only then generate
          the avatar / start the edit</b>. Pacing decisions made on dirty audio are wasted work.`
        },
        {
          h: "A new visual every 2–3 seconds",
          body: `Something on screen must change every 2–3 seconds: a cut, a zoom step, a new image,
          a highlight. A shot that sits still for 5+ seconds is a bug. Zoom steps are digital and snappy
          (no slow Ken Burns drifts) — <b>in on the key word, out on the sentence end</b>.`
        },
        {
          h: "Music & SFX",
          body: `One music bed per reel, ducked -18dB under voice. Whooshes only on scene changes,
          never on every cut. If you can hear the edit, the edit is too loud.`
        }
      ],
      quiz: {
        q: "After cutting silences from the ElevenLabs audio, what comes next?",
        options: [
          "Color grade the footage",
          "Export the paced audio file, then generate the avatar",
          "Add the music bed",
          "Write the subtitles"
        ],
        correct: 1,
        explain: "Audio is the skeleton: clean it, export the paced file, and only then generate the avatar and cut visuals to it."
      }
    },
    {
      id: "hook",
      title: "Hook & Intro",
      minutes: 5,
      icon: "🎣",
      intro: "The first 3–6 seconds decide everything. We never open cold.",
      sections: [
        {
          h: "The first frame",
          body: `The first frame is a designed composition, not a random still. Show VM <b>with the hook
          visual</b> — the product, the headline, the chart — never as a plain talking head.
          If the reel is about a robot, frame one contains the robot.`
        },
        {
          h: "The reference collage hook",
          body: `Our standard opener is the <b>collage hook</b>: VM small at the bottom, and a collage of
          2–4 reference visuals (screenshots, headlines, thumbnails) filling the frame above.
          Guides and rulers for this layout are saved in <code>R:/VM/assets/guides</code> — snap to them,
          don't eyeball it.`
        },
        {
          h: "Hook copy on screen",
          body: `The hook line appears as large typography within the first second, maximum 7 words,
          and it must create an open loop — a question the viewer needs answered. Never start a reel with
          "Hey guys" energy. Start mid-action.`
        }
      ],
      quiz: {
        q: "How should VM appear in the opening frame of a reel?",
        options: [
          "Full-screen talking head, centered",
          "Not at all — visuals only for the first 10 seconds",
          "With the hook visual (e.g. as a collage composition), never as a plain talking head",
          "Bottom-right corner, webcam style"
        ],
        correct: 2,
        explain: "First frame = VM + the hook visual. The collage composition is the house opener; a plain talking head is never the hook."
      }
    },
    {
      id: "ai-assets",
      title: "AI Asset Generation",
      minutes: 6,
      icon: "🤖",
      intro: "We use AI-generated assets like a surgeon uses a scalpel — precisely, and rarely.",
      sections: [
        {
          h: "The anti-slop rule",
          body: `AI B-roll is seasoning, not the meal. Maximum <b>10–15% of a reel</b> may be AI-generated
          imagery, used only when no real asset exists (a concept, a future scene, an abstract idea).
          If a real screenshot, product shot or article exists — use the real thing. A fully AI-generated
          video is slop, and slop is a fireable edit.`
        },
        {
          h: "Which model for which job",
          body: `<ul>
            <li><b>Voice:</b> ElevenLabs, VM's cloned voice profile. Never ship a take with robotic artifacts — regenerate.</li>
            <li><b>Avatar video:</b> our in-house fine-tuned open-source avatar pipeline; HeyGen only as fallback for quick-turnaround client work.</li>
            <li><b>Still images:</b> the approved image model presets in <code>R:/VM/assets/ai-presets</code>. House style: clean, photographic, no plastic AI faces.</li>
          </ul>`
        },
        {
          h: "Prompt like an editor",
          body: `Prompt for the exact frame you need ("isometric server room, warm key light, 9:16")
          — not a vibe ("cool tech background"). Generate 4, pick 1, and always color-match the pick
          to the reel's grade so it doesn't float.`
        }
      ],
      quiz: {
        q: "What is the ceiling for AI-generated imagery in a single reel?",
        options: [
          "There is no ceiling if it looks good",
          "Around 10–15%, and only when no real asset exists",
          "50%, as long as the hook is real footage",
          "AI imagery is completely banned"
        ],
        correct: 1,
        explain: "Use AI assets precisely, like a surgeon: ~10–15% max, and only where a real asset doesn't exist."
      }
    },
    {
      id: "broll",
      title: "B-Rolls & Screenshots",
      minutes: 5,
      icon: "🎬",
      intro: "Real material beats generated material. Here's how we capture and treat it.",
      sections: [
        {
          h: "Screenshots are evidence",
          body: `Screenshots of articles, tweets and websites are our proof layer. Capture at 2&times; retina,
          crop tight to the claim, and highlight the exact line with the house yellow marker
          (<code>#FFD84D</code>, 65% opacity). One idea per screenshot — never show a full page and hope
          the viewer finds the point.`
        },
        {
          h: "No watermarked or low-res pulls",
          body: `Never use watermarked stock, other creators' edits, or anything below 1080p.
          If the perfect clip exists but is low quality, find the original source or reshoot it.
          Getty-style watermarks in a frame are an instant reject.`
        },
        {
          h: "Motion on stills",
          body: `Every still gets subtle motion: a 2–4% scale-up over its duration, or a snap zoom onto
          the highlighted line. Stills that just sit there read as slideshows — we don't ship slideshows.`
        }
      ],
      quiz: {
        q: "How should a news article appear in a reel?",
        options: [
          "Full-page screenshot so viewers can read everything",
          "Tightly cropped at 2×, with the key line highlighted in the house yellow",
          "As a link in the caption",
          "Read aloud with no visual"
        ],
        correct: 1,
        explain: "Crop tight to the claim, retina-quality, house-yellow highlight on the exact line. One idea per screenshot."
      }
    },
    {
      id: "articles",
      title: "Articles & Collages",
      minutes: 4,
      icon: "📰",
      intro: "Turning written sources into frames that read in under a second.",
      sections: [
        {
          h: "The article treatment",
          body: `House article style: white card, 12px rounded corners, soft shadow, source logo top-left,
          headline enlarged. The card floats over a blurred, darkened still related to the story.
          Template lives at <code>R:/VM/assets/templates/article-card.mogrt</code> — use it, don't rebuild it.`
        },
        {
          h: "Collage composition",
          body: `Collages (used in hooks and comparison beats) are built on the saved guide grid:
          VM at the bottom third, 2–4 elements above, each element with a 4px white border and a slight
          rotation between -3° and 3°. Never overlap faces. Maximum 4 elements — 5+ reads as noise.`
        }
      ],
      quiz: {
        q: "What is the maximum number of elements in a collage composition?",
        options: ["2", "4", "6", "As many as fit"],
        correct: 1,
        explain: "2–4 elements on the guide grid. Five or more stops reading as a composition and starts reading as noise."
      }
    },
    {
      id: "typography",
      title: "Typography & Subtitles",
      minutes: 5,
      icon: "🔤",
      intro: "Type is our second voice. It has exactly one style, and everyone uses it.",
      sections: [
        {
          h: "The type system",
          body: `Two faces only: the house display font for hook lines and section titles, and the house
          sans for subtitles and labels. No third font, ever. Display type is set in Title Case, max 7 words,
          with the key word in accent color <code>#FF5C29</code>.`
        },
        {
          h: "Subtitles",
          body: `Subtitles are burned in, 3–5 words per card, synced to the word. Position: lower third,
          never covering a face or a highlighted line. Style: house sans bold, white with 90% black
          outline, no background box. Every caption is proofread — a typo in a reel with 1M views is a
          typo seen a million times.`
        },
        {
          h: "Emphasis rules",
          body: `One emphasis per sentence, maximum. Emphasis = accent color or a 110% pop on the word,
          never both at once, and never underlines or drop shadows from 2014.`
        }
      ],
      quiz: {
        q: "How many words per subtitle card?",
        options: ["1 word, always", "3–5 words, synced to the word", "A full sentence", "Whatever fits in two lines"],
        correct: 1,
        explain: "3–5 words per card, word-synced, lower third, never covering a face or a highlight."
      }
    },
    {
      id: "audio-export",
      title: "Audio & Export",
      minutes: 4,
      icon: "🎚️",
      intro: "The last mile: loudness, filenames, and where the file goes.",
      sections: [
        {
          h: "Loudness targets",
          body: `Voice peaks at <b>-3dB</b>, integrated loudness around <b>-14 LUFS</b> for platform delivery.
          Music bed sits -18dB under voice; SFX -12dB. Do a full headphone pass before export — laptop
          speakers hide mud.`
        },
        {
          h: "Export settings",
          body: `H.264, 1080 &times; 1920, 30fps, VBR 2-pass, target 16 Mbps. Filename:
          <code>&lt;date&gt;-&lt;slug&gt;-v&lt;n&gt;.mp4</code> into <code>R:/VM/exports</code>.
          Thumbnails and covers export as PNG alongside.`
        },
        {
          h: "The handoff",
          body: `Post the export link in the reel's thread with: version number, runtime, and any open
          questions. An export without a note is not a handoff — it's a file nobody knows exists.`
        }
      ],
      quiz: {
        q: "Which export settings are correct for a reel?",
        options: [
          "H.264, 1920×1080, 60fps",
          "ProRes 422, 1080×1920, 30fps",
          "H.264, 1080×1920, 30fps, VBR 2-pass",
          "H.265, 4K, CBR"
        ],
        correct: 2,
        explain: "Vertical 1080×1920 at 30fps, H.264, VBR 2-pass at ~16 Mbps, exported to R:/VM/exports with the standard filename."
      }
    }
  ],

  finalQuiz: {
    title: "Final Quiz",
    passScore: 5,
    questions: [
      {
        q: "For at least how much of a reel should VM's face be OFF screen?",
        options: ["50%", "70%", "90%", "100%"],
        correct: 2
      },
      {
        q: "What is the correct sequence setting for a reel?",
        options: ["1920×1080 @ 30fps", "1080×1920 @ 30fps", "1080×1920 @ 60fps", "3840×2160 @ 24fps"],
        correct: 1
      },
      {
        q: "Something on screen should change every…",
        options: ["0.5 seconds", "2–3 seconds", "5–7 seconds", "10 seconds"],
        correct: 1
      },
      {
        q: "The standard hook is…",
        options: [
          "A plain talking head",
          "A black screen with music",
          "VM with the hook visual — e.g. the reference collage composition",
          "A subscribe animation"
        ],
        correct: 2
      },
      {
        q: "AI-generated imagery in a reel should be…",
        options: [
          "Most of the reel to save time",
          "~10–15% max, only where no real asset exists",
          "Banned entirely",
          "Used for all B-roll"
        ],
        correct: 1
      },
      {
        q: "Article screenshots are…",
        options: [
          "Full-page, so nothing is hidden",
          "Cropped tight, 2× quality, key line highlighted in house yellow",
          "Replaced by reading the article aloud",
          "Linked in the caption"
        ],
        correct: 1
      },
      {
        q: "Subtitles are…",
        options: [
          "3–5 words per card, word-synced, lower third",
          "Full sentences, top of frame",
          "Optional if the audio is clear",
          "Auto-generated and shipped unproofed"
        ],
        correct: 0
      },
      {
        q: "The final export goes…",
        options: [
          "To your desktop, then WhatsApp",
          "To R:/VM/exports with the standard filename, plus a handoff note in the thread",
          "Straight to the platform from Premiere",
          "To a USB stick on the gear shelf"
        ],
        correct: 1
      }
    ]
  },

  finalEdit: {
    title: "Your Final Edit",
    brief: `Edit <b>one short reel</b> today using everything above. Raw footage and the voice track are in
    <code>R:/VM/onboarding/final-edit</code>. Run it against the checklist below yourself first,
    then submit it for review. A lead will watch it and give you feedback only on your gaps.`,
    checklist: [
      "Sequence is 1080×1920 @ 30fps with the standard filename",
      "VM's face is on screen under 10% of the runtime",
      "Strong hook with the hook visual in the very first frame",
      "Silences cut — no gap longer than ~150ms",
      "A visual change every 2–3 seconds",
      "Screenshots cropped tight with house-yellow highlights",
      "Typography follows the two-font system, key words in accent color",
      "Subtitles 3–5 words, word-synced, proofread",
      "Voice at -3dB peak, music ducked -18dB",
      "Exported H.264 VBR 2-pass to the exports folder with a handoff note"
    ]
  }
};
