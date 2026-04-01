import React from 'react';
import { Text, View } from 'react-native';
import type { MapAdapterProps } from './map-adapter';
import { VehicleMarker } from '../../components/vehicle-marker';

export const MockMapView = ({
  route,
  vehicle,
  deviceLocation,
  cameraMode,
  showGreenWaveOverlay,
  routeProgress,
}: MapAdapterProps): React.JSX.Element => (
  <View
    style={{
      backgroundColor: '#0B101D',
      borderRadius: 16,
      flex: 1,
      borderColor: '#1D2A46',
      borderWidth: 1,
      padding: 16,
      justifyContent: 'space-between',
    }}
  >
    <Text style={{ color: '#9FA9BE' }}>
      Map adapter placeholder (replace with MapLibre)
    </Text>
    <Text style={{ color: '#D5DEEF' }}>Camera: {cameraMode}</Text>
    <Text style={{ color: '#D5DEEF' }}>
      Route points: {route?.geometry.length ?? 0}
    </Text>
    <Text style={{ color: '#D5DEEF' }}>
      Green Wave overlay: {showGreenWaveOverlay ? 'on' : 'off'}
    </Text>
    <Text style={{ color: '#D5DEEF' }}>
      Progress: {Math.round(routeProgress * 100)}%
    </Text>
    <Text style={{ color: '#D5DEEF' }}>
      GPS: {deviceLocation ? `${deviceLocation.accuracyMeters}m` : 'searching'}
    </Text>
    <VehicleMarker headingDeg={vehicle?.headingDeg ?? 0} />
  </View>
);
