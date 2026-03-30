import type { Route, VehicleState } from '@greenwave/types';
import { create } from 'zustand';

type CameraMode = 'follow' | 'overview';

type NavState = {
  activeRoute?: Route;
  vehicleState?: VehicleState;
  cameraMode: CameraMode;
  simulationEnabled: boolean;
  debugHud: boolean;
  setRoute: (route: Route) => void;
  setVehicleState: (state: VehicleState) => void;
  setCameraMode: (mode: CameraMode) => void;
  toggleSimulation: () => void;
  toggleDebugHud: () => void;
};

export const useNavigationStore = create<NavState>((set) => ({
  cameraMode: 'follow',
  simulationEnabled: true,
  debugHud: true,
  setRoute: (activeRoute) => set({ activeRoute }),
  setVehicleState: (vehicleState) => set({ vehicleState }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleSimulation: () => set((state) => ({ simulationEnabled: !state.simulationEnabled })),
  toggleDebugHud: () => set((state) => ({ debugHud: !state.debugHud })),
}));
