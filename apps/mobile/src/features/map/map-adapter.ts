import type React from 'react';
import type { Route, VehicleState } from '@greenwave/types';

export type MapAdapterProps = {
  route?: Route;
  vehicle?: VehicleState;
  cameraMode: 'follow' | 'overview';
  showGreenWaveOverlay: boolean;
};

export interface MapAdapter {
  render(props: MapAdapterProps): React.JSX.Element;
}
