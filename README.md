# Meeting Pain Budget

**Share the early mornings.** A browser-only planner that makes the inconvenience of cross-time-zone meetings visible—and spreads it across a short series.

[Try the live app](https://lsj0914.github.io/meeting-pain-budget/) · [中文说明](README.zh-CN.md) · [How the scoring works](docs/methodology.md)

![Meeting Pain Budget interface](docs/demo.png)

## Why this little tool exists

“Can everyone do 9 AM New York?” is a different question from “Is it always the same person staying late?” A time-zone converter answers the first. This project keeps a small ledger for the second.

Give each person comfortable hours, sleep hours, working days, a carried burden and a budget. Explore one meeting, then compare the best fixed reference time against a weekly rotation that tries to share the burden.

The included New York–Shanghai example schedules four 60-minute meetings across the November 2026 daylight-saving change. With equal budgets of 8 points, the best fixed time uses **100%** of the most affected person’s budget. The rotation gives each person **4 new points**, reducing that maximum to **50%**.

## What you can do

- Plan for 2–12 people, real city time zones, overnight work/sleep windows, and 1–8 weekly meetings.
- See local start/end dates, UTC offsets, a 24-hour ribbon and a full-duration point breakdown.
- Keep sleep and days off protected, or explicitly allow those trade-offs.
- Include carried burden and different budgets in the fairness calculation.
- Compare fixed and rotating plans; exploring a single slot leaves the series intact.
- Export explicit UTC calendar events (`.ics`), a schedule and budget ledger (`.csv`), or a readable report (`.md`).
- Save/import a versioned setup (`.json`); valid edits persist locally. Unreadable drafts remain recoverable until you explicitly replace them.
- Use English or Chinese, a narrow phone screen, keyboard navigation, reduced motion or print.

There is no account, backend, analytics or external font request. Calculation and setup storage stay in the browser. Opening source links or exporting files is your choice.

## Run locally

Use Node.js 22.12+ (22 LTS) or Node.js 24+.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4174/. For production output, run `npm run build` and serve `dist/`.

```sh
npx playwright install chromium
npm run check
```

The check includes literal unit fixtures, TypeScript validation, the production build, and browser tests on desktop and a Chromium phone viewport. CI installs Chromium with its Linux dependencies. WebKit/Safari is not part of this automated matrix.

## Design choices and limits

Points are an explicit preference model: 0/hour in comfortable hours, 2/hour awake outside them, 8/hour during sleep, plus 4/hour on a day off. The whole meeting is counted in 15-minute elapsed segments. Window boundaries and durations also use 15-minute steps.

The planner prioritizes the largest cumulative budget-use ratio, then total new points, then squared ratios. Budgets are targets, not guarantees; zero uses a denominator of 1 for comparison while any positive burden is flagged as over budget. Sleep/day-off protection is never silently relaxed.

Rotation uses a bounded beam search over daily non-dominated cost vectors, retaining up to 128 states. It may miss a globally optimal schedule. The best feasible fixed schedule is a fallback, so rotation never loses to that comparator under the same objective. Time-zone rules come from the browser’s `Intl` data and depend on that browser being up to date.

Calendar exports use individual UTC events, rather than a recurring rule that could shift across daylight saving. They do not send invitations or include attendee email addresses. Import the file into your own calendar to use it.

## Project map

| Area                                            | Location                                       |
| ----------------------------------------------- | ---------------------------------------------- |
| Validated model, scoring, scheduling            | `src/model.ts`, `src/time.ts`, `src/engine.ts` |
| Calculation worker                              | `src/worker.ts`                                |
| Bilingual editor, ribbons, ledger, local drafts | `src/main.ts`, `src/style.css`                 |
| Calendar, CSV, Markdown, versioned JSON         | `src/documents.ts`                             |
| Reusable scenarios                              | `src/examples.ts`, `examples/`                 |
| Literal engine/export tests                     | `tests/`                                       |
| Actual desktop/mobile browser flows             | `e2e/`                                         |

Built with TypeScript, Vite, native `Intl`, Vitest and Playwright. No runtime framework dependency. MIT license.
