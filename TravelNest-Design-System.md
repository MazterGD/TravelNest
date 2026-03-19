# TravelNest Design System

## 1. Brand Philosophy & Principles
TravelNest is a bus rental marketplace platform for Sri Lanka, connecting customers with bus owners. Our brand identity requires a trustworthy, warmly Sri Lankan, and conversational personality backed by a modern, cinematic, and minimalistic design language.

### Core Principles
- **Use Color Only When It Guides:** Color is strictly functional. Our primary blue is reserved exclusively for interactive elements.
- **Warmly Sri Lankan & Human:** Avoid generic icons and sterile stock photos. Use custom illustrations, real human faces, and authentic local photography to build emotional connection.
- **Cinematic & Minimalistic:** Emphasize spaciousness, large high-quality imagery, and clear hierarchy over cluttered UI.
- **Conversational Trust:** Ensure all copy, empty states, and error messages sound helpful, human, and reassuring.
- **Delight in the Details (with Restraint):** Interactions should feel alive, tactile, and charming using soft spring physics. However, delight must never compromise speed. **Motion Restraint Rule:** No more than one active animated interaction per component at a time.
- **Accessible by Default:** Every component must meet WCAG AA contrast standards and support keyboard navigation.
- **Mobile-First:** Marketplace traffic is mobile-dominant. Interactions, layouts, and typography must scale perfectly to small screens.
- **Speed & Clarity:** Users should understand bus availability, pricing, and features in under 2 seconds. `Speed > Clarity > Trust > Delight`.

---

## 2. Color System & Tokens
Our strict design philosophy demands that we **use color only when it guides**. We avoid rainbow gradients and arbitrary decorative colors. 
*Note: Dark mode is intentionally not supported in v1.0 to ensure strict brand consistency and warm lighting in our photography.*

### Semantic Design Tokens
#### Interactive Colors (The Guide)
Used strictly for actionable elements.
- `--color-action-primary`: `#20B0E9` (Base)
- `--color-action-primary-hover`: `#1D9ED1` (Darken 10%)
- `--color-action-primary-active`: `#1A8CB9` (Darken 20%)
- `--color-action-focus`: `#20B0E9` (Used with a 2px outline and 2px offset)
- `--color-action-disabled`: `#CBD5E1` (Neutral-300)

#### Neutral Palette (The Foundation)
Used entirely for typography, backgrounds, cards, and borders.
- `--color-bg-base`: `#FFFFFF` (Main page backgrounds)
- `--color-bg-surface`: `#F8FAFC` (Secondary backgrounds, Bento grid cards)
- `--color-text-primary`: `#0F172A` (Headings, primary body text)
- `--color-text-secondary`: `#475569` (Supporting text, metadata, captions)
- `--color-text-tertiary`: `#94A3B8` (Disabled states, placeholders)
- `--color-border-default`: `#E2E8F0` (Card borders, input borders, dividers)

#### Feedback Colors (Alerts & Validation)
- `--color-success-bg`: `#D1FAE5`
- `--color-success-text`: `#065F46`
- `--color-success-border`: `#10B981`
- `--color-error-bg`: `#FEE2E2`
- `--color-error-text`: `#991B1B`
- `--color-error-border`: `#EF4444`

---

## 3. Typography
Typography is clean, modern, and highly legible. Maximum line length is restricted to **60–75 characters** for optimal readability in text blocks.

- **Primary Font**: `Inter`
- **Font Weights**: Regular (400), Medium (500), Semibold (600), Bold (700).

### Type Scale & Responsive Tokens

| Token | Desktop Size/Line-Height | Mobile Size/Line-Height | Weight | Letter Spacing | Usage |
|-------|--------------------------|-------------------------|--------|----------------|-------|
| `text-display` | 48px / 56px | 36px / 44px | Bold | `-0.02em` | Cinematic headers |
| `text-heading-lg` | 36px / 44px | 28px / 36px | Bold | `-0.01em` | Page titles |
| `text-heading-md` | 24px / 32px | 20px / 28px | Semibold | `0` | Section titles, Bento cards |
| `text-body-lg` | 18px / 28px | 16px / 24px | Regular | `0` | Conversational intros |
| `text-body` | 16px / 24px | 16px / 24px | Regular | `0` | Standard UI text |
| `text-caption` | 14px / 20px | 14px / 20px | Regular | `0` | Metadata, tags, small print |

---

## 4. Grid & Layout System
TravelNest heavily relies on **Bento Grids** for a modern, structured presentation of information.

### Breakpoints & Grid Structure
- **Mobile**: `0–639px` (1 column grid, 16px content padding)
- **Tablet**: `640–1023px` (2-4 column grid, 24px content padding)
- **Desktop**: `1024–1439px` (12 column grid, 32px content padding)
- **Wide**: `1440px+` (12 column grid, 32px content padding)

### Layout Specifications
- **Container Max-Width**: `1280px`
- **Grid Gaps**: `24px` standard gap between Bento grid items.
- **Max Content Width**: `720px` max-width for long text blocks (e.g., About Us, descriptions) to maintain readability.
- **Spacing Scale**: 8px modular scale (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- **Touch Targets**: All interactive elements on mobile must be a minimum of **44px by 44px**.

---

## 4.1 Flowless Corners — Concentric Radius System
Corners must feel **visually continuous** across nesting levels. We follow the **Concentric Radii Principle**: an inner element's corner radius should equal the outer container's radius minus the gap between them, so the curves appear parallel and optically harmonious.

```
inner_radius = outer_radius − gap_to_edge
```

### The Three-Level Scale

| Token | Value | Usage | Tailwind |
|-------|-------|-------|---------|
| `--radius-card` | `20px` | Cards, panels, search bar container, modals | `rounded-[20px]` |
| `--radius-interactive` | `12px` | Buttons, inputs, icon badges | `rounded-xl` |
| `--radius-chip` | `8px` | Chips, tags, amenity badges, small overlays | `rounded-lg` |
| (implicit) | `9999px` | Circular avatars, step icons, progress bars | `rounded-full` |

### Why These Exact Values
The Search Bar is the clearest demonstration of the principle in action:
- **Outer container** `rounded-[20px]` + **padding** `p-2` (8px) → **Search button** `rounded-xl` (12px)
- Proof: `20px − 8px = 12px` ✓ — the inner button's curve is geometrically concentric with the card's curve.

### Rules
1. **Never equal.** Two adjacent elements at the same radius look accidental, not intentional.
2. **Never wildly different.** A card at `20px` with a pill button at `9999px` looks disjointed.
3. **The gap tells the story.** The difference between outer and inner radius should approximately match the physical padding gap between them.

---

## 5. Comprehensive Component Inventory
A mature marketplace requires a strictly governed inventory of components to prevent UI fragmentation. TravelNest defines the following **40+ core components**, categorized by function:

### 5.1 Core Primitives & Actions
- **Button**: Primary, Secondary, Ghost. Height: `44px`, Border-radius: `12px` (`--radius-interactive`).
- **IconButton**: For standalone actions (e.g., Favorite, Close). Must include `aria-label`.
- **Avatar / AvatarGroup**: Circular image components for Owners, Drivers, and Reviewers. Fallbacks to text initials if no image exists.
- **Badge / Tag**: Minimalist pill shape. Used for features ("A/C") or status ("Verified"). Uses neutral borders or semantic success/error backgrounds.
- **Divider / Separator**: `1px` solid `--color-border-default` for clear visual breaks.
- **Tooltip**: `--duration-standard` fade-in. Dark background, white text for secondary context.

### 5.2 Forms & Inputs
- **TextInput**: Height `44px`, border `--color-border-default`. Smooth border-draw to `--color-action-focus` on focus.
- **TextArea**: Multi-line input for messages and reviews. Bottom-right resize handle.
- **SelectDropdown**: Custom-styled dropdown matching TextInput anatomy to avoid native browser inconsistencies.
- **DateRangePicker**: Calendar interface. Highlights the selected date range with a faint primary blue background.
- **NumberStepper**: Passenger/Seat count controller with `+` / `-` buttons.
- **Checkbox & CheckboxGroup**: Custom SVG checkmarks using `--color-action-primary` for active states.
- **RadioButton & RadioGroup**: Circular selections using `--color-action-primary`.
- **Toggle / Switch**: For instant preferences (e.g., "Show A/C Only"). Bouncy spring animation on toggle.
- **FileUpload**: Drag-and-drop zone with a dashed neutral border. Used for owner document or bus photo uploads.

### 5.3 Navigation & Layout
- **TopNav**: Desktop header. Transparent on cinematic hero images, smoothly transitions to solid `--color-bg-base` on scroll.
- **MobileBottomNav**: Sticky bottom bar on mobile with 3-4 core destinations (Search, Bookings, Profile).
- **Breadcrumbs**: Inline text navigation using `--color-text-secondary`, separated by chevrons (`>`).
- **Tabs**: Horizontal navigation (e.g., Details | Reviews | Policies). The active tab has a `2px` `--color-action-primary` bottom border.
- **Pagination**: Minimalist numbered list for desktop, or a full-width "Load More" button for mobile.
- **Drawer / Sidebar**: Off-canvas slide-in container. Used for mobile menus or desktop advanced search filters.

### 5.4 Feedback & Overlays
- **AlertBanner**: Full-width or inline banner for system messages, using semantic background/text colors (Success/Error).
- **ToastNotification**: Slide-up snackbar for transient feedback (e.g., "Link copied", "Saved to favorites").
- **Modal / Dialog**: Centered overlay with a dark backdrop blur. Enters with a soft spring scale-in.
- **SkeletonLoader**: Shimmering neutral shapes to indicate loading states before images or text populate.
- **Spinner / Loader**: A custom "rotating steering wheel" for playful contexts, or a clean primary blue circle for standard contexts.
- **EmptyState**: A cluster containing a custom illustration, a conversational explanation, and a primary call-to-action button.

### 5.5 Data Display
- **ImageCarousel / Gallery**: For browsing bus photos. Uses dots for pagination and arrows on desktop hover.
- **Accordion / Disclosure**: Expandable rows for FAQs and policy details. Uses `spring-smooth` for layout expansion.
- **Table**: Clean, unbordered rows for structured tabular data (e.g., admin views, detailed engine specs).
- **Bento Feature Grid**: Rounded `--color-bg-surface` cards used to display bus amenities in a visually engaging way.

### 5.6 Marketplace & Booking Domain
- **SearchBar**: A unified, multi-input bar combining "Origin", "Destination", "Dates", and "Passengers".
- **FilterChips**: Horizontally scrollable chips on mobile for quick sorting (Price, A/C, Rating).
- **BusCard**: Cinematic `16:9` image, route, owner avatar, clear price display, and a primary action button.
- **SeatSelector / SeatMap**: Interactive grid for seat booking. Available (neutral outline), Selected (primary blue fill), Booked (disabled neutral fill).
- **PriceBreakdown**: Expandable list clearly separating the base fare, taxes, and service fees.
- **ReviewCard**: Contains an Avatar, star rating (using neutral/yellow colors), and warm conversational text.
- **OwnerProfileCard**: Trust-building card featuring verified badges, response times, and a localized greeting.
- **BookingStepper**: A visual progress bar detailing checkout flow (Search > Select Seats > Details > Pay).
- **ItineraryTimeline**: A vertical line with nodes detailing boarding points, rest stops, and drop-off points.

---

## 6. Motion & Micro-interaction System
Motion makes the interface feel organic, friendly, and deeply satisfying. We use **Spring Physics** via `motion/react`. 

### Motion Restraint (Crucial Rule)
**Avoid Motion Density.** Limit high-impact animations to singular moments of success or critical transitions. Standard UI interactions must remain subtle.

### Motion Tokens & Physics
- **`spring-bouncy`**: `stiffness: 460, damping: 17`. Used for CTA buttons — provides a snappy overshoot on arrow translation and scale lift.
- **`spring-smooth`**: `stiffness: 300, damping: 30`. Used for layout shifts, card expansions, modals, and section reveals.

### Core Patterns
1. **The "Squish & Pop"**: Clickable elements scale down to `0.95` on mouse-down, snapping back with `spring-bouncy` overshoot to `1.0`. (Low Motion Level)
2. **Card Hover**: Card lifts (`translate-y: -4px`) while image zooms (`scale: 1.05`). (Medium Motion Level)
3. **Success State**: Slide up toast with a subtle bounce. (High Motion Level)

### 6.1 CTA Button Micro-interaction Stack
Primary CTA buttons use a 4-layer interaction system. All layers respect `prefers-reduced-motion` (fallback: CSS `transition-colors` only). Implemented via the shared `<CTAButton>` component.

| # | Layer | Trigger | Behaviour | Physics |
|---|-------|---------|-----------|---------|
| 1 | **Scale lift** | Hover start | `scale: 1.0 → 1.02` | `spring-snap` |
| 2 | **Glow shadow** | Hover start | `box-shadow: 0 8px 24px -4px rgba(32,176,233,0.42)` (primary only) | `spring-snap` |
| 3 | **Arrow slide** | Hover start | Right icon translates `x: 0 → 4px` | `spring-snap` |
| 4 | **Squish tap** | Mouse down | `scale: 0.96`, returns to rest on release | `spring-snap` |

**`spring-snap`** — `stiffness: 350, damping: 45`. Critically damped (`2√350 ≈ 37.4`, damping 45 exceeds threshold), so all motion settles at its target with zero overshoot or bounce.

> **Nav button focus rings** use `focus-visible:ring` (not `focus:ring`) so the ring only appears during keyboard navigation, never after a mouse click.

**Component API:**
```tsx
<CTAButton
  variant="primary"   // 'primary' | 'secondary'
  size="lg"           // 'sm' (40px) | 'md' (44px) | 'lg' (52px)
  icon={<ArrowRight />}
  iconPosition="right" // 'left' | 'right'
>
  Find Your Bus Now
</CTAButton>
```

**Dark background usage:** Pass `className="focus:ring-offset-[#0F172A]"` when placing CTAButton on a dark section (e.g., OwnerCTA).

---

## 7. Data Display Patterns
Marketplaces require structured data UX patterns:
- **Filters**: Horizontal scrollable chips on mobile.
- **Availability Calendars**: Use clear `--color-success-bg` for available days and crossed-out `--color-text-tertiary` for unavailable days.
- **Pricing Details**: Expanding pricing breakdowns should slide down smoothly, aligning numbers right for easy reading.
- **Pagination**: Minimalist numbered list or "Load More" primary button.
- **Empty States**: Must include a custom illustration, conversational explanation, and a clear next-action button.

---

## 8. Imagery & Iconography

### Technical Standards
- **Image Ratio**: `16:9` (Cinematic covers) or `4:3` (Bus gallery grids).
- **Image Resolution**: Minimum `1600px` width for hero images.
- **Compression**: WebP format required.
- **Icon Size**: `20px` (inline buttons) or `24px` (standalone/navigation).

### Direction
- Showcase real Sri Lankan landscapes, actual buses, and warm human faces.
- Icons must be minimal, clean, monolinear stroke icons (e.g., Lucide).

---

## 9. Content & Copywriting
The TravelNest voice is **Conversational, Warm, Confident, and Local**.

### Voice Attributes
- **Warm & Cute**: "Woohoo! Your bus to Kandy is confirmed."
- **Confident**: Clear instructions ("Book this bus").
- **Local**: Sri Lankan cultural context built into the welcome states ("Ayubowan! Welcome to TravelNest."). Note: Keep core business flows (like checkout) professional to maintain trust.

### Error Message Framework
`Problem` + `Explanation` + `Next Step`.
- ✅ **Good**: "Oops, no buses are rolling on these dates! Try shifting your trip by a day or two."

---

## 10. Accessibility Guidelines
- **Contrast Ratios**: 
  - Normal text to background: `4.5:1` minimum.
  - Large text (Headings) & Essential Icons: `3:1` minimum.
- **Keyboard Navigation**: Tab order must strictly match the visual hierarchy. 
- **Focus States**: Visible focus outlines (`--color-action-focus`) are mandatory and must never be disabled.
- **ARIA Standards**: All icon-only buttons (e.g., hamburger menu, close X) MUST have an `aria-label`.
- **Reduced Motion**: Respect `prefers-reduced-motion` OS settings by falling back to opacity fades instead of springs.

---

## 11. Engineering Implementation & Governance

### Frameworks & Tooling
- **Styling**: Tailwind CSS v4.
- **Animations**: `motion/react`.
- **Icons**: `lucide-react`.

### Component Documentation (Storybook)
All components must be documented in a central Storybook instance, showcasing all anatomical states (Default, Hover, Active, Focus, Disabled, Loading).

### Tailwind Implementation Example
Tokens should map directly to Tailwind configuration:
```css
@theme {
  --color-action-primary: #20B0E9;
  --radius-card: 20px;        /* Level 1 — Cards & Panels */
  --radius-interactive: 12px; /* Level 2 — Buttons & Inputs */
  --radius-chip: 8px;         /* Level 3 — Chips & Badges */
}
```

### Governance Model & Versioning
- **Design Lead**: Visual direction, Figma token updates.
- **Frontend Lead**: React component architecture, accessibility compliance, Storybook maintenance.
- **Product Manager**: Aligning components to marketplace feature requirements.

**Contribution Workflow**: Proposal → Design Review → Engineering Implementation → Storybook Documentation.
**Versioning Strategy**:
- `v1.0` – Core foundation & UI components
- `v1.1` – Booking flow components & Data UX patterns
