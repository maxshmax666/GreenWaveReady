import type React from 'react';
import type { Route, VehicleState } from '@greenwave/types';

export type MapAdapterProps = {
  route: Route | undefined;
  vehicle: VehicleState | undefined;
  cameraMode: 'follow' | 'overview';
  showGreenWaveOverlay: boolean;
  routeProgress: number;
};

export interface MapAdapter {
  render(props: MapAdapterProps): React.JSX.Element;
}
