import { create } from 'zustand';
import { createRouteSlice } from './routeSlice';
import { NavigationState } from './store-types';
import { createUiSlice } from './uiSlice';
import { createVehicleSlice } from './vehicleSlice';

export const useNavigationStore = create<NavigationState>()((...args) => ({
  ...createRouteSlice(...args),
  ...createVehicleSlice(...args),
  ...createUiSlice(...args),
}));

export type { CameraMode, NavigationState } from './store-types';
