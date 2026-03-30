# GreenWaveReady architecture draft

## Runtime topology

```txt
Mobile App (React Native)
   |  Route requests, telemetry
   v
Navigation API (Fastify)
   |  RoutingProvider abstraction
   v
Routing backend (Mock now, Valhalla later)

Green Wave module (placeholder contracts) can run in API process for MVP,
then split into dedicated service once prediction workloads increase.
```

## Design options and trade-offs

### Option A: Modular monolith (chosen for MVP)
- **Pros**: fastest delivery, lower ops overhead, easy local startup.
- **Cons**: CPU-heavy prediction jobs may contend with route API latency.

### Option B: Split green-wave engine early
- **Pros**: isolated scaling and deployments for prediction workloads.
- **Cons**: more infra complexity before product-market fit.

## Current extension points

- `RoutingProvider` interface in API to swap Mock/Valhalla/Commercial routing.
- `MapAdapter` boundary in mobile to swap MapLibre style/tile sources.
- Shared domain contracts in `packages/types` for traffic-light entities and corridor overlays.
- Simulation mode and debug HUD to tune camera, route progress and map-matching behavior.

## Bottlenecks to profile first

1. Route polyline rendering and rerender churn (React profiler + flamegraph).
2. GPS smoothing on UI thread (keep in isolated hooks and memoized selectors).
3. API tail latency during reroute bursts (k6/load tests + p95/p99 budgets).
