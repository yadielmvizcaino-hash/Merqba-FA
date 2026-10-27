---
name: Merchant Pulse Commerce
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#4a4451'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#7c7482'
  outline-variant: '#ccc3d3'
  surface-tint: '#7149ab'
  primary: '#43167c'
  on-primary: '#ffffff'
  primary-container: '#5b3294'
  on-primary-container: '#cca8ff'
  inverse-primary: '#d7baff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#492c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#684000'
  on-tertiary-container: '#fda518'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eddcff'
  primary-fixed-dim: '#d7baff'
  on-primary-fixed: '#280056'
  on-primary-fixed-variant: '#592f92'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

### Personality & Emotional Response
The design system delivers an operational, high-efficiency utility tailored for independent merchants and marketplace vendors. It projects authority, real-time precision, and frictionless workflow control. Rather than behaving like an administrative desktop portal compressed into a phone screen, the experience evokes the tactile immediacy of a handheld point-of-sale scanner combined with a modern financial dashboard. The merchant feels in control, confident during order surges, and protected against inventory discrepancies through immediate visual feedback.

### Visual Style
The system adopts a **Modern Corporate Utility** aesthetic with focused tactile cues. It combines crisp, structured information architecture with functional color-coded signals. Surfaces are clean, matte, and dense, eliminating decorative ornamentation in favor of scannable inventory rows, definitive status chips, and instantaneous touch feedback. Subtle micro-interactions, distinct state boundaries, and high-contrast numerical readouts optimize one-handed operation in bustling retail environments, storerooms, or pop-up markets.

## Colors

### Hierarchy & Functional Meaning
- **Primary (`#5B3294` / Deep Indigo-Violet):** Anchors primary actions, navigation active states, app bars, and high-priority filters. A lighter companion tint (`#7F54B3`) is reserved for secondary highlights, badge outlines, and interactive hover/focus rings.
- **Secondary (`#10B981` / Emerald Mint):** Designates confirmed synchronization, active webhooks, healthy stock levels, and completed order fulfillments. It signals operational stability.
- **Tertiary (`#F59E0B` / Amber Warning):** Communicates low stock thresholds, pending payments, or queued offline sync events requiring attention.
- **Critical / Danger (`#EF4444` / Crimson):** Reserved strictly for out-of-stock items, sync errors, severed webhook endpoints, and destructive operations (e.g., delete product, void order).
- **Neutrals:**
  - `Canvas / Background`: `#F8FAFC` (Slate 50) provides a soft, glare-free backdrop for heavy sunlight or warehouse lighting.
  - `Surface / Card`: `#FFFFFF` ensures crisp contrast against the canvas.
  - `Border / Hairline`: `#E2E8F0` (Slate 200) defines structured boundaries between dense list items without clutter.
  - `Typography`: `#0F172A` (Slate 900) for primary headers and stock metrics; `#475569` (Slate 600) for secondary details, SKU values, and metadata.

### Data & State Application
Color never functions as purely decorative tinting. In multi-tenant Dokan operations, status tags must pair color with typography or iconography to satisfy WCAG AA standards. When an item switches to out-of-stock, the primary indicator shifts to `#EF4444` while the entire card shifts border intensity to reflect the state shift instantly.

## Typography

### Rationale & Role Distribution
**Plus Jakarta Sans** provides a contemporary, geometric structure with distinct open counters and humanized terminals, ensuring exceptional legibility on small-format mobile touchscreens.

- **Numbers & Metrics:** Price tags, stock levels, and revenue metrics leverage tabular lining numerals (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during rapid inline stepper updates and real-time order counter refreshes.
- **Headlines (`headline-lg`, `headline-md`):** Reserved for screen headers, store earnings summaries, and modal titles.
- **Body (`body-md`, `body-sm`):** Handles product names, SKU IDs, vendor customer notes, and technical webhook error logs.
- **Labels (`label-lg`, `label-md`, `label-sm`):** Powers sync status pills, stepper button values, and category badges. `label-sm` uses all-caps styling with `letter-spacing: 0.04em` to anchor secondary categorization within dense SKU items.

## Layout & Spacing

### Layout Model
The layout employs an ultra-dense, 4-column fluid mobile grid spanning a standard viewport width with `1rem` outer screen margins and `0.75rem` gutters. Tablet views expand to an 8-column layout with fixed-width side panels for bulk modifications.

### Spatial Density Strategy
Because vendors must audit dozens of SKUs without excessive vertical scrolling:
- Vertical rhythm relies on standardized unit gaps (`0.5rem` to `0.75rem`) between catalog cards.
- Internal component paddings are compact: inputs, steppers, and row containers utilize `0.5rem` vertical and `0.75rem` horizontal padding.
- Touch target areas never compromise accuracy: interactive controls (quantity adjusters, toggle switches, sync triggers) enforce a strict minimum invisible hit area of `44x44px`, even if visual geometry is calibrated to `32px` or `36px`.

## Elevation & Depth

### Depth Philosophy
The design system avoids heavy, atmospheric shadows to prevent visual noise in compact inventory screens. Visual layering is achieved primarily via **subtle structural containment** complemented by crisp, low-spread ambient drop shadows.

### Elevation Levels
- **Level 0 (Base Canvas):** Background `#F8FAFC`, non-elevated.
- **Level 1 (Dense Cards & Product Rows):** Background `#FFFFFF`, 1px border `#E2E8F0`, shadow `0 1px 2px 0 rgba(15, 23, 42, 0.05)`.
- **Level 2 (Active/Pressed Cards & Quick-Edit Panels):** Background `#FFFFFF`, border `#CBD5E1`, shadow `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Sticky Bottom Toolbars & Floating Sync Drawers):** Background `#FFFFFF` with 95% opacity and 12px backdrop blur, top border `#E2E8F0`, shadow `0 -4px 12px rgba(15, 23, 42, 0.06)`.
- **Level 4 (Modal Sheets & Barcode Scanner Overlays):** Background `#FFFFFF`, shadow `0 20px 25px -5px rgba(15, 23, 42, 0.15)`.

### Border Cues for Synchronization
Real-time state shifts apply a transient 1.5px border glow:
- Synchronized / Success: `#10B981` fading into neutral border after 1200ms.
- Unsynced / Offline edits queued: Subtle dashed left border in `#F59E0B`.
- Network drop / Webhook failure: Crisp solid left border in `#EF4444`.

## Shapes

### Form Geometry
The system uses **Rounded (Value 2)** styling across all touch surfaces. This delivers modern ergonomics while preserving the geometric compactness required for enterprise data presentation.

### Implementation Specifics
- Standard Cards, Input Fields, and Segment Controls: `0.5rem` (8px).
- Status Badges, Quick Stepper Buttons, and Webhook Micro-Pills: `0.25rem` to `0.375rem` (4px to 6px) to maintain a compact, data-first look.
- Sticky Action Bars and Bottom Modals: `1rem` (16px) on top edges for comfortable physical containment.
- Circular Utilities (e.g., Avatar initials, single-icon quick actions): Fully rounded `9999px`.

## Components

### 1. Buttons & Steppers
- **Primary Action Button:** Background `#5B3294`, text `#FFFFFF`, height 44px, radius 8px, font `label-lg`. Pressed state transitions to `#472477`.
- **Quick-Adjust Inventory Stepper:** Segmented group containing `[-]` (left), editable text value (center), and `[+]` (right). Height 36px, border 1px solid `#CBD5E1`, background `#F8FAFC`. Tap targets for buttons expand to 44px. Long-press triggers rapid incrementing by units of 10.
- **Secondary Ghost Button:** 1px border `#CBD5E1`, transparent background, text `#0F172A`.

### 2. Product Inventory Card (High-Density)
- Structured as a horizontal row card. Left: 48x48px product thumbnail with stock status badge overlaid on top edge. Center: Product title (`headline-sm`), SKU and variation metadata (`body-sm`, `#475569`), regular and sale prices. Right: Instant stock stepper and sync pulse indicator.
- Background `#FFFFFF`, border 1px `#E2E8F0`, padding 12px.

### 3. Switches & Toggles
- Sized at 44x26px for reliable finger triggering.
- **On State (In Stock / Online Store Visibility):** Track `#10B981`, white knob with 1px drop shadow.
- **Off State:** Track `#CBD5E1`, white knob.
- Haptic feedback pattern fires on value toggle.

### 4. Chips & Micro-Badges
- **Sync Status Chip:** Height 22px, padding 2px 8px, radius 4px.
  - *Live / Connected:* Background `#ECFDF5`, text `#065F46`, paired with a 6px pulsing green dot.
  - *Syncing:* Background `#EFF6FF`, text `#1E40AF`, with a rotating 10px circular spinner.
  - *Pending Local Changes:* Background `#FEF3C7`, text `#92400E`.
  - *Webhook Error:* Background `#FEF2F2`, text `#991B1B`.

### 5. Input Fields & Quick-Edit Cells
- Inline editable numeric inputs for price and stock quantity.
- Normal state: Flat white background, border 1px solid `#E2E8F0`.
- Focus state: Border 1.5px solid `#5B3294`, subtle box-shadow ring in `rgba(91, 50, 148, 0.15)`. Keypad defaults to `decimal-pad` or `numeric`.

### 6. Sync Indicator & Webhook Diagnostics Bar
- Sticky bar at the top or bottom of list views indicating connection status to WooCommerce REST API and Dokan endpoints.
- Displays ping latency (e.g., `Live 42ms`) and a manual "Force Sync" icon trigger. When offline, converts into an ambient warning bar reading `Offline Mode: 4 Edits Queued`.