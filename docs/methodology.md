# Methodology

This is a transparent preference model, not a measure of productivity or a medical claim about sleep. Weights are fixed and deliberately easy to inspect.

## Candidate instants

A reference local date is searched by walking a wide UTC interval at 15-minute increments and keeping instants whose formatted reference date matches. This avoids guessing UTC offsets. A spring-forward gap has no corresponding instant; repeated fall-back wall times retain distinct UTC timestamps and offsets. Quarter-hour zones and Lord Howe’s half-hour transition are covered by literal fixtures.

Each weekly date adds seven **calendar** days in the reference zone. It does not add a fixed number of UTC hours to the previous meeting. Inputs are limited to years 2000–2099 and the whole series must fit within that range.

Time-zone rules are supplied by the browser’s built-in [Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat). If a jurisdiction changes its rules, browser data must be updated. This app supplies no separate time-zone database.

## Scoring one meeting

The full elapsed duration is divided into 15-minute segments. Every segment uses its own local time and weekday for every participant. All input time-window boundaries use the same quarter-hour grid.

| Segment condition                      | Points per hour |
| -------------------------------------- | --------------: |
| In comfortable hours                   |               0 |
| Awake, outside comfortable hours       |               2 |
| In sleep hours                         |               8 |
| Local day not in selected working days |              +4 |

Sleep takes precedence over the awake rate; day-off burden is additive. Start boundaries are inclusive and end boundaries exclusive. Overnight windows wrap across midnight. Comfortable and sleep windows must not overlap.

If sleep protection is enabled, **any** overlap makes a slot ineligible. Likewise, day-off protection rejects a slot if **any** segment falls on an unselected local weekday. It never relaxes either rule to produce an answer. A meeting that crosses midnight can therefore be eligible in one city and rejected in another.

Examples: 30 minutes asleep plus 30 minutes awake outside comfortable hours costs 5 points. A 60-minute sleeping meeting crossing Friday midnight with 30 minutes on Saturday costs 10 points (8 + 2) when the relevant protections are disabled.

## Comparing the whole series

For participant i, define `ratio_i = (carried_i + new_i) / max(budget_i, 1)`. Plans are compared lexicographically:

1. Lowest maximum ratio.
2. Lowest total new points.
3. Lowest sum of squared ratios.
4. Earliest aggregate UTC starts for deterministic ties; stable generation order resolves any remaining tie.

A budget is a soft target. Zero budgets use denominator 1 to keep comparisons finite, but any positive total is still flagged as over budget.

The fixed comparator checks reference wall-clock times available on **every** occurrence. If a clock time repeats during fall-back, both corresponding instants are considered. It evaluates the series with the same constraints and objective as rotation.

Rotation first removes duplicate daily cost vectors and those dominated in every participant’s costs. It extends a beam of at most 128 cumulative states, deduplicates cumulative cost vectors, sorts by the objective, and keeps the best 128 for the next week. This is deterministic and bounded; it is a heuristic, not a proof of global optimality. If the fixed plan is better, the planner returns it as the rotation fallback. If any date has no eligible starts, there is no complete series.

The 24-hour ribbon shows local clock positions; repeated clock hours overlap on that ribbon. The text dates, UTC offsets and explicit calendar instants disambiguate them. The table and scoring count real elapsed minutes even when start and end wall times look identical.

## Export and persistence

The calendar follows [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545): explicit UTC `DTSTART`/`DTEND`, CRLF endings, escaped text and UTF-8-aware folding at 75 octets. It uses no recurring rule, attendee addresses or invitation method. Stable identifiers and timestamps make identical exports reproducible.

CSV quotes every field and neutralizes formula-like prefixes in text. Markdown escapes raw HTML and table separators. JSON stores only a validated version 1 configuration, never computed results. Imports are capped at 250 KiB.

Valid changes save in local storage. Invalid edits pause calculation and downloads, while keeping the previous valid saved setup. An unreadable saved draft is retained verbatim until the user chooses to replace it, and can be downloaded for recovery. Worker replies carry revision identifiers so obsolete results cannot replace a newer edit.
