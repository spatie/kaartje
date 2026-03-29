# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kaartje is a monorepo with three packages managed via npm workspaces:

- **@kaartje/api** — Bun HTTP server (TypeScript)
- **@kaartje/web** — Astro 6 static/SSR site (TypeScript, strict mode)
- **@kaartje/mobile** — Expo 55 / React Native 0.83 app (TypeScript, strict mode)

## Commands

### Development

```bash
npm run dev:api      # Bun with --watch on packages/api
npm run dev:web      # Astro dev server on packages/web
npm run dev:mobile   # Expo start on packages/mobile
```

### Lint & Format

```bash
npm run lint         # oxlint
npm run fmt          # oxfmt --write .
npm run fmt:check    # oxfmt --check .
```

### Build

```bash
npm run build --workspace=@kaartje/web   # Astro build
```

### Mobile Platform

```bash
npm run android --workspace=@kaartje/mobile
npm run ios --workspace=@kaartje/mobile
```

## Architecture

- **npm workspaces** monorepo — packages live in `packages/*`
- **@kaartje/shared** — shared package consumed by web and mobile
  - `@kaartje/shared` — 3D components (DottedGlobe, FocusedCard, etc.)
  - `@kaartje/shared/api` — API client and shared types
- Each package has its own `tsconfig.json` (API uses Bun types, Web extends Astro strict, Mobile extends Expo base)
- API runs on Bun's native `Bun.serve()`, not Express or Hono
- Web uses Astro with React integration (`@astrojs/react`) for interactive islands
- Mobile uses Expo Router (file-based routing in `app/` directory) with a Stack navigator

## Mobile Conventions

- **Styling**: Use `react-native-unistyles` — import `StyleSheet` from `react-native-unistyles`, not from `react-native`
- **Animations**: Use `react-native-reanimated` for all animations
- **3D**: Use `@react-three/fiber` with `three` for 3D rendering

## Design system

A dark, minimal palette inspired by postcards. Warm paper tones on deep backgrounds, with stamp reds, postmark golds, and airmail blues as accents.

| Token                | Hex       | Role                  |
| -------------------- | --------- | --------------------- |
| Night                | `#0a0a0c` | Background            |
| Surface              | `#141418` | Cards, sections       |
| Elevated             | `#1e1e24` | Raised elements       |
| Ink                  | `#ede6db` | Primary text          |
| Ink Faded            | `#9b9489` | Secondary text        |
| Stamp                | `#c45a3c` | Primary accent        |
| Postmark             | `#a08c6a` | Secondary accent      |
| Airmail              | `#4a7fb5` | Tertiary accent       |
| Postcard Back        | `#f0ebe3` | Postcard paper color  |
| Postcard Text        | `#3a3632` | Text on postcard back |
| Postcard Divider     | `#c4bdb3` | Postcard divider line |
| Postcard Placeholder | `#b0a99e` | Postcard placeholder  |

Typography: **DM Serif Display** for headings, **DM Sans** for body text. Tokens are defined in Tailwind's `@theme` (web) and react-native-unistyles (mobile), kept in sync across both platforms.
