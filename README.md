# GreenWaveReady

Premium navigation monorepo foundation: **MapLibre = geospatial source of truth**, **Three.js layer = cinematic world enrichment**, **Fastify API = routing and green-wave-ready contracts**.

## Minimum requirements

- Node.js **20.11.1+**
- npm **10.8.2+**
- Expo Go SDK 53 / iOS 16+ / Android 10+

## Monorepo layout

```txt
apps/
  mobile/              # React Native app + active driving mode + debug tools
  api/                 # Fastify API + routing/normalization services
packages/
  types/               # Domain contracts (LatLng, NavigationRoute, TrafficLight, ...)
  navigation-core/     # Progress, camera model, position pipeline
  map-core/            # MapLibre camera abstractions + coordinate helpers
  three-world/         # Three.js world manager contracts + quality modes
  ui/                  # Shared UI atoms
  utils/               # Shared utilities
  config/              # Runtime config
infra/
  docker/              # Postgres/PostGIS-ready compose baseline
docs/
  architecture.md      # Layer split, trade-offs, next milestones
```

## Setup

```bash
npm install
npm run typecheck
npm run lint
```

## Run

### API

```bash
npm run dev -w @greenwave/api
```

### Mobile: Expo Go

```bash
npm run dev -w @greenwave/mobile
```

Open the project in the Expo Go app (QR code / project list).

### Mobile: Dev Client (MapLibre native)

```bash
npm run android -w @greenwave/mobile
npm run dev:client -w @greenwave/mobile
```

For iOS dev build, use `npm run ios -w @greenwave/mobile` before `npm run dev:client -w @greenwave/mobile`.

### Troubleshooting

If you see a JSON manifest in the browser, the dev URL was opened with the wrong client.
Use Expo Go for `npm run dev`, and use the installed Dev Client app for `npm run dev:client`.

## What is implemented

- React Navigation app shell with route planning, active navigation, and debug/settings screens.
- Navigation MVP flow: route fetch, active route + passed route rendering, ETA/progress, follow/overview camera, vehicle marker.
- Location pipeline split: raw GPS → filtered GPS → snapped/rendered position.
- MapLibre abstraction and camera controller (`@greenwave/map-core`).
- Three-world architecture (`@greenwave/three-world`) with quality modes (`low/medium/high`) and synchronized world object generation.
- API layer with `RoutingProvider` + `RouteService` + `RouteNormalizer`, route/recalculate/map-match endpoints, telemetry and green-wave placeholders.

## Why this split

- **Maintainability**: map rendering, world rendering, and routing are isolated by interfaces.
- **Performance path**: quality mode and corridor-scoped object generation avoid full-scene overload on mobile.
- **Green-wave readiness**: traffic light and corridor contracts already exist in shared types, so future prediction engines can be plugged into API + overlays without rewriting app foundations.
