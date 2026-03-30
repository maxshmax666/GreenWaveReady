import type { Route, VehicleState } from '@greenwave/types';

export const makeVehicleState = (route: Route, tick: number): VehicleState => {
  const idx = Math.min(route.geometry.length - 1, tick % route.geometry.length);
  const coordinate = route.geometry[idx] ?? route.geometry[0] ?? { lat: 0, lng: 0 };
  return {
    timestamp: new Date().toISOString(),
    coordinate,
    headingDeg: (tick * 12) % 360,
    speedKph: 42 + (tick % 15),
    accuracyMeters: 5,
    source: 'simulation',
  };
};

export const nextVehicleState = (
  route: Route,
  prevState: VehicleState | undefined,
  dtMs: number
): VehicleState => {
  if (!prevState || prevState.source !== 'simulation') {
    return makeVehicleState(route, 0);
  }

  const fallbackIndex = 0;
  const currentIndex = route.geometry.findIndex(
    (point) => point.lat === prevState.coordinate.lat && point.lng === prevState.coordinate.lng
  );
  const resolvedIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;
  const step = Math.max(1, Math.round(dtMs / 1100));
  return makeVehicleState(route, resolvedIndex + step);
};
