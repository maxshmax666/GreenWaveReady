# GreenWaveReady

Premium navigation monorepo foundation: **MapLibre = geospatial source of truth**, **Three.js layer = cinematic world enrichment**, **Fastify API = routing and green-wave-ready contracts**.

## Minimum requirements

- Node.js **20.11.1+**
- npm **10.8.2+**
- Expo SDK **53** (project dependency: `expo ~53.0.9`)
- iOS **16+** / Android **10+**
- **Expo Go = limited mode only** (works when using a fallback map adapter without native MapLibre bindings).
- **Custom Dev Client = required for full map functionality** (`@maplibre/maplibre-react-native` native module).

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

## Mobile env matrix (dev / stage / prod)

| Variable | Development | Stage | Production | Notes |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_ROUTING_BASE_URL` | Optional (`http://localhost:3000` fallback only in `NODE_ENV=development`) | **Required**, HTTPS, non-localhost/non-private IP | **Required**, HTTPS, non-localhost/non-private IP | Used by mobile routing client and validated at startup/CI. |
| `EXPO_PUBLIC_MAP_STYLE_URL` | Optional (`https://demotiles.maplibre.org/style.json` fallback only in `NODE_ENV=development`) | **Required**, HTTPS, non-localhost/non-private IP | **Required**, HTTPS, non-localhost/non-private IP | Style URL for MapLibre map. |
| `EXPO_PUBLIC_MAP_TILE_ENDPOINT` | Optional (`https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf` fallback) | Optional, if set must be HTTPS and public | Optional, if set must be HTTPS and public | Endpoint for vector tiles. |

### Release notes (env hardening)

- Production mobile builds now fail fast when `EXPO_PUBLIC_ROUTING_BASE_URL` or `EXPO_PUBLIC_MAP_STYLE_URL` are missing.
- Runtime config rejects localhost/private URLs and non-HTTPS URLs outside development.
- CI runs a prebuild env validation (`npm run check:mobile-env`) before Android release prebuild.
- Startup logs include only URL hosts (no query string/tokens).

## Run

### API

```bash
npm run dev -w @greenwave/api
```

### Mobile runtime matrix

| Runtime | Start command | What works | What does not work |
| --- | --- | --- | --- |
| **Expo Go** | `npm run dev -w @greenwave/mobile` | App shell, navigation state/debug UI, any screen that uses `MockMapView` fallback | Native MapLibre view (`MapLibreMapView`) and full in-map rendering pipeline |
| **Dev Client (custom build)** | `npm run dev:client -w @greenwave/mobile` (after `npm run android` / `npm run ios`) | **Full functionality**: MapLibre map, camera, route layers, overlays, vehicle rendering | None of the MapLibre-related features are missing |

### Mobile: Expo Go (fallback mode)

```bash
npm run dev -w @greenwave/mobile
```

Open the project in Expo Go (QR code / project list).

Fallback map component exists at `apps/mobile/src/features/map/mock-map-view.tsx`.

To enable it for Expo Go in the current codebase (manual switch):

1. Open `apps/mobile/src/features/navigation/navigation-screen.tsx`.
2. Replace `MapLibreMapView` import with `MockMapView`.
3. Replace `<MapLibreMapView ... />` render with `<MockMapView ... />` using the same props.

This fallback keeps the feature flow testable in Expo Go without native MapLibre bindings.

### Mobile: Dev Client (MapLibre native, full mode)

```bash
npm run android -w @greenwave/mobile
npm run dev:client -w @greenwave/mobile
```

For iOS dev build, run `npm run ios -w @greenwave/mobile` before `npm run dev:client -w @greenwave/mobile`.

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
