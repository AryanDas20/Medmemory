# MedMemory AI — Brand Color System

## Brand direction

MedMemory AI now uses a calm, optimistic healthcare palette built around **teal** (care, clarity and trust), **iris** (intelligence and digital guidance), and **apricot** (warmth and human attention). Neutral surfaces carry most of the interface so charts, alerts and actions remain easy to scan.

## Midnight teal — dark theme

| Role | Value |
| --- | --- |
| Primary | `#35D0BA` |
| Primary strong | `#10AFA2` |
| Primary soft | `#35D0BA24` (14% opacity) |
| Secondary / iris | `#9387FF` |
| Secondary soft | `#9387FF26` (15% opacity) |
| Accent / apricot | `#FFB86B` |
| Accent soft | `#FFB86B24` (14% opacity) |
| Background | `#0B1220` |
| Soft background | `#111B2E` |
| Surface | `#151F33` |
| Elevated surface | `#1C2942` |
| Card | `#17243A` |
| Primary text | `#F5F7FF` |
| Secondary text | `#B6C2D7` |
| Muted text | `#8999B3` |
| Border / divider | `#A3B5D52E` (18% opacity) |
| Strong border | `#A3B5D557` (34% opacity) |
| Hover surface | `#35D0BA1B` (10.5% opacity) |
| Active surface | `#35D0BA2B` (17% opacity) |
| Focus | `#55D9C6` |
| Disabled | `#56647A` |
| Chart series 1–5 | `#35D0BA`, `#9387FF`, `#FFB86B`, `#71BDFF`, `#F28DB7` |
| Success | `#43D6A2` |
| Warning | `#FFC66D` |
| Error | `#FF7893` |
| Information | `#71BDFF` |

## Twilight teal — light appearance (dark-toned)

| Role | Value |
| --- | --- |
| Primary | `#35D0BA` |
| Primary strong | `#10AFA2` |
| Primary soft | `#35D0BA24` (14% opacity) |
| Secondary / iris | `#9387FF` |
| Secondary soft | `#9387FF26` (15% opacity) |
| Accent / apricot | `#FFB86B` |
| Accent soft | `#FFB86B24` (14% opacity) |
| Background | `#111A2B` |
| Soft background | `#17243A` |
| Surface | `#1A2941` |
| Elevated surface | `#22334F` |
| Card | `#1D2C45` |
| Primary text | `#F5F7FF` |
| Secondary text | `#C1CBE0` |
| Muted text | `#9AA9C2` |
| Border / divider | `#A3B5D530` (19% opacity) |
| Strong border | `#A3B5D55C` (36% opacity) |
| Hover surface | `#35D0BA1C` (11% opacity) |
| Active surface | `#35D0BA2E` (18% opacity) |
| Focus | `#55D9C6` |
| Disabled | `#66758D` |
| Chart series 1–5 | `#35D0BA`, `#9387FF`, `#FFB86B`, `#71BDFF`, `#F28DB7` |
| Success | `#43D6A2` |
| Warning | `#FFC66D` |
| Error | `#FF7893` |
| Information | `#71BDFF` |

## Gradient guidance

- Midnight and Twilight primary actions: `#10AFA2` → `#35D0BA`.
- Accent action: `#9387FF` → `#B4A9FF` in both appearance settings, over dark navy surfaces.
- Hero background: `#152B40` → `#252750` → `#3A315F`, with restrained teal and iris radial highlights.
- Card surfaces use the theme's surface and elevated-surface tokens rather than one-off gradients.
- Status colors are reserved for status communication; labels and text remain present so meaning is not conveyed by color alone.

## Accessibility notes

Both appearance settings use dark-toned navy surfaces and the same high-contrast teal, iris and apricot accents; the light appearance uses a subtly brighter slate-navy surface scale rather than white cards. Keyboard focus uses a visible 3px outline. Reduced-motion preferences continue to disable decorative animations.

The palette is centralized in CSS custom properties near the end of `public/app.css`. Existing page components consume semantic aliases such as `--bg`, `--panel`, `--text`, `--muted`, `--neon`, `--red`, `--amber` and `--blue` to keep legacy screens consistent with the refreshed system.


## Profile illustrations and usage

The redesigned profile area uses a custom consultation illustration (`public/assets/profile-consultation.webp`) with supporting vector artwork for care connections and privacy (`profile-care.svg` and `profile-privacy.svg`). The hero art is stored locally and optimized as WebP to avoid a third-party image dependency. Decorative float motion is disabled when reduced motion is requested.

The profile includes personal identity, contact and location details, emergency contact, optional health context, and clinician-only professional credentials. Public profile visibility is deliberately separate from health-record sharing: health records require the existing approved care connection and explicit `shareWithDoctors` setting. Uploaded profile and cover images are signed for other users only when the owner has enabled public basic-profile visibility; the existing owner and connected-clinician access rules continue to apply.
