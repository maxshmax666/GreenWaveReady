import { StateCreator } from 'zustand';
import { NavigationState, UiSlice } from './store-types';

export const createUiSlice: StateCreator<NavigationState, [], [], UiSlice> = (
  set,
) => ({
  cameraMode: 'follow',
  simulationEnabled: true,
  debugHud: true,
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleSimulation: () =>
    set((state) => ({ simulationEnabled: !state.simulationEnabled })),
  toggleDebugHud: () => set((state) => ({ debugHud: !state.debugHud })),
});
