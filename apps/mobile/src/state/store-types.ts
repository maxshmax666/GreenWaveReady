import type { Route, VehicleState } from '@greenwave/types';

export type CameraMode = 'follow' | 'overview';

export type RouteSlice = {
  activeRoute?: Route;
  setRoute: (route: Route) => void;
};

export type VehicleSlice = {
  vehicleState?: VehicleState;
  setVehicleState: (state: VehicleState) => void;
};

export type UiSlice = {
  cameraMode: CameraMode;
  simulationEnabled: boolean;
  debugHud: boolean;
  setCameraMode: (mode: CameraMode) => void;
  toggleSimulation: () => void;
  toggleDebugHud: () => void;
};

export type NavigationState = RouteSlice & VehicleSlice & UiSlice;
