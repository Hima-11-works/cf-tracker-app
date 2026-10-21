# Design direction

## Surface

Operational web app for a Codeforces probation program. The primary job is reading a rank table or checking one person's sheet; the admin route maintains the underlying roster and problem list.

## Direction

An annotated practice ledger: an orderly, paper-like work surface where problem names and handles carry the hierarchy, rank rows stay dense and scannable, and status colors mean the same thing everywhere. The surface is warm and quiet so the verdict colors carry the emphasis. At narrow widths, each problem row becomes a compact stacked record without changing its status vocabulary.

## Tokens

- Canvas: warm stone `#f3f1eb`.
- Surface: paper `#fffefa`.
- Ink: deep blue-gray `#1e2b2b`.
- Secondary ink: muted slate `#667270`.
- Rule: pale sage-gray `#d9ded8`.
- Accepted: evergreen `#2f7658` on pale mint `#e5f2e9`.
- Time or memory limit: ochre `#91610d` on pale straw `#fbf0d6`.
- Wrong answer: brick `#a8403a` on pale rose `#f8e7e4`.
- Unattempted: neutral text on canvas, with no status fill.

## Interaction

Controls use plain labels, visible focus rings, and clear loading and error feedback. No result is presented until it comes from Supabase or Codeforces. Statuses retain an accepted date when present. The admin editor is explicit about the sheet fields and save action.

## Constraints

The visual direction was inferred from the operational task because no design preference or response channel was available. There is no supplied brand, logo, roster, or probation data. Do not fabricate live leaderboard entries.
