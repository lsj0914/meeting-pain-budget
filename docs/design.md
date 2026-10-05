# Meeting Pain Budget

Build the second complete portfolio project, with an interactive bilingual website, source, tests, documentation and a GitHub Pages demo. The user's request to build this second idea follows the explicitly authorized GitHub delivery of the first project. Execute inline; make routine choices without another approval cycle.

## Product

Help a distributed team see who pays for a meeting with early mornings, late nights or days off. A single-meeting explorer ranks candidate slots, shows each participant's actual local date/time and full-duration discomfort, and lets the user inspect any alternative. A series planner compares an optimized fixed local clock against a rotation that distributes cumulative inconvenience relative to each person's budget. Carried pain points can reflect previous meetings.

Inputs: 2–12 participants with unique stable IDs, names, IANA time zones, daily comfortable/sleep windows, allowed weekdays, carried points and cumulative budgets; anchor date and reference timezone; 15–180-minute duration on 15-minute increments; 1–8 weekly occurrences; toggles that protect sleep and days off. Examples: New York/Shanghai, a three-city team, and a night-shift team. All times/constraints are explicit. No automatic invitation, calendar/account integration, AI scoring or paid API.

Pain points are declared policy: 0 per comfortable hour; 2 per waking hour outside the comfortable window; 8 per sleep hour; an additional 4 per hour on a day off. Evaluate every 15-minute elapsed segment of the full meeting, with local time/day/offset checked at that segment. Start, duration and schedule granularity align with these segments. Protect toggles are hard exclusions; budgets are comparison targets, not guarantees. Work and sleep windows may cross midnight; overlapping work/sleep windows are rejected. Equal endpoints are rejected.

The reference date identifies a local calendar day, not a UTC date. Generate UTC starts in a wide window and retain quarter-hour instants mapping to the reference day. Each weekly date is computed by calendar-day addition in the reference zone. Missing spring-forward wall times are absent; repeated fall-back times are distinct UTC starts with offset labels. Participant displays include local start/end dates and offsets. Runtime Intl/IANA timezone rules are the source of truth; no fixed GMT offset table.

Find a best fixed reference wall clock available on every occurrence, scoring its whole series under the same constraints/objective. Build a rotation with deterministic bounded beam search over non-dominated daily pain vectors. Minimize maximum cumulative pain/budget (zero budget uses a 1-point comparison denominator and is flagged if exceeded), then total new pain, then sum of squared budget ratios. Preserve a fixed plan when rotation cannot improve the objective. This is a heuristic, not a claim of global optimality; show when a fixed slot is infeasible or protected constraints leave no plan. Never silently relax constraints.

Outputs: local-time ribbon, per-person score breakdown, daily candidate list, fixed vs rotation comparison, per-occurrence local-time table, cumulative budget ledger with carried/new totals, exceeded-budget messages, explicit assumptions and scoring policy. Manual single-slot selection does not alter the optimized series. Export Markdown summary, CSV ledger/series and explicit UTC iCalendar VEVENTs. ICS uses CRLF, escaping, byte-aware folding, no attendee emails, no invitation METHOD, and stable event UIDs.

Browser-only storage with version-1 compact JSON import/export capped at 250 KiB. Preserve rejected drafts until explicit replacement and provide raw download recovery. Invalid edits cannot overwrite the last valid draft. Deleting an invalid participant must work before validation. Confirm edited draft replacement and clear committed scheduling output while current inputs are invalid. Worker calculation keeps edits responsive; revision IDs prevent stale results from overwriting newer inputs. English/Chinese UI; responsive, accessible controls, visible focus, reduced motion, readable print layout.

## Visual direction

White #FFFFFF, mist #EAF3F2, ink #16363C, teal #137D7A, sun #F8D96B, twilight #74436E. System sans with Trebuchet headings, generous whitespace. The memorable element is a 24-hour local-day ribbon showing daylight/work/sleep blocks and the selected meeting; the budget ledger uses visible bars and labels rather than gauge cards. Team editor at left, single-slot/series results at right. Mobile stacks. Avoid cloning the purple receipt aesthetic of the first project.

## Evidence

Hand-derived pain/window/calendar/DST/validation/rotation fixtures; real browser checks for edits, worker staleness, persistence, recovery, JSON/CSV/ICS export, examples, mobile overflow, accessibility and print. Independently review the full project before publication; fix material findings with regression evidence. Verify remote main commit, green checks, live URL, interactive results and deployed asset checksums.
