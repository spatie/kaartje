# kaartje

kaartje is our postcardware app that lets people send us digital postcards. All of our open source packages are free to use, with one small, friendly request: send us a postcard from your hometown. Over the years, we’ve received hundreds of postcards from developers all around the world—and with kaartje, we’re now bringing that tradition into the digital world.

## What it does

**Scan** a postcard with the mobile app, **swipe it up** to send it flying to the web app, and **watch it arrive** on a 3D globe — spinning alongside hundreds of other postcards from around the world. Click a card to catch it and read the message, then let it go and watch it float back.

The whole flow is connected via WebSockets, so the moment you swipe a card on your phone, it appears on the big screen in real time.

### The web app

An Astro site with a Three.js globe at its center. Postcards orbit the globe as small 3D cards. When a new card arrives (via WebSocket), it flies in from behind the camera, pauses in front of you, then joins the orbit. Click any card to pull it toward the camera and interact with it.

### The mobile app

An Expo app used to scan physical postcards. Point the camera at a card, capture both sides, and swipe up to send it to the server. The swipe gesture launches the card off-screen with a satisfying animation — and triggers the arrival event on the web app.

### The API

A Bun server that acts as the bridge. It stores postcard data, serves it to the web app, and manages WebSocket connections to push real-time events (card scanned, card arriving, card landed) between mobile and web clients.

## Tech stack

| Package           | Tech                                   | Purpose                    |
| ----------------- | -------------------------------------- | -------------------------- |
| `@kaartje/api`    | Bun, TypeScript                        | HTTP server + WebSockets   |
| `@kaartje/web`    | Astro 6, Tailwind v4, Three.js         | 3D globe + postcard viewer |
| `@kaartje/mobile` | Expo 55, React Native 0.83, Reanimated | Postcard scanner + sender  |

### Monorepo

Managed with npm workspaces. Each package lives in `packages/` and has its own TypeScript config (strict mode across the board). No shared packages yet — each workspace is self-contained.

## Getting started

```bash
# Install dependencies
npm install

# Start all three in separate terminals
npm run dev:api      # Bun server on :3000
npm run dev:web      # Astro dev server
npm run dev:mobile   # Expo dev server
```

### Mobile dev build

The mobile app uses Continuous Native Generation (CNG). Native `ios/` and `android/` directories are generated at build time and gitignored.

```bash
# Generate native projects and build
npm run ios --workspace=@kaartje/mobile
npm run android --workspace=@kaartje/mobile

# Clean rebuild (wipes and regenerates native dirs)
npm run prebuild:clean --workspace=@kaartje/mobile
```

### Lint & format

```bash
npm run lint         # oxlint
npm run fmt          # oxfmt --write
npm run fmt:check    # oxfmt --check
```

## Postcardware

You're free to use Spatie's packages, but if they make it to your production environment we'd appreciate a postcard from your hometown:

**Spatie**
Kruikstraat 22, Box 12
2018 Antwerp, Belgium

We publish all received postcards on [our website](https://spatie.be/open-source/postcards).
