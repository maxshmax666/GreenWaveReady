import { StateCreator } from 'zustand';
import { NavigationState, VehicleSlice } from './store-types';

export const createVehicleSlice: StateCreator<
  NavigationState,
  [],
  [],
  VehicleSlice
> = (set) => ({
  deviceLocation: undefined,
  setVehicleState: (vehicleState) => set({ vehicleState }),
  setDeviceLocation: (deviceLocation) => set({ deviceLocation }),
});
