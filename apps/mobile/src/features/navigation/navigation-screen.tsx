import React, { useEffect, useRef } from 'react';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { GlassPanel, MetricText } from '@greenwave/ui';
import { MapLibreMapView } from '../map/maplibre-map-view';
import { useNavigationStore } from '../../state/navigation-store';
import {
  selectControlsState,
  selectMapState,
  selectRouteState,
  selectSimulationState,
} from '../../state/selectors';
import { useDerivedMetrics } from '../../state/use-derived-metrics';
import { buildPositionPipeline } from '@greenwave/navigation-core';
import {
  fetchRoutes,
  RoutingHttpError,
  RoutingTimeoutError,
} from '../../services/routing-client';
import { nextVehicleState } from '../../simulation/simulator';
import { DebugHud } from '../debug/debug-hud';
import { useShallow } from 'zustand/react/shallow';

const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);
const VEHICLE_RAW_UPDATE_INTERVAL_MS = 100;
const UI_METRICS_UPDATE_INTERVAL_MS = 1_000;
const LOW_GPS_ACCURACY_METERS = 25;

type GpsUiState = 'searching' | 'low accuracy' | 'locked';

export const NavigationScreen = (): React.JSX.Element => {
  const { activeRoute, setRoute } = useNavigationStore(
    useShallow(selectRouteState),
  );
  const {
    simulationEnabled,
    vehicleState,
    deviceLocation,
    setVehicleState,
    setDeviceLocation,
  } =
    useNavigationStore(useShallow(selectSimulationState));
  const { cameraMode, setCameraMode, toggleSimulation } = useNavigationStore(
    useShallow(selectControlsState),
  );
  const {
    activeRoute: mapRoute,
    vehicleState: mapVehicle,
    deviceLocation: mapDeviceLocation,
    cameraMode: mapCameraMode,
    showRouteLine,
    showPassedRoute,
    showThreeWorld,
    objectDensity,
  } = useNavigationStore(useShallow(selectMapState));
  const tickRef = useRef<number>(0);
  const vehicleStateRef = useRef(vehicleState);
  const pipelineRef = useRef<ReturnType<typeof buildPositionPipeline> | undefined>(undefined);

  useEffect(() => {
    vehicleStateRef.current = vehicleState;
  }, [vehicleState]);

  useEffect(() => {
    let isMounted = true;
    let subscription: Location.LocationSubscription | null = null;

    const startLocationWatcher = async (): Promise<void> => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!isMounted || permission.status !== 'granted') {
          if (isMounted) {
            setDeviceLocation(undefined);
          }
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 1,
            timeInterval: 1000,
          },
          (location) => {
            if (!isMounted) {
              return;
            }

            setDeviceLocation({
              timestamp: new Date(location.timestamp).toISOString(),
              coordinate: {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
              },
              headingDeg: location.coords.heading ?? 0,
              speedKph: Math.max(0, (location.coords.speed ?? 0) * 3.6),
              accuracyMeters: location.coords.accuracy ?? 999,
              source: 'gps',
            });
          },
        );
      } catch {
        if (isMounted) {
          setDeviceLocation(undefined);
        }
      }
    };

    void startLocationWatcher();

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [setDeviceLocation]);

  const {
    data,
    isPending,
    isFetching,
    isError,
    error,
    refetch: retryRouteFetch,
  } = useQuery({
    queryKey: ['route', 'default'],
    queryFn: () =>
      fetchRoutes({
        origin: { lat: 55.751, lng: 37.617 },
        destination: { lat: 55.764, lng: 37.64 },
        profile: 'car',
      }),
    retry: (failureCount, retryError) => {
      if (failureCount >= 2) {
        return false;
      }

      if (retryError instanceof RoutingTimeoutError) {
        return true;
      }

      if (retryError instanceof RoutingHttpError) {
        return RETRYABLE_HTTP_STATUS.has(retryError.status);
      }

      return retryError instanceof TypeError;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    networkMode: 'online',
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
    const intervalMs = VEHICLE_RAW_UPDATE_INTERVAL_MS;
    const id = setInterval(() => {
      if (!activeRoute) {
        return;
      }
      tickRef.current += 1;
      const nextState = nextVehicleState(
        activeRoute,
        vehicleStateRef.current,
        intervalMs,
      );
      const pipeline = buildPositionPipeline(nextState, pipelineRef.current);
      pipelineRef.current = pipeline;
      vehicleStateRef.current = pipeline.renderedPosition;
      setVehicleState(pipeline.renderedPosition);
    }, intervalMs);

    return () => clearInterval(id);
  }, [activeRoute, setVehicleState, simulationEnabled]);

  const { progress, etaSeconds, cameraPitch } = useDerivedMetrics(
    UI_METRICS_UPDATE_INTERVAL_MS,
  );

  const routeUiState: 'loading' | 'degraded' | 'failed' | 'ready' =
    (isPending || isFetching) && !activeRoute
      ? 'loading'
      : isError && activeRoute
        ? 'degraded'
        : isError
          ? 'failed'
          : 'ready';

  const statusText =
    routeUiState === 'loading'
      ? 'Ищем оптимальный маршрут…'
      : routeUiState === 'degraded'
        ? 'Маршрут обновить не удалось, используется кэш'
        : routeUiState === 'failed'
          ? 'Маршрут недоступен'
          : `ETA ${Math.ceil(etaSeconds / 60)} min`;
  const gpsState: GpsUiState = !deviceLocation
    ? 'searching'
    : deviceLocation.accuracyMeters > LOW_GPS_ACCURACY_METERS
      ? 'low accuracy'
      : 'locked';

  const gpsStatusText =
    gpsState === 'searching'
      ? 'GPS: searching'
      : gpsState === 'low accuracy'
        ? `GPS: low accuracy (${Math.round(deviceLocation.accuracyMeters)}m)`
        : `GPS: locked (${Math.round(deviceLocation.accuracyMeters)}m)`;

  const errorDetails =
    isError && error instanceof Error ? error.message : 'Unknown routing error';
  const pipeline = pipelineRef.current;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#05070C', padding: 14, gap: 12 }}
    >
      <GlassPanel>
        <Text style={{ color: '#F4F7FF', fontSize: 18, fontWeight: '700' }}>
          {routeUiState === 'failed'
            ? 'Не удалось построить маршрут'
            : 'Next: Continue straight'}
        </Text>
        <Text style={{ color: '#8D95A8' }}>{statusText}</Text>
        <Text style={{ color: '#8D95A8', marginTop: 4 }}>{gpsStatusText}</Text>
      </GlassPanel>

      {(routeUiState === 'degraded' || routeUiState === 'failed') && (
        <GlassPanel style={{ marginBottom: 10 }}>
          <Text style={{ color: '#F4F7FF', fontSize: 16, fontWeight: '700' }}>
            Маршрут недоступен
          </Text>
          <Text style={{ color: '#8D95A8', marginTop: 6 }}>
            Техническая причина: {errorDetails}
          </Text>
          <View style={{ marginTop: 8 }}>
            <ActionButton title="Retry" onPress={() => void retryRouteFetch()} />
          </View>
        </GlassPanel>
      )}

      <View style={{ flex: 1 }}>
        <MapLibreMapView
          route={mapRoute}
          vehicle={mapVehicle}
          deviceLocation={mapDeviceLocation}
          pipeline={pipeline}
          cameraMode={mapCameraMode}
          showGreenWaveOverlay
          routeProgress={progress}
          showRouteLine={showRouteLine}
          showPassedRoute={showPassedRoute}
          showThreeWorld={showThreeWorld}
          qualityMode={objectDensity}
        />
        <DebugHud />
      </View>

      <GlassPanel
        style={{ flexDirection: 'row', justifyContent: 'space-between' }}
      >
        <MetricText
          value={`${Math.round((vehicleState?.speedKph ?? 0) * 10) / 10}`}
          label="Speed"
        />
        <MetricText value={`${Math.round(progress * 100)}%`} label="Progress" />
        <MetricText value={`${cameraPitch.toFixed(0)}°`} label="Pitch" />
      </GlassPanel>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ActionButton
          title={cameraMode === 'follow' ? 'Overview' : 'Follow'}
          onPress={() =>
            setCameraMode(cameraMode === 'follow' ? 'overview' : 'follow')
          }
        />
        <ActionButton title="Simulation" onPress={toggleSimulation} />
      </View>
    </SafeAreaView>
  );
};

const ActionButton = ({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}): React.JSX.Element => (
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
    <Text style={{ color: '#F2F5FF', textAlign: 'center', fontWeight: '600' }}>
      {title}
    </Text>
  </TouchableOpacity>
);
