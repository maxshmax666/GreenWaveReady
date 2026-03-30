import React from 'react';
import { Text } from 'react-native';
import { GlassPanel } from '@greenwave/ui';
import { useNavigationStore } from '../../state/navigation-store';

export const DebugHud = (): React.JSX.Element | null => {
  const vehicle = useNavigationStore((s) => s.vehicleState);
  const route = useNavigationStore((s) => s.activeRoute);
  const enabled = useNavigationStore((s) => s.debugHud);

  if (!enabled) {
    return null;
  }

  return (
    <GlassPanel style={{ position: 'absolute', top: 56, right: 16, minWidth: 150 }}>
      <Text style={{ color: '#fff', fontSize: 12 }}>Debug HUD</Text>
      <Text style={{ color: '#AAB4CA', fontSize: 11 }}>speed: {vehicle?.speedKph ?? 0} km/h</Text>
      <Text style={{ color: '#AAB4CA', fontSize: 11 }}>heading: {Math.round(vehicle?.headingDeg ?? 0)}°</Text>
      <Text style={{ color: '#AAB4CA', fontSize: 11 }}>route pts: {route?.geometry.length ?? 0}</Text>
    </GlassPanel>
  );
};
