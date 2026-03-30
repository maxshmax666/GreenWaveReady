import React from 'react';
import { Text } from 'react-native';
import { GlassPanel } from '@greenwave/ui';
import { useShallow } from 'zustand/react/shallow';
import { useNavigationStore } from '../../state/navigation-store';
import { selectDebugHudState } from '../../state/selectors';

export const DebugHud = (): React.JSX.Element | null => {
  const { debugHud, vehicleState, activeRoute } = useNavigationStore(
    useShallow(selectDebugHudState),
  );

  if (!debugHud) {
    return null;
  }

  return (
    <GlassPanel
      style={{ position: 'absolute', top: 56, right: 16, minWidth: 150 }}
    >
      <Text style={{ color: '#fff', fontSize: 12 }}>Debug HUD</Text>
      <Text style={{ color: '#AAB4CA', fontSize: 11 }}>
        speed: {vehicleState?.speedKph ?? 0} km/h
      </Text>
      <Text style={{ color: '#AAB4CA', fontSize: 11 }}>
        heading: {Math.round(vehicleState?.headingDeg ?? 0)}°
      </Text>
      <Text style={{ color: '#AAB4CA', fontSize: 11 }}>
        route pts: {activeRoute?.geometry.length ?? 0}
      </Text>
    </GlassPanel>
  );
};
