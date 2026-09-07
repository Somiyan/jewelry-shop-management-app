# Design system — Jewellery Shop Manager

Binding spec for all UI work in `frontend/`. Tokens live in `src/index.css`.
If something here conflicts with what a page currently does, this file wins.

## Direction: "the assay ledger"

This is a counter-side instrument for an Indian jewellery retailer. The user is a
shop owner or salesperson, often on a tablet, with a customer waiting. The job is
fast accurate entry and unambiguous money/weight figures.

**The merchandise is gold; the instrument is cool and quiet.** Gold and silver
appear only as semantic metal indicators next to a product's metal type — never
as buttons, links, headers, or brand chrome. That restraint is what lets the
actual gold *values* carry the visual weight.

## Hard rules (these are what keep it from reading as a generic admin template)

1. **No shadow under every card.** Panels are separated by hairline borders
   (`border-line`). `shadow-raise` is only for popovers/dropdowns; `shadow-overlay`
   only for modals/drawers. Nothing else gets a shadow.
2. **Radius by role, not one value everywhere**: `rounded-control` (6px) for
   buttons/inputs, `rounded-panel` (10px) for cards/tables, `rounded-overlay`
   (14px) for modals/drawers, `rounded-pill` for badges.
3. **No `dark:` variants anywhere.** Theming is done by token override in
   `index.css`. Use semantic classes (`bg-surface`, `text-ink`, `border-line`)
   and dark mode follows for free. Any `dark:` class in a diff is a bug.
4. **No amber/gold as accent.** The old build used `amber-600` as primary; it is
   being removed. Primary action = `bg-accent text-accent-ink`.
5. **Numbers are tabular and right-aligned.** Every currency, weight, and quantity
   in a table or figure stack gets `font-mono` (or `.figures`) and
   `text-right`. Mono is for figures only — never for eyebrow labels or captions.
6. **No ALL-CAPS tracked eyebrow labels**, no `→` appended to button text, no
   `01 / 02 / 03` numbering except the Sales Journey stepper (that one is a
   genuine sequence, so numbering is legitimate there).
7. **Motion is for state changes only** — drawer/modal open, toast in/out,
   dropdown. No scroll-triggered reveals, no hover-lift on cards. Keep under
   180ms. `prefers-reduced-motion` is already handled globally in `index.css`.

## The one signature element

The **assay stack**: the price breakdown rendered like an assay certificate —
metal value / making / labour / GST stacked, decimal-aligned mono figures, a
hairline rule above the total. Used in product price detail, order line detail,
and the invoice. This is the memorable moment; everything around it stays quiet.

```
Metal value        1,40,000.00
Making                21,400.00
Labour                   400.00
GST (5%)               8,090.00
────────────────────────────────
Total              1,69,890.00
```

## Type scale

| Role            | Class                                  |
| --------------- | -------------------------------------- |
| Page title      | `text-xl font-semibold tracking-[-0.01em]` |
| Section heading | `text-base font-semibold`              |
| Body            | `text-sm`                              |
| Table cell      | `text-sm`                              |
| Caption / meta  | `text-xs text-ink-muted`               |
| Form label      | `text-sm font-medium`                  |
| Figures         | `font-mono text-sm` (+ `text-right` in tables) |

Sentence case everywhere, including buttons and headings. Never title case, never
all caps.

## Colour semantics

Status colour is fixed application-wide and must never be re-picked per page:

| Meaning                                   | Token                            |
| ----------------------------------------- | -------------------------------- |
| Paid, delivered, in stock, active          | `success` / `success-soft`       |
| Pending, partial, low stock, processing    | `warning` / `warning-soft`       |
| Failed, cancelled, out of stock, error     | `danger` / `danger-soft`         |
| Informational, ready, neutral in-progress  | `info` / `info-soft`             |
| Gold / silver metal type                   | `gold` / `silver` (swatch only)  |

Never communicate status by colour alone — always pair with text (and an icon
where space allows).

## Layout

- **≥1280px**: sidebar 244px + content, content capped at `--container-content`
  (1560px) and centred. Do not stretch tables edge-to-edge on a 2560px monitor.
- **1024–1279px**: sidebar collapses to a 64px icon rail (toggleable).
- **768–1023px**: icon rail; drawer opens over content on demand.
- **<768px**: no sidebar. Bottom tab bar (Dashboard, Sell, Products, Customers,
  More) + drawer from "More". Flows get a sticky bottom action bar.
- Table rows: 40px desktop. Interactive targets: ≥44px on touch.
- Tables become card lists below `md`. Horizontal scroll is a last resort, only
  for genuinely wide numeric tables, and then the first column stays visible.

## Component inventory

Everything lives in `src/components/`. Do not hand-roll a variant of one of these
inside a page.

`Button` (variants: primary, secondary, ghost, danger; sizes sm/md; `loading` prop
renders a spinner and disables) · `IconButton` · `Input` · `Select` · `Textarea` ·
`Field` (label + hint + error + required marker wrapper) · `Checkbox` · `Badge`
(tone prop) · `Card` · `PageHeader` (title, breadcrumb, actions) · `DataTable`
(sortable columns, empty/loading states, mobile card renderer) · `Pagination` ·
`Modal` (focus trap, Escape, scroll lock, `role="dialog"`, full-screen sheet
below `sm`) · `Drawer` · `Toast` + `useToast()` · `EmptyState` (icon, message,
primary action) · `Skeleton` (text/row/card) · `ConfirmDialog` (replaces every
`window.confirm`) · `SearchInput` · `Tabs` · `MetalSwatch` · `FigureStack` (the
assay stack) · `StatCard`.

## Copy rules

- Buttons say what happens: "Create product", not "Submit". The verb stays the
  same through the flow ("Publish" → "Published").
- Errors state what failed and what to do, in the interface's voice, and never
  apologise: "Unable to load products. Check your connection and try again."
- Empty states are an invitation: heading, one line of explanation, primary action.
- Never show a raw status code or a stack trace to a user.

## Accessibility floor

Keyboard reachable everywhere; visible focus (already global); `aria-label` on
icon-only buttons; modals trap focus and restore it on close; form errors tied to
inputs via `aria-describedby` + `aria-invalid`; live regions for toasts; contrast
≥ 4.5:1 for body text.
