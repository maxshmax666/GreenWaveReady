import type { NavigationState } from './store-types';

export const selectRouteState = (state: NavigationState) => ({
  activeRoute: state.activeRoute,
  setRoute: state.setRoute,
});

export const selectSimulationState = (state: NavigationState) => ({
  activeRoute: state.activeRoute,
  simulationEnabled: state.simulationEnabled,
  vehicleState: state.vehicleState,
  setVehicleState: state.setVehicleState,
});

export const selectMapState = (state: NavigationState) => ({
  activeRoute: state.activeRoute,
  vehicleState: state.vehicleState,
  cameraMode: state.cameraMode,
  showRouteLine: state.showRouteLine,
  showPassedRoute: state.showPassedRoute,
  showThreeWorld: state.showThreeWorld,
  objectDensity: state.objectDensity,
});

export const selectControlsState = (state: NavigationState) => ({
  cameraMode: state.cameraMode,
  setCameraMode: state.setCameraMode,
  toggleSimulation: state.toggleSimulation,
});

export const selectDebugHudState = (state: NavigationState) => ({
  debugHud: state.debugHud,
  vehicleState: state.vehicleState,
  activeRoute: state.activeRoute,
  showThreeWorld: state.showThreeWorld,
  objectDensity: state.objectDensity,
});
