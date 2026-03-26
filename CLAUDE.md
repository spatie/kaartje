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
- No shared packages or cross-package dependencies yet
- Each package has its own `tsconfig.json` (API uses Bun types, Web extends Astro strict, Mobile extends Expo base)
- API runs on Bun's native `Bun.serve()`, not Express or Hono
- Web uses Astro (no UI framework integration yet)
- Mobile uses Expo Router (file-based routing in `app/` directory) with a Stack navigator

## Mobile Conventions

- **Styling**: Use `react-native-unistyles` — import `StyleSheet` from `react-native-unistyles`, not from `react-native`
- **Animations**: Use `react-native-reanimated` for all animations
- **3D**: Use `@react-three/fiber` with `three` for 3D rendering
