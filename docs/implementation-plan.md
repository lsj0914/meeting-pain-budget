# Meeting Pain Budget Implementation Plan

> Execute inline using the already loaded executing-plans and test-driven-development skills. One fresh independent review before publication.

**Goal:** Publish a complete browser-only meeting explorer and fairness rotation planner.
**Architecture:** Pure validated TypeScript model, timezone/scoring/scheduling engine, worker boundary, DOM editor/results, document exporters and local persistence.
**Spec:** design.md

## Review focus

- The full duration, including midnight/day-off/DST boundaries, affects pain.
- Repeated local times need distinct UTC instants and offsets; missing times must not be invented.
- Fixed and rotating plans use identical constraints and the same cumulative objective.
- Unsaved invalid or rejected drafts must be recoverable; async stale outputs must be discarded.
- ICS lines require UTF-8-aware folding and content escaping, not raw participant text insertion.

### Task 1: Scheduling engine

Files: src/model.ts, src/time.ts, src/engine.ts, src/examples.ts, tests/engine.test.ts.
Interfaces: validateConfig(unknown): Config; localParts(number, zone): LocalParts; dayStarts(date, zone): number[]; evaluateSlot(Config, number): Slot; calculate(Config): Results.

- [ ] Write and run failing fixtures for literal timezone/DST instants, full-duration pain, cyclic windows, fixed/rotation fairness and infeasibility.
- [ ] Implement validated inputs, calendar-aware candidates, scoring and bounded deterministic rotation search; prove the full suite green.
- [ ] Commit verified engine.

### Task 2: Product and exports

Files: src/main.ts, src/worker.ts, src/editor.ts, src/results.ts, src/i18n.ts, src/documents.ts, src/style.css, index.html, tests/documents.test.ts, e2e/*.spec.ts.

- [ ] Write failing exporter and browser acceptance tests; implement UTC ICS, CSV, Markdown and versioned JSON.
- [ ] Implement worker/revision handling, responsive bilingual editor, time ribbons, candidates, series and budgets, persistence/recovery and print.
- [ ] Run unit, typecheck/build, desktop/mobile and accessibility checks; inspect actual screenshots.
- [ ] Commit the tested product.

### Task 3: Publication

Files: README.md, README.zh-CN.md, LICENSE, docs/methodology.md, docs/demo.png, examples/*.json, .github/workflows/*.yml.

- [ ] Document assumptions, sample results, limitations and reproduction instructions.
- [ ] Fresh whole-project review; fix material issues with regression tests and green suite.
- [ ] Create public lsj0914/meeting-pain-budget, push source and deploy GitHub Pages.
- [ ] Verify latest CI/deployment, remote commit and live interactive results; only then complete the goal.
