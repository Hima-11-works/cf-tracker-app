# Design direction

## Surface

Operational web app for a Codeforces probation program. The primary job is reading a rank table or checking one person's sheet; the admin route maintains the underlying roster and problem list.

## Direction

A minimalist practice ledger with the visual accents of IoT Lab KIIT's public site: warm off-white surfaces, deep navy ink, cobalt navigation and actions, cyan details, and Inter typography. Keep the existing route hierarchy, dense tables, status vocabulary, and restrained sheet presentation. The header uses compact rounded corners with a filled active link; primary actions use the reference's blue treatment. All corner radii are capped at 25% of each element dimension, with a 12px maximum. Status verdict colors remain semantically stable and independent from the brand colors.

Do not use IoT Lab's logo or photography in the tracker. Its badge is a user-defined membership marker; the visual adaptation should not imply official ownership or endorsement.

## Tokens

Reference values extracted from the homepage branding data at capture time:

- Brand navy: #060D29.
- Cobalt: #2054BF; the primary control treatment also reads as a brighter blue near #2460DA.
- Cyan accent: #06B8F9.
- Warm canvas: #F5F3EF.
- Text color: #3C5B59.
- Typography: Inter for headings and body; DM Mono remains for measured identifiers and code-like values.

Implementation roles:

- Canvas: reference warm gray #F5F3EF.
- Surface: paper #FFFEFA.
- Ink: reference navy #060D29.
- Secondary ink: reference text tone #3C5B59.
- Rule: pale sage-gray #D9DED8.
- Brand action: cobalt #2460DA, with #2054BF for hover and links.
- Brand detail: cyan #06B8F9, used sparingly for short accents and focus details.
- Accepted: evergreen #2F7658 on pale mint #E5F2E9.
- Time or memory limit: ochre #91610D on pale straw #FBF0D6.
- Wrong answer: brick #A8403A on pale rose #F8E7E4.
- Unattempted: neutral text on canvas, with no status fill.
- Dark mode: deeper navy canvas (#0A1020) and surface (#131D30) with light text and brighter blue accents; status colors keep their existing contrast-adjusted values.

The tracker caps every corner radius at the smaller of 25% of each element dimension and 12px, using softer rounded rectangles for navigation and actions instead of full pills or circles. Inputs retain a restrained 8px radius. Spacing and shadow values in the site extraction are visual estimates; the tracker keeps its existing spacing scale.

## Interaction

Controls use plain labels, visible focus rings, and clear loading and error feedback. Active navigation and primary actions use cobalt; keyboard focus uses blue/cyan. No result is presented until it comes from Supabase or Codeforces. Statuses retain an accepted date when present. The admin editor is explicit about the sheet fields and save action.

## Reference capture

- Source: [IoT Lab KIIT homepage](https://www.iotkiit.in/).
- Firecrawl scrape ID: 01a163a8-f6c0-7398-bb16-8b6552eb6d3a (2026-10-22, full-page screenshot requested, branding and page text returned).
- Pixel inspection: live homepage opened in the in-app browser at an approximately 730 x 695 viewport. The first view showed a warm light canvas, a raised capsule navigation bar, a cobalt active pill, oversized navy-to-blue heading, and a blue network illustration. This inspection supports color and navigation accents only; mobile behavior was not inferred from this viewport.
- Inspected screenshot capture: https://storage.googleapis.com/firecrawl-scrape-media/screenshot-86d347cd-7a89-41ed-bb4f-c8c3b14fb0bb.png?GoogleAccessId=scrape-bucket-accessor%40firecrawl.iam.gserviceaccount.com&Expires=1793278189&Signature=UDohN5LngpePbJpfJ%2BULqw9rs62JF91ggGSQ6%2BwdO8YdjerYB5OcTLK2Lz4AcrJ2xLgPD3cnokvPxzn1S2%2FeLSSHKjh2k5lTAIkGioAipyNn1dHULsUZd%2Ftu71u6cMxWRoO9VLqMhT%2Bi5AkEiOD1OWAXLTQGe7EYpSRY23iV%2BSnWBE13Y6gDiAP3pdvnFQZq0%2Bt9xx4zCkSouPiKvt%2B5b2cSvbqoQQf%2BPVRnidtd68JHsBD14VtOlzkEqgbutx7F8UcVPK%2FXz5B5RPnZHBJgFqJE7TkYZMFq1r7h7ry2E6AfRkW4%2FNFZpE8AaJ4QeYLUvXEffQeIukQMQaUPukXSuA%3D%3D

## Constraints

The app must not present invented results as real data. Keep the visual adaptation separate from product identity and the meaning of the verdict colors.
