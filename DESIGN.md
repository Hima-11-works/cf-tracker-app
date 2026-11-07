# Design direction

## Surface

Operational web app for a Codeforces probation program. The primary job is reading the leaderboard or checking one person's sheet; the admin route maintains the roster and problem list.

## Direction

Use shadcn/ui's `base-nova` defaults as the component foundation. Keep the existing compact route layout and table density, with a black and white palette and the existing cobalt blue `#2460DA` as the accent. Geist is the interface font; DM Mono marks identifiers and measured values. The dark theme uses near-black surfaces with white text. The theme toggle follows the device preference on first visit and remembers a manual choice.

Every component corner stays within 25% of its dimensions and 12px. Status colors keep their established meanings and remain separate from brand colors. The IoT Lab badge remains a user-defined membership marker and does not imply official ownership or endorsement.

## Tokens

- Light canvas and surfaces: `#FFFFFF`.
- Light ink: `#09090B`.
- Muted text: `#71717A`; rules: `#E4E4E7`.
- Brand and focus: `#2460DA`; hover: `#1D4ED8`.
- Dark canvas: `#09090B`; dark surface: `#111113`; text: `#FAFAFA`.
- Accepted: evergreen on pale mint.
- Time or memory limit: ochre on pale straw.
- Wrong answer: brick on pale rose.
- Unattempted: neutral text without a status fill.
- Leaderboard podium accents: gold, silver, and bronze.

## Interaction

Controls use shadcn Button, Input, Textarea, Label, Card, Table, Badge, Switch, and Alert components. Keep visible focus rings, accessible labels, and clear loading, empty, warning, and error feedback. Active navigation and primary actions use cobalt. The admin editor keeps its save action above the editable sections.

Do not present invented results as real data. Keep the visual theme separate from product identity and the meaning of problem verdict colors.
