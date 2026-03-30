import { StateCreator } from 'zustand';
import { NavigationState, RouteSlice } from './store-types';

export const createRouteSlice: StateCreator<
  NavigationState,
  [],
  [],
  RouteSlice
> = (set) => ({
  setRoute: (activeRoute) => set({ activeRoute }),
});
