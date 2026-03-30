# GreenWaveReady architecture

## 1) Layered runtime model

```txt
Layer A — Base Map Layer (MapLibre)
  - tiles, roads, labels, projection, camera primitives
Layer B — 3D World Layer (Three.js contracts)
  - trees/buildings/vehicle scene objects, quality modes, sync state
Layer C — Navigation Layer
  - route progress, camera policy, maneuver/ETA/passed-route state
Layer D — Backend Layer (Fastify)
  - route compute, route normalization, alternatives, telemetry placeholders
```

## 2) Mobile architecture

```txt
apps/mobile
  src/app
    navigation-root.tsx
  src/features
    route-planning/
    active-navigation/
    navigation/
    map/
    debug/
    settings/
  src/state
    routeSlice.ts
    vehicleSlice.ts
    uiSlice.ts
```

### Responsibilities split

- `MapLibreMapView` is authoritative for camera + route geodata rendering.
- `@greenwave/map-core` encapsulates camera frame policy and coordinate helpers.
- `@greenwave/three-world` encapsulates scene synchronization and density/quality policies.
- `@greenwave/navigation-core` owns progress and location pipeline logic.

## 3) API architecture

```txt
apps/api
  providers/
    routing-provider.ts        # interface
    mock-routing-provider.ts   # MVP provider
  services/
    route-service.ts           # use cases
  normalizers/
    route-normalizer.ts        # provider payload hardening
  routes/
    navigation.ts
    green-wave.ts
```

## 4) Performance notes

- Route and passed-route layers are memoized GeoJSON fragments.
- World objects are corridor-scoped and controlled by quality mode (`low|medium|high`).
- Location pipeline filters heading harder at low speed to reduce jitter.
- No heavy post-processing in MVP; effects are designed as optional future modules.

## 5) Green-wave extension plan

1. Add signal ingestion stream → persist into PostGIS.
2. Add phase predictor worker (separate process when CPU pressure appears).
3. Expose `/green-wave/corridors` with confidence envelopes.
4. Render corridor confidence bands in route layer + world layer.
5. Add speed-advice controller coupled to maneuver horizon.

## 6) Trade-offs

### Option A: Modular monolith (current)
- ✅ Faster delivery and easier local dev.
- ⚠️ Prediction workloads may compete with route API latency.

### Option B: early split of predictor service
- ✅ Better isolation and independent scaling.
- ❌ More infra/ops overhead before product validation.

Current choice: **Option A**, with contracts already prepared for future split.
