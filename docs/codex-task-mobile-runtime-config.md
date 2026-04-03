# Codex task: fix mobile runtime config in release APK

## Context

Android release APK builds are succeeding in GitHub Actions, and the workflow already passes these secrets into the build job:

- `EXPO_PUBLIC_ROUTING_BASE_URL`
- `EXPO_PUBLIC_MAP_STYLE_URL`
- `EXPO_PUBLIC_MAP_TILE_ENDPOINT`

The backend is also reachable in production:

- `https://api.tagil.pizza`
- `/health` returns `200 OK`

However, after installing the latest successful release APK, the app still crashes at startup with an error equivalent to:

- `missing_env EXPO_PUBLIC_ROUTING_BASE_URL`

## Root cause hypothesis

Runtime config in release mobile builds is reading from `process.env` only, while Expo release builds expose these values through `expo.extra` (via `app.config.ts`).

So the build succeeds with secrets present, but the installed APK still fails at runtime because the mobile app cannot resolve config values after installation.

## Relevant files

- `apps/mobile/app.config.ts`
- `packages/config/src/index.ts`
- `packages/config/src/index.test.ts`
- `.github/workflows/android-apk.yml`

## What needs to be fixed

1. Update runtime config resolution so that mobile release builds can read config from Expo runtime config / `expo.extra`.
2. Preserve current validation behavior for production URLs:
   - routing URL must be HTTPS in production
   - map style URL must be HTTPS in production
   - private IPs / localhost must remain rejected in production where applicable
3. Keep development fallback behavior working.
4. Do not break backend/node usage of the same shared config package.
5. Add or update tests to cover the mobile runtime path.

## Expected production values

- `EXPO_PUBLIC_ROUTING_BASE_URL=https://api.tagil.pizza`
- `EXPO_PUBLIC_MAP_STYLE_URL=https://api.maptiler.com/maps/streets-v2/style.json?key=<MAPTILER_KEY>`
- `EXPO_PUBLIC_MAP_TILE_ENDPOINT=https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=<MAPTILER_KEY>`

## Coverage requirement for map provider

Before shipping, validate that the selected map provider (MapTiler or self-hosted tileserver):

1. Covers the exact launch region at required zoom levels.
2. Returns style JSON with usable `vector` or `raster` sources (otherwise base map will be blank).
3. Has stable SLA/rate limits for production traffic.

If coverage is partial, replace provider URLs with your self-hosted style + tile endpoints and keep both
`EXPO_PUBLIC_MAP_STYLE_URL` and `EXPO_PUBLIC_MAP_TILE_ENDPOINT` HTTPS.

## Acceptance criteria

- `android-apk.yml` release build remains green
- installed release APK does not crash with missing env error
- app startup succeeds without Metro / debug server
- config tests cover both:
  - Node / server env path
  - Expo mobile release path

## Suggested implementation direction

- Read Expo runtime config via `expo-constants` in mobile runtime
- Merge `expo.extra` values with `process.env` in a controlled way
- Keep parsing / validation centralized inside `packages/config/src/index.ts`
- Prefer a safe API such as `getRuntimeConfigSafe()` for UI startup screens if config is invalid

## Notes

Server-side fixes already done separately:

- backend runs on VPS via `greenwave-api.service`
- nginx proxies `api.tagil.pizza` to local API
- production health checks are working

This task is specifically about fixing the mobile release runtime config path.
