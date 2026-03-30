import type { CameraModel } from '@greenwave/navigation-core';
import { deriveCameraModel } from '@greenwave/navigation-core';
import type { Coordinate, VehicleState } from '@greenwave/types';

export type CameraMode = 'follow' | 'overview';

export type CameraFrame = {
  center: Coordinate;
  pitch: number;
  zoom: number;
  heading: number;
  animationMs: number;
};

export type CameraControllerInput = {
  vehicle: VehicleState;
  routeProgress: number;
  mode: CameraMode;
};

export interface CameraController {
  nextFrame(input: CameraControllerInput): CameraFrame;
}

export class DrivingCameraController implements CameraController {
  nextFrame(input: CameraControllerInput): CameraFrame {
    const model: CameraModel = deriveCameraModel(input.vehicle.speedKph);
    if (input.mode === 'overview') {
      return {
        center: input.vehicle.coordinate,
        pitch: 20,
        zoom: 12.5,
        heading: input.vehicle.headingDeg,
        animationMs: 800,
      };
    }

    const maneuverBias = input.routeProgress > 0.8 ? 0.85 : 1;
    return {
      center: input.vehicle.coordinate,
      pitch: model.pitch,
      zoom: model.zoom * maneuverBias,
      heading: input.vehicle.headingDeg,
      animationMs: input.vehicle.speedKph > 40 ? 350 : 500,
    };
  }
}

export const toLngLat = (coordinate: Coordinate): [number, number] => [
  coordinate.lng,
  coordinate.lat,
];
