import type { Route, VehicleState } from '@greenwave/types';

export const makeVehicleState = (route: Route, tick: number): VehicleState => {
  const idx = Math.min(route.geometry.length - 1, tick % route.geometry.length);
  const coordinate = route.geometry[idx] ?? route.geometry[0];
  return {
    timestamp: new Date().toISOString(),
    coordinate,
    headingDeg: (tick * 12) % 360,
    speedKph: 42 + (tick % 15),
    accuracyMeters: 5,
    source: 'simulation',
  };
};
