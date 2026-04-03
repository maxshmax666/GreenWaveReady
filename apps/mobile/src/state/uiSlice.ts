import { StateCreator } from 'zustand';
import { NavigationState, UiSlice } from './store-types';

export const createUiSlice: StateCreator<NavigationState, [], [], UiSlice> = (
  set,
) => ({
  cameraMode: 'follow',
  simulationEnabled: true,
  debugHud: true,
  showRawGps: false,
  showFilteredGps: true,
  showSnappedPosition: true,
  showRouteLine: true,
  showPassedRoute: true,
  showThreeWorld: true,
  cameraFollowEnabled: true,
  objectDensity: 'medium',
  mapWarnings: [],
  perfMetrics: {
    fps: 0,
    syncMs: 0,
  },
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleSimulation: () =>
    set((state) => ({ simulationEnabled: !state.simulationEnabled })),
  toggleDebugHud: () => set((state) => ({ debugHud: !state.debugHud })),
  toggleRawGps: () => set((state) => ({ showRawGps: !state.showRawGps })),
  toggleFilteredGps: () =>
    set((state) => ({ showFilteredGps: !state.showFilteredGps })),
  toggleSnappedPosition: () =>
    set((state) => ({ showSnappedPosition: !state.showSnappedPosition })),
  toggleRouteLine: () =>
    set((state) => ({ showRouteLine: !state.showRouteLine })),
  togglePassedRoute: () =>
    set((state) => ({ showPassedRoute: !state.showPassedRoute })),
  toggleThreeWorld: () =>
    set((state) => ({ showThreeWorld: !state.showThreeWorld })),
  toggleCameraFollow: () =>
    set((state) => ({ cameraFollowEnabled: !state.cameraFollowEnabled })),
  setObjectDensity: (objectDensity) => set({ objectDensity }),
  setMapWarnings: (mapWarnings) => set({ mapWarnings }),
  setPerfMetrics: (metrics) =>
    set((state) => ({
      perfMetrics: {
        ...state.perfMetrics,
        ...metrics,
      },
    })),
});
