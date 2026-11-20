# 🎬 OFurry Edições (`ofurry-edicoes`)

**The editing hub of the OFurry YouTube channel** (personal finance, pt-BR, fox mascot "Furry"). The channel owner
brings a script + recorded narration; this repo cuts it by sentence, builds the motion scenes in the channel's style
(kinetic captions on black, icon "stages" where icons move and interact, data scenes like charts/tables/scales,
the animated mascot, flash jokes), mixes a continuous music bed and event-based sound effects, and renders the
finished **1920x1080 MP4** on the GPU.

> **Start at [`INDEX.md`](INDEX.md)** (pt-BR): how to navigate the repo and the asset folders on the PC.
> Editing standard: [`docs/padrao-edicao-ofurry.md`](docs/padrao-edicao-ofurry.md). Owner's taste, in his own words:
> [`docs/preferencias-do-joao.md`](docs/preferencias-do-joao.md). Full example: [`videos/177/`](videos/177/).

Scenes are rendered with **[HyperFrames](https://github.com/heygen-com/hyperframes)** (HTML + GSAP).
The visual style is not invented: it was measured frame by frame on the channel's 7 published videos
(`docs/referencias/analise-canal-2026-10.md`) and refined with the owner's feedback.

---

## ⚡ Quick start

Requirements: [Bun](https://bun.sh), Node.js 22+, FFmpeg on the PATH (Python 3 only for the reference analysis).

```bash
bun install
bun run skills:link                               # link .agents/skills into .claude/skills (Claude Code)
npx hyperframes@0.8.193 models install parakeet   # one-time: local Portuguese transcription
```

Try the demo section (the 47 s hook of the channel's best-retention video, rebuilt with the house kit):

```bash
bun run hf:build demo-gancho 1
bun run hf:render demo-gancho 1
```

Output: `videos/demo-gancho/output/trecho-01/render/` (`.mp4`; plus `-alpha.mov` with `--alpha`).

---

## 🧭 How it works

```
 narration + script
        │
        ▼
 ┌───────────────────────────┐   ofurry-organizar-video
 │ 1. Organize the video      │   folder, word-level transcript, cut into sections
 │    plano.md per section    │   (trechos), editorial plan in prose
 └─────────────┬─────────────┘
               │  you approve the plan  (Estado: APROVADO)
               ▼
 ┌───────────────────────────┐   ofurry-fazer-cenas
 │ 2. Make the scenes         │   beats.json -> HyperFrames project (house kit)
 │    check + snapshot review │   -> finished 1080p MP4 (GPU)
 └─────────────┬─────────────┘
               ▼
   join the sections into the final video
```

Both steps follow **`ofurry-house-motion`**, the channel's style guide (rules, recipes H1-H10, hook template,
icon map, delivery checklist).

---

## 🤖 Using the skills with an AI agent

The skills live in `.agents/skills/` (Codex, Gemini CLI, Antigravity and others) and are linked into
`.claude/skills/` for Claude Code. Ask the agent in plain language, for example:

> "Use **ofurry-organizar-video** to set up the video `bitcoin-2030` with the narration at `D:\gravacoes\bitcoin.wav` and the script `roteiro.md`."

> "Show me the plan for section 02." / "Approved." / "Use **ofurry-fazer-cenas** to make section 02."

The agent presents every plan in prose and waits for your approval before writing any scene.

| Skill | What it does |
|---|---|
| `ofurry-house-motion` | The channel's visual system: 10 rules, recipes H1-H10, hook template, icons, checklist |
| `ofurry-organizar-video` | Creates the video folder, transcribes, cuts sections, writes `plano.md` for approval |
| `ofurry-fazer-cenas` | Writes `beats.json`, generates the HyperFrames project, reviews and renders |
| `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `remotion-to-hyperframes` | Official HyperFrames skills: render contract, CLI, ~450 ready-made blocks, media, porting from Remotion |
| `director-orchestrator`, `motion-design`, `icon-craft` | Earlier Remotion-era skills; where they conflict with `ofurry-house-motion`, the house style wins. The `video-shotcraft` skill was removed (its 31 camera presets live on in `src/presets/`). |

---

## 📋 Step by step (manual commands)

> **Editing standard v2 (20/11/2026):** the repo edits the whole video. Read `docs/padrao-edicao-ofurry.md`
> (pt-BR). Short version: `video:novo` -> `video:transcrever` -> `midia/revisao.json` -> sections with a `de`
> (opening sentence) in `video.json` -> `video:sincronizar` -> `storyboard.md` + 1-2 pilots approved ->
> `beats.json` with `"@sentence"` anchors and `sfx` -> `trilha.json` -> `video:produzir` -> `final/<id>-final.mp4`.
> Example: `videos/177/`.

### 1. Organize the video

```bash
bun run video:novo bitcoin-2030 --titulo "The Bitcoin window" --roteiro roteiro.md --audio narracao.wav
bun run video:transcrever bitcoin-2030            # Parakeet, Portuguese, ~1 min per 9 min of audio
bun run video:buscar bitcoin-2030 "first sentence of the section" "last sentence of the section"
bun run video:cortar bitcoin-2030 01 4.15 33.05 --titulo "Hook" --bloco "GANCHO"
bun run video:status bitcoin-2030
```

- Already have captions from CapCut, Premiere or YouTube? `bun run video:transcrever <id> --importar legenda.srt`.
- **Review the transcript** (`midia/transcricao.json`) against the script before cutting: transcription
  mistakes become on-screen typos. Fix only the `text` fields, never the timings.
- `video:cortar` writes `plano.md` with every spoken line already timed. Fill in the recipe and the on-screen
  element for each line, then mark it `Estado: APROVADO`.

### 2. Make the scenes

```bash
# write videos/<id>/output/trecho-XX/beats.json from the approved plan, then:
bun run house:lint bitcoin-2030 01        # house rules: no 4 s+ static shots, no black screen with voice
bun run hf:build bitcoin-2030 01          # generates the HyperFrames project in trecho-01/hf/
cd videos/bitcoin-2030/output/trecho-01/hf
npx hyperframes@0.8.193 check --json      # render contract, layout, contrast
npx hyperframes@0.8.193 preview           # HyperFrames Studio in the browser, edit by hand if needed
cd -
bun run hf:render bitcoin-2030 01         # finished 1080p MP4 on the GPU (--draft for a quick pass, --alpha for the transparent MOV too)
```

Running `hf:build` again **overwrites** `hf/compositions/`. Make structural changes in `beats.json` and fine-tune
the HTML by hand only once the beats are final.

### `beats.json` in short

```json
{
  "id": "bitcoin-2030-trecho-01",
  "duration": 28.9,
  "audio": "midia/narracao.wav",
  "subtitlePath": "midia/narracao.json",
  "captions": [{ "from": 0.2, "until": 7.1, "entry": "whip" }],
  "backdrops": [{ "at": 0, "backdrop": "grid" }, { "at": 7.1, "backdrop": "stars" }],
  "beats": [
    { "kind": "icon", "at": 7.3, "until": 8.4, "icon": "bitcoin", "tone": "brand" },
    { "kind": "number", "at": 8.4, "until": 10.6, "value": "-80%", "caption": "in 2 years" },
    { "kind": "mascot", "at": 10.6, "until": 14.2, "poses": [{ "at": 10.6, "pose": "../../../../public/mascote/explicando.png" }] }
  ]
}
```

Beat kinds: `type-on`, `icon`, `icons`, `number`, `mascot`, `proof`, `chapter`, `section`, `thumb`, `broll`.
Full reference with every option: `.agents/skills/ofurry-fazer-cenas/references/beats-json.md`.
Complete working example: `videos/demo-gancho/output/trecho-01/beats.json`.

---

## 🎨 House style at a glance

| Rule | Value |
|---|---|
| Rhythm | something new on screen every 1-2 s, nothing static for more than 4 s |
| Kinetic captions | Montserrat ExtraBold, uppercase, white, centered, 1-2 words, 0.5-0.95 s per card |
| Fonts | Montserrat + Bebas Neue (numbers, chapter numerals), nothing else |
| Colour = meaning | green gain `#2EE04A`, red loss `#E3141B`, yellow keyword `#F4E812`, orange brand `#FF9900` |
| Backgrounds | black with film dust, perspective grid, starfield, blurred plate |
| Mascot | a breather after dense bursts, new pose every 2-4 s, mini mascot always bottom-right |
| Icons | one Lucide icon per noun the narration names, 200-380 px, with a glow |
| Hook (0-30 s) | typed question, caption burst, unnamed object, thumbnail payoff, mascot with tag, proof |

Details and recipes: `.agents/skills/ofurry-house-motion/SKILL.md`.

**Assets you provide:** mascot poses as transparent PNGs in `public/mascote/` (until then a grey placeholder
is rendered), proof screenshots in `videos/<id>/acervo/prints/`, B-roll in `videos/<id>/acervo/broll/`.

---

## 🧩 Icons: Lucide and Lucide Animated

- Any [Lucide](https://lucide.dev/icons) icon by its kebab-case name (`landmark`, `piggy-bank`, `bitcoin`).
- 468 [Lucide Animated](https://lucide-animated.com) icons (MIT) adapted to render frame by frame, in
  HyperFrames (`hf/kit/house-runtime.js`) and in Remotion (`src/lucide-animated/`). The animated version is
  used automatically when it exists; `"animated": false` forces the static one.
- Refresh the animated set: `bun run sync:lucide-animated`.
- Finance concept -> icon map: `.agents/skills/ofurry-house-motion/references/icones-financas.md`.

---

## 🔍 Analysing reference videos

```bash
bun run reference:extract "C:\path\to\folder-with-video.mp4"
```

Detects the black-background and orange-overlay motion segments and writes contact sheets, an overview grid
and `segmentos.json` next to the video. That is how the channel analysis in `docs/referencias/` was built.

---

## 📁 Project structure

```
ofurry-motion/
├── .agents/skills/            # agent skills (linked into .claude/skills for Claude Code)
├── docs/
│   ├── ADR/                   # architecture decisions
│   └── referencias/           # channel analysis + per-video catalogues
├── hf/kit/                    # HyperFrames house kit: house.css + house-runtime.js
├── scripts/
│   ├── video/                 # organize: novo, transcrever, buscar, cortar, status
│   ├── hf/                    # scenes: build-trecho, render-trecho, Lucide SVG generation
│   ├── reference/             # reference video analysis
│   ├── house-lint.ts          # house rules check for a beat sheet
│   └── sync-lucide-animated.ts
├── src/
│   ├── house/                 # shared beat sheet format, captions, lint + Remotion house kit
│   ├── lucide-animated/       # 468 animated icons + deterministic motion shim (Remotion)
│   ├── presets/  primitives/  theme/  videos/   # Remotion-era engine
│   └── Root.tsx               # Remotion compositions
├── public/                    # mascot poses, icon assets, Remotion previews
└── videos/<id>/
    ├── video.json  roteiro.md  midia/  acervo/
    └── output/trecho-XX/      # midia/, plano.md, beats.json, hf/, render/
```

---

## 🛠️ Commands reference

| Command | Description |
|---|---|
| `bun run video:novo <id> --titulo ".." [--roteiro ..] [--audio ..]` | Create a video folder |
| `bun run video:transcrever <id> [--importar legenda.srt]` | Word-level transcript (Parakeet) or import captions |
| `bun run video:buscar <id> "start" ["end"]` | Find when a script sentence was said |
| `bun run video:cortar <id> <XX> <start> <end>` | Create a section: cut audio, words, `plano.md`, `beats.json` |
| `bun run video:status <id>` | Where each section is in the pipeline |
| `bun run video:sincronizar <id> [--audio new.wav]` | Re-apply `revisao.json` and re-cut every section by its opening sentence (after a re-recording) |
| `bun run video:montar <id> [--trechos 01,12]` | Whole-video audio (narration + continuous music + sfx, -14 LUFS) + join the section MP4s |
| `bun run video:produzir <id>` | Build all sections, render only what changed visually, then `video:montar` |
| `bun run house:lint <id> <XX>` | Check a section's `beats.json` against the house rules |
| `bun run hf:build <id> <XX>` | Generate the HyperFrames project for a section |
| `bun run hf:render <id> <XX> [--draft] [--alpha \| --so-alpha] [--cpu]` | Check and render the finished MP4 on the GPU (`--alpha` adds the transparent MOV; `--cpu` only if the GPU fails) |
| `bun run skills:link` | Link `.agents/skills` into `.claude/skills` for Claude Code |
| `bun run sync:lucide-animated` | Re-download and adapt the Lucide Animated icons |
| `bun run reference:extract <folder>` | Analyse a reference video |
| `bun run studio` | Remotion Studio (earlier sections, house demos `House-Demo-*`) |
| `bun run render:trecho <video> <XX>` | Render an earlier Remotion section (COE) |
| `bun run build` | TypeScript check (`tsc --noEmit`) |

---

## 🕰️ Remotion (earlier sections)

The first four sections of the COE video were made with Remotion (`videos/coe/output/trecho-01..04`,
`bun run studio`). The Remotion house kit in `src/house/` reads the same beat sheet format and is kept for
those sections; new videos use HyperFrames.
