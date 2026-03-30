import type { Route, VehicleState } from '@greenwave/types';
import type { QualityMode } from '@greenwave/three-world';

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
  showRawGps: boolean;
  showFilteredGps: boolean;
  showSnappedPosition: boolean;
  showRouteLine: boolean;
  showPassedRoute: boolean;
  showThreeWorld: boolean;
  cameraFollowEnabled: boolean;
  objectDensity: QualityMode;
  setCameraMode: (mode: CameraMode) => void;
  toggleSimulation: () => void;
  toggleDebugHud: () => void;
  toggleRawGps: () => void;
  toggleFilteredGps: () => void;
  toggleSnappedPosition: () => void;
  toggleRouteLine: () => void;
  togglePassedRoute: () => void;
  toggleThreeWorld: () => void;
  toggleCameraFollow: () => void;
  setObjectDensity: (mode: QualityMode) => void;
};

export type NavigationState = RouteSlice & VehicleSlice & UiSlice;
