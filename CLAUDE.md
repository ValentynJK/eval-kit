# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`@valentynjk/eval-kit` is an npm package (published to npmjs) that grades a host
project's LLM call against golden cases with an LLM judge, and serves a local run viewer. The
README covers the track layout and the `EvalTrack` contract from the host's side; read it first.

## Commands

```bash
npm run typecheck                        # tsc, noEmit
npm test                                 # vitest run (src/**/*.test.ts)
npx vitest run src/engine/nullCheck.test.ts   # one test file
npx vitest run -t "both-null"            # tests whose name matches
npm run build                            # rm -rf dist && tsup
npm run format                           # prettier --write .
```

CI (`.github/workflows/ci.yml`) runs typecheck, test, build on Node 22. Releasing: bump
`package.json` `version`, then publish a GitHub release tagged `v<version>`; the release workflow
fails if the tag and version disagree.

`example/` is a stand-in host project with one track (`evals/demo/contacts`): a regex "system
under test" and a mock grader (`example/mockGrader.ts`, `MockLanguageModelV3` that string-compares
EXPECTED/ACTUAL out of the grader prompt), so it runs offline and deterministically. The scripts
`cd example` and run `src/cli/index.ts` through tsx, so there is no build step:

```bash
npm run example:run -- contacts [--case 003]   # writes example/evals/demo/contacts/runs/ (gitignored)
npm run example:ui                             # tsx watch; index.html is re-read per request
EVAL_GRADER_MODEL=openai:gpt-4o npm run example:run -- contacts   # real grader, needs OPENAI_API_KEY
```

The example's `@valentynjk/eval-kit` import resolves to `src/index.ts` via tsconfig `paths`,
and `example/` is typechecked with `src/`. This doesn't exercise packaging (`dist/`, the bin
shebang, peer deps); for that, `npm pack` here (`prepack` runs the build) and `npm i -D ../eval-kit/<tgz>` in a host project
outside this directory. Don't use `npm link`: it gives the kit its own `ai`/`zod`, breaking type
identity with the host's (both are peer deps).

## Architecture

- `src/engine/` — pure logic: types, scoring, null check, grader prompt, loaders, console report.
  Imports only `node:fs`/`node:path`/`node:crypto`, `zod`, and `ai` types. Everything I/O-ish or
  model-calling is passed in (e.g. `gradeResult` takes a `callModel`), which is what makes it
  unit-testable without a model.
- `src/cli/` — the `eval-kit` bin. `index.ts` dispatches `run` / `ui`; `run.ts` is the harness;
  `callStructuredModel.ts` is the only real model call (AI SDK `generateText` with structured output).
- `src/ui/` — a `node:http` server plus a single `index.html` (inline CSS + vanilla JS, no
  framework, no build). tsup copies `index.html` into `dist/` next to the bundled `cli.js`,
  because the server reads it from its own directory, fresh on every request.
- `src/index.ts` — the public API is **types only**; hosts import `EvalTrack` etc. from here.
  All behaviour runs through the bin.

### Run flow (`cli/run.ts`)

1. Resolve `<track>` to `evals/<feature>/<track>/config.ts` (relative to `process.cwd()`, the
   host root — never `import.meta.url`, which points inside the installed package). Feature and
   track names come from that path; the config never restates them.
2. Load the config with tsx's `tsImport` so the host's tsconfig `paths` work.
3. `grade_criteria.json` keys define the field set; `loadCases` validates cases against it.
4. Per case, sequentially: `resolve(input)` → record the request → `execute(request)` → record the
   flat output (`engine/runCase.ts`). Then grade each.
5. Grading (`engine/gradeResult.ts`): `checkNulls` decides null-vs-value fields deterministically
   (0 or 10; `''`/whitespace count as null) and only the remaining fields go to the grader.
   The grader's reply is re-parsed with zod and must contain exactly one grade per field sent.
   Score = weighted mean rounded to 0.5 (`computeEvalScore.ts`).
6. Write `runs/<iso timestamp>.json`, print a report diffed against the previous run, exit
   non-zero if any case errored.

Invariants worth preserving:

- A throw in `resolve`/`execute`/grading becomes a `CaseError` (with stage and whatever it got as
  far as); other cases still run and the run file is still written.
- The run file's `model`, prompts, `params` and `prompt_hash` are taken from the request actually
  sent, never hardcoded. `params` must stay JSON-serializable.
- Run-file types in `engine/types.ts` are read by the UI for old runs too; new fields are added as
  optional (see the "absent on runs written before…" comments) rather than breaking old files.

## Conventions

- ESM, TypeScript strict, `moduleResolution: bundler`, Node >= 20.
- Prettier: single quotes, 2 spaces, `trailingComma: es5`, `arrowParens: avoid`.
- Comments are lowercase, sit above the code, and explain _why_ (often "X, not Y -- reason").
  Match that style.
- Tests sit next to the source as `*.test.ts` and cover `engine/` only.
