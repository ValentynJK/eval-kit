# @valentynjk/eval-kit

Grades an LLM call against hand-written golden cases, field by field, with an LLM judge, and
serves a local report of the runs.

## Install

```bash
npm install -D @valentynjk/eval-kit
```

Peer dependencies: `ai` (v6) and `zod` (v3), shared with the host.

## Usage

```bash
npx eval-kit run <track>              # run and grade every case, write a run file
npx eval-kit run <track> --case 003   # one case (id prefix is enough)
npx eval-kit ui                       # report viewer at http://localhost:7766 (PORT to override)
```

Run from the host project root. The CLI loads `.env` from there; variables already set in the
shell win. `<track>` resolves against `evals/*/<track>/config.ts`, or pass the config path
itself (`evals/<feature>/<track>/config`).

## A track

```
evals/<feature>/<track>/
  config.ts            default-exports an EvalTrack
  grade_criteria.json  { "<field>": { "criteria": "...", "weight": 1 } }
  cases/*.json         { id, description, synthetic, input, expected, notes }
  runs/*.json          written by the kit; gitignore it
```

```ts
import type { EvalTrack } from '@valentynjk/eval-kit';

const track: EvalTrack<{ transcript: string }> = {
  graderModel: 'openai:gpt-4o',
  passThreshold: 7,
  resolve: ({ transcript }) => ({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildUserPrompt(transcript),
    params: { model: MODEL },
  }),
  async execute({ systemPrompt, userPrompt, params }) {
    return callMyModel({ model: params.model, systemPrompt, userPrompt }); // flat field values
  },
};

export default track;
```

The config is loaded with tsx's `tsImport`, so the host's tsconfig `paths` (`@/...`) work in it.

## How it works

```
src/
  engine/   types, scoring, the grader, loaders, report. node:fs/node:path/zod only.
  cli/      index.ts (the bin: `run` / `ui`), run.ts (the harness), the grader's model caller.
  ui/       a node:http server + one index.html. No framework, no build step of its own.
  index.ts  the public API: types only.
```

**The track contract is `resolve` / `execute`** (`engine/types.ts`). Per case the kit calls
`resolve(case.input)`, records the request, hands that same object to `execute`, and records the
flat output (`engine/runCase.ts`). The run file's prompts, `params`, `model` (`params.model`) and
`prompt_hash` come from that request, so they can't disagree with what was sent. `params` must be
JSON-serializable; non-serializable call machinery (an output schema, an SDK client) stays in
`execute`'s closure.

**The grader uses the track's `graderModel`**: a `"<provider>:<model>"` id (`openai:...` or
`anthropic:...`), resolved through the kit's own provider registry with `OPENAI_API_KEY` /
`ANTHROPIC_API_KEY` from the host's env, or an AI SDK `LanguageModel` instance (e.g. a mock).
`engine/`'s `gradeResult` takes the caller as a parameter, so it stays pure and testable.

**Scoring.** The grader returns a 0-10 grade and reasoning per field, judged against that field's
rule in `grade_criteria.json`. The case score is the weighted mean of the field grades, rounded to
the nearest 0.5 (`engine/computeEvalScore.ts`). A case passes at `>= passThreshold`.

**A failing case doesn't fail the run.** A throw in `resolve`, `execute` or grading becomes an
entry in the run file's `errors` (stage, message, and whatever request/output it got as far as);
the other cases still run, the run file is still written, and the process exits non-zero.
`results` holds graded cases only; `pass_rate` counts an errored case as not passing.

**`ui/` is framework-free.** One `index.html` (inline CSS and vanilla JS, `fetch` against two JSON
endpoints) served by a plain `node:http` server with no auth, reading run files off disk.

## Development

```bash
npm install
npm run typecheck && npm test && npm run build
```

To try the pipeline and the UI from source, against the bundled example track (regex extractor,
mock grader, no API key):

```bash
npm run example:run -- contacts          # or --case 003
npm run example:ui
```

To try a change in a real host project, `npm pack` here (npm's built-in command; the `prepack` script builds first) and `npm i -D ../eval-kit/<tgz>` there.
`npm link` gives the kit its own copy of `ai` and `zod`, which breaks type identity with the host.

Releases: bump `version`, then publish a GitHub release tagged `v<version>`. The release
workflow tests, builds and publishes to npm via trusted publishing (no token secret).

## License

MIT
