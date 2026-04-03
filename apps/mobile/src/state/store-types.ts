import type { Route, VehicleState } from '@greenwave/types';
import type { QualityMode } from '@greenwave/three-world';

export type CameraMode = 'follow' | 'overview';
export type PerfMetrics = {
  fps: number;
  syncMs: number;
};

export type MapWarningLevel = 'info' | 'warning' | 'error';

export type MapWarning = {
  level: MapWarningLevel;
  message: string;
  actionable: boolean;
};

export type RouteSlice = {
  activeRoute?: Route;
  setRoute: (route: Route) => void;
};

export type VehicleSlice = {
  vehicleState?: VehicleState;
  deviceLocation: VehicleState | undefined;
  setVehicleState: (state: VehicleState) => void;
  setDeviceLocation: (state: VehicleState | undefined) => void;
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
  mapWarnings: MapWarning[];
  perfMetrics: PerfMetrics;
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
  setMapWarnings: (warnings: MapWarning[]) => void;
  setPerfMetrics: (metrics: Partial<PerfMetrics>) => void;
};

export type NavigationState = RouteSlice & VehicleSlice & UiSlice;
