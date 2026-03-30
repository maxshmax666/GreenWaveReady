import type { Coordinate, VehicleState } from '@greenwave/types';
import { clamp, movingAverage } from '@greenwave/utils';

export type CameraModel = {
  pitch: number;
  zoom: number;
  lookAheadMeters: number;
};

export const deriveCameraModel = (speedKph: number): CameraModel => {
  const speedNorm = clamp(speedKph / 120, 0, 1);
  return {
    pitch: 45 + speedNorm * 20,
    zoom: 17 - speedNorm * 1.5,
    lookAheadMeters: 35 + speedNorm * 120,
  };
};

export const smoothHeading = (prevHeading: number, nextHeading: number, alpha = 0.2): number =>
  movingAverage(prevHeading, nextHeading, alpha);

export const projectProgress = (route: Coordinate[], vehicle: VehicleState): number => {
  if (route.length === 0) {
    return 0;
  }
  const total = route.length - 1;
  const idx = route.findIndex((pt) => Math.abs(pt.lat - vehicle.coordinate.lat) < 0.0005 && Math.abs(pt.lng - vehicle.coordinate.lng) < 0.0005);
  return clamp(idx < 0 ? 0 : idx / total, 0, 1);
};
