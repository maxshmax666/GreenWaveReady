import type React from 'react';
import type { PositionPipelineState, Route, VehicleState } from '@greenwave/types';
import type { QualityMode } from '@greenwave/three-world';

export type MapAdapterProps = {
  route: Route | undefined;
  vehicle: VehicleState | undefined;
  pipeline: PositionPipelineState;
  cameraMode: 'follow' | 'overview';
  showGreenWaveOverlay: boolean;
  routeProgress: number;
  showRouteLine: boolean;
  showPassedRoute: boolean;
  showThreeWorld: boolean;
  qualityMode: QualityMode;
};

export interface MapAdapter {
  render(props: MapAdapterProps): React.JSX.Element;
}
