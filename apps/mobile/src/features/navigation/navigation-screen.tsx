import React, { useEffect, useMemo, useRef } from 'react';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { deriveCameraModel, projectProgress } from '@greenwave/navigation-core';
import { GlassPanel, MetricText } from '@greenwave/ui';
import { MapLibreMapView } from '../map/maplibre-map-view';
import { useNavigationStore } from '../../state/navigation-store';
import { fetchRoutes } from '../../services/routing-client';
import { nextVehicleState } from '../../simulation/simulator';
import { DebugHud } from '../debug/debug-hud';

export const NavigationScreen = (): React.JSX.Element => {
  const activeRoute = useNavigationStore((s) => s.activeRoute);
  const setRoute = useNavigationStore((s) => s.setRoute);
  const setVehicleState = useNavigationStore((s) => s.setVehicleState);
  const vehicleState = useNavigationStore((s) => s.vehicleState);
  const cameraMode = useNavigationStore((s) => s.cameraMode);
  const setCameraMode = useNavigationStore((s) => s.setCameraMode);
  const toggleSimulation = useNavigationStore((s) => s.toggleSimulation);
  const simulationEnabled = useNavigationStore((s) => s.simulationEnabled);
  const tickRef = useRef<number>(0);
  const vehicleStateRef = useRef(vehicleState);

  useEffect(() => {
    vehicleStateRef.current = vehicleState;
  }, [vehicleState]);

  const { data } = useQuery({
    queryKey: ['route', 'default'],
    queryFn: () =>
      fetchRoutes({
        origin: { lat: 55.751, lng: 37.617 },
        destination: { lat: 55.764, lng: 37.64 },
        profile: 'car',
      }),
  });

  useEffect(() => {
    if (data?.[0] && !activeRoute) {
      setRoute(data[0]);
    }
  }, [activeRoute, data, setRoute]);

  useEffect(() => {
    if (!simulationEnabled || !activeRoute) {
      return;
    }
    const intervalMs = 1100;
    const id = setInterval(() => {
      if (!activeRoute) {
        return;
      }
      tickRef.current += 1;
      const nextState = nextVehicleState(activeRoute, vehicleStateRef.current, intervalMs);
      vehicleStateRef.current = nextState;
      setVehicleState(nextState);
    }, intervalMs);

    return () => clearInterval(id);
  }, [activeRoute, setVehicleState, simulationEnabled]);

  const progress = useMemo(() => {
    if (!activeRoute || !vehicleState) {
      return 0;
    }
    return projectProgress(activeRoute.geometry, vehicleState);
  }, [activeRoute, vehicleState]);

  const camera = deriveCameraModel(vehicleState?.speedKph ?? 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#05070C', padding: 14, gap: 12 }}>
      <GlassPanel>
        <Text style={{ color: '#F4F7FF', fontSize: 18, fontWeight: '700' }}>Next: Continue straight</Text>
        <Text style={{ color: '#8D95A8' }}>in 1.2 km • ETA 14 min</Text>
      </GlassPanel>

      <View style={{ flex: 1 }}>
        <MapLibreMapView route={activeRoute} vehicle={vehicleState} cameraMode={cameraMode} showGreenWaveOverlay />
        <DebugHud />
      </View>

      <GlassPanel style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <MetricText value={`${Math.round((vehicleState?.speedKph ?? 0) * 10) / 10}`} label="Speed" />
        <MetricText value={`${Math.round(progress * 100)}%`} label="Progress" />
        <MetricText value={`${camera.pitch.toFixed(0)}°`} label="Pitch" />
      </GlassPanel>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ActionButton
          title={cameraMode === 'follow' ? 'Overview' : 'Follow'}
          onPress={() => setCameraMode(cameraMode === 'follow' ? 'overview' : 'follow')}
        />
        <ActionButton title="Simulation" onPress={toggleSimulation} />
      </View>
    </SafeAreaView>
  );
};

const ActionButton = ({ title, onPress }: { title: string; onPress: () => void }): React.JSX.Element => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flex: 1,
      backgroundColor: '#121A2A',
      paddingVertical: 12,
      borderRadius: 12,
      borderColor: '#2A3A5F',
      borderWidth: 1,
    }}
  >
    <Text style={{ color: '#F2F5FF', textAlign: 'center', fontWeight: '600' }}>{title}</Text>
  </TouchableOpacity>
);
