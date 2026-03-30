# GreenWaveReady

Production-grade monorepo foundation for a premium personal navigation app with 3D driving UX and Green Wave-ready architecture.

## Minimum requirements

- Node.js **20.11.1+**
- npm **10.8.2+**

## Monorepo layout

```txt
apps/
  mobile/              # React Native + Expo mobile client
  api/                 # Fastify API and routing abstraction
packages/
  types/               # Shared domain + contract types
  navigation-core/     # Route progress, filtering and camera strategies
  ui/                  # Reusable cross-feature UI primitives
  utils/               # Shared utilities (timing, math, guards)
  config/              # Shared runtime/config helpers
infra/
  docker/              # Local infra compose files
  scripts/             # Dev scripts
docs/
  architecture.md      # Architecture and extension points
```

## Quick start

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run dev -w @greenwave/api
npm run dev -w @greenwave/mobile
```

## What is implemented in this draft

- Mobile skeleton with modular map/navigation flow, simulation mode, debug HUD, follow/overview camera control and placeholders for MapLibre adapter.
- API skeleton with `RoutingProvider` abstraction, telemetry ingestion placeholder, green-wave placeholder endpoints.
- Shared route annotations model, vehicle state model, traffic-light prediction contracts.
- Mock mode switches in both mobile and API.

## Key architecture choices

1. **Adapter boundaries from day 1**: map rendering and routing are swappable via interfaces.
2. **Strict TS + isolated modules**: avoids giant navigation screens and uncontrolled state drift.
3. **Green Wave as first-class domain package**: data contracts exist now, prediction engine can plug in later.

See [docs/architecture.md](docs/architecture.md) for trade-offs and bottlenecks.
