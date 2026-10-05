# Verification record

- 44 unit fixtures pass: literal time-zone/DST instants, full elapsed scoring, overnight windows, constraints, fairness, malformed configuration and portable exports.
- 44 browser checks pass across desktop Chromium and a Chromium phone viewport. They exercise actual downloads/imports, invalid-input saving, rejected-draft recovery, safe text rendering, rapid edits, accessibility/overflow, feasibility labels and time-zone selection.
- TypeScript validation and Vite production build pass. Full dependency audit reports zero vulnerabilities.
- A local 12-person / 8-week / 180-minute unrestricted scenario produced eight rows in about 300 ms including worker/UI updates. This is an observed local benchmark, not a timing guarantee.

## Independent final review

A fresh reviewer reproduced three material UI issues, then a single fix pass added failing browser regressions before correcting them:

1. Trimmed time-zone input calculated correctly but raw rendering could throw. Rendering now uses the normalized configuration associated with the result.
2. Example/import replacement could erase edited settings. A native dialog now confirms replacement, supports cancel, and can download current unfinished edits.
3. A fixed series could become infeasible after an edit while displaying a rotation under a fixed label. The effective view now resets to rotation and explains the missing fixed comparator.

All added regressions pass on desktop and mobile, followed by the complete green suite. The independent reviewer also checked Samoa’s skipped date, repeated fall-back instants, full-duration spring-forward scoring and calendar property-injection escaping. No minor findings were deferred.

## Structure decision

The small native-DOM app keeps editor, result and language helpers in `src/main.ts`. The scoring engine, worker and exporters are separate. If the UI grows, the cost of this choice is extracting those UI modules.

Automated browser coverage uses Chromium; native Safari and calendar-client import behavior are outside this matrix. Live deployment is verified separately after publication.

## Populated time-zone selection

A reported usability issue was reproduced: the native datalist filtered against the existing full time-zone value, so choosing another zone required clearing the field. A failing browser regression was added before replacing it with a searchable combobox. Its arrow opens the complete list without changing the current value; typed text filters the list. Participant and reference zones support direct replacement, keyboard selection, cancellation and saved selections. Ten new desktop/mobile checks pass, including accessibility and horizontal-overflow checks. The complete suite now passes 44 unit fixtures and 44 browser checks.

## Live publication

On 2026-10-05, both GitHub quality checks and Pages deployment passed for source commit `5a09a8bbd31436fb149a7f68359cf0b2eeace864`. The public page returned HTTP 200. The actual deployed UI showed the default 50% rotation and switched correctly between fixed/rotating ledgers. An independent Chromium run downloaded a real four-event calendar, observed zero page errors, and confirmed that the deployed JavaScript, worker and CSS exactly matched the local production build by SHA-256.

[Quality run](https://github.com/lsj0914/meeting-pain-budget/actions/runs/37269921736) · [Deployment run](https://github.com/lsj0914/meeting-pain-budget/actions/runs/37269921757)
