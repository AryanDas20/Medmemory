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

## Cloud light — light theme

| Role | Value |
| --- | --- |
| Primary | `#087F8C` |
| Primary strong | `#066B78` |
| Primary soft | `#087F8C1C` (11% opacity) |
| Secondary / iris | `#6759D7` |
| Secondary soft | `#6759D71B` (10.5% opacity) |
| Accent / apricot | `#A75C15` |
| Accent soft | `#A75C151C` (11% opacity) |
| Background | `#F4F7FC` |
| Soft background | `#EAF0F8` |
| Surface | `#FFFFFF` |
| Elevated surface | `#F8FAFE` |
| Card | `#FFFFFF` |
| Primary text | `#17263B` |
| Secondary text | `#40536C` |
| Muted text | `#5A6B82` |
| Border / divider | `#53698B2E` (18% opacity) |
| Strong border | `#53698B54` (33% opacity) |
| Hover surface | `#087F8C13` (7.5% opacity) |
| Active surface | `#087F8C1F` (12% opacity) |
| Focus | `#087F8C` |
| Disabled | `#A4B0C1` |
| Chart series 1–5 | `#087F8C`, `#6759D7`, `#B86B1D`, `#216EA8`, `#BE5D88` |
| Success | `#087C59` |
| Warning | `#99600E` |
| Error | `#BD3D5A` |
| Information | `#216EA8` |

## Gradient guidance

- Dark primary action: `#10AFA2` → `#35D0BA`; light primary action: `#066B78` → `#087F8C`.
- Accent action: `#9387FF` → `#B4A9FF` in dark mode; the light theme uses the same iris accent over a light surface.
- Hero background: `#152B40` → `#252750` → `#3A315F`, with restrained teal and iris radial highlights.
- Card surfaces use the theme's surface and elevated-surface tokens rather than one-off gradients.
- Status colors are reserved for status communication; labels and text remain present so meaning is not conveyed by color alone.

## Accessibility notes

The selected light-theme text accents were checked against white surfaces: primary teal is approximately 4.75:1, iris is approximately 5.27:1, apricot is approximately 5.02:1, muted text on the soft background is approximately 4.75:1, success is approximately 5.20:1, and danger is approximately 5.28:1. Dark-theme primary text on the midnight background is approximately 17.5:1; muted text on a dark card is approximately 5.7:1. Keyboard focus uses a visible 3px outline. Reduced-motion preferences continue to disable decorative animations.

The palette is centralized in CSS custom properties near the end of `public/app.css`. Existing page components consume semantic aliases such as `--bg`, `--panel`, `--text`, `--muted`, `--neon`, `--red`, `--amber` and `--blue` to keep legacy screens consistent with the refreshed system.


## Profile illustrations and usage

The redesigned profile area uses a custom consultation illustration (`public/assets/profile-consultation.webp`) with supporting vector artwork for care connections and privacy (`profile-care.svg` and `profile-privacy.svg`). The hero art is stored locally and optimized as WebP to avoid a third-party image dependency. Decorative float motion is disabled when reduced motion is requested.

The profile includes personal identity, contact and location details, emergency contact, optional health context, and clinician-only professional credentials. Public profile visibility is deliberately separate from health-record sharing: health records require the existing approved care connection and explicit `shareWithDoctors` setting. Uploaded profile and cover images are signed for other users only when the owner has enabled public basic-profile visibility; the existing owner and connected-clinician access rules continue to apply.
