import React, { useEffect, useRef } from 'react';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { GlassPanel, MetricText } from '@greenwave/ui';
import { MapLibreMapView } from '../map/maplibre-map-view';
import { useNavigationStore } from '../../state/navigation-store';
import {
  selectMapState,
  selectNavigationUiActions,
  selectRouteState,
  selectSimulationState,
} from '../../state/selectors';
import { useDerivedMetrics } from '../../state/use-derived-metrics';
import { buildPositionPipeline } from '@greenwave/navigation-core';
import {
  fetchRoutes,
  RoutingHttpError,
  RoutingParseError,
  RoutingTimeoutError,
} from '../../services/routing-client';
import { nextVehicleState } from '../../simulation/simulator';
import { DebugHud } from '../debug/debug-hud';
import { useShallow } from 'zustand/react/shallow';

const RETRYABLE_HTTP_STATUS = new Set([429, 500, 502, 503, 504]);
const VEHICLE_RAW_UPDATE_INTERVAL_MS = 100;
const UI_METRICS_UPDATE_INTERVAL_MS = 1_000;
const LOW_GPS_ACCURACY_METERS = 25;
const AUTO_DENSITY_GUARD_ENABLED = true;
const AUTO_DENSITY_LOW_FPS_THRESHOLD = 24;
const AUTO_DENSITY_RECOVERY_FPS_THRESHOLD = 50;
const AUTO_DENSITY_LOW_FPS_HYSTERESIS_MS = 2_000;
const AUTO_DENSITY_RECOVERY_HYSTERESIS_MS = 6_000;
const AUTO_DENSITY_WEAK_DEVICE_WARMUP_MS = 5_000;
const AUTO_DENSITY_WEAK_DEVICE_FPS_THRESHOLD = 52;

type GpsUiState = 'searching' | 'low accuracy' | 'locked';

const getRoutingErrorBadge = (error: Error): { code: string; requestId: string } => {
  if (error instanceof RoutingTimeoutError) {
    return { code: 'TIMEOUT', requestId: error.requestId ?? 'n/a' };
  }

  if (error instanceof RoutingParseError) {
    return { code: 'PARSE', requestId: error.requestId ?? 'n/a' };
  }

  if (error instanceof RoutingHttpError) {
    const code = error.status >= 500 ? 'HTTP_5XX' : `HTTP_${error.status}`;
    return { code, requestId: error.requestId ?? 'n/a' };
  }

  if (error instanceof TypeError) {
    return { code: 'NETWORK', requestId: 'n/a' };
  }

  return { code: 'UNKNOWN', requestId: 'n/a' };
};

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
  const { setCameraMode, toggleSimulation, toggleThreeWorld, setObjectDensity, setPerfMetrics } =
    useNavigationStore(useShallow(selectNavigationUiActions));
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
  const cameraMode = useNavigationStore((state) => state.cameraMode);
  const tickRef = useRef<number>(0);
  const vehicleStateRef = useRef(vehicleState);
  const pipelineRef = useRef<ReturnType<typeof buildPositionPipeline> | undefined>(undefined);
  const lowFpsSinceRef = useRef<number | null>(null);
  const recoverySinceRef = useRef<number | null>(null);
  const autoReducedRef = useRef(false);
  const weakDeviceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let sampleStartTs = Date.now();
    let frameCount = 0;
    let rafId = 0;
    const warmupStartedAt = sampleStartTs;
    let warmupFrames = 0;

    const tick = (): void => {
      if (!isMounted) {
        return;
      }

      frameCount += 1;
      warmupFrames += 1;
      const now = Date.now();
      const sampleDuration = now - sampleStartTs;
      const warmupDuration = now - warmupStartedAt;

      if (!weakDeviceRef.current && warmupDuration >= AUTO_DENSITY_WEAK_DEVICE_WARMUP_MS) {
        const warmupFps = Math.max(0, Math.round((warmupFrames * 1_000) / warmupDuration));
        weakDeviceRef.current = warmupFps <= AUTO_DENSITY_WEAK_DEVICE_FPS_THRESHOLD;
      }

      if (sampleDuration >= 1_000) {
        const fps = Math.max(0, Math.round((frameCount * 1_000) / sampleDuration));
        setPerfMetrics({ fps });

        if (AUTO_DENSITY_GUARD_ENABLED) {
          const onWeakProfile = weakDeviceRef.current || autoReducedRef.current;
          if (fps <= AUTO_DENSITY_LOW_FPS_THRESHOLD && onWeakProfile) {
            lowFpsSinceRef.current ??= now;
            recoverySinceRef.current = null;
            if (
              now - lowFpsSinceRef.current >= AUTO_DENSITY_LOW_FPS_HYSTERESIS_MS &&
              objectDensity !== 'low'
            ) {
              setObjectDensity('low');
              autoReducedRef.current = true;
            }
          } else if (fps >= AUTO_DENSITY_RECOVERY_FPS_THRESHOLD && autoReducedRef.current) {
            recoverySinceRef.current ??= now;
            lowFpsSinceRef.current = null;
            if (now - recoverySinceRef.current >= AUTO_DENSITY_RECOVERY_HYSTERESIS_MS) {
              setObjectDensity('medium');
              autoReducedRef.current = false;
            }
          } else {
            lowFpsSinceRef.current = null;
            recoverySinceRef.current = null;
          }
        }

        sampleStartTs = now;
        frameCount = 0;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      isMounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [objectDensity, setObjectDensity, setPerfMetrics]);

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
        ? `GPS: low accuracy (${Math.round(deviceLocation?.accuracyMeters ?? 0)}m)`
        : `GPS: locked (${Math.round(deviceLocation?.accuracyMeters ?? 0)}m)`;

  const errorDetails =
    isError && error instanceof Error ? error.message : 'Unknown routing error';
  const errorBadge = isError && error instanceof Error ? getRoutingErrorBadge(error) : null;
  const pipeline = pipelineRef.current;
  const safeProgress = Number.isFinite(progress) ? progress : 0;
  const isVehiclePipelineWarmingUp = Boolean(activeRoute) && !vehicleState;
  const navStatusText = isVehiclePipelineWarmingUp
    ? 'Vehicle pipeline warming up…'
    : statusText;

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
        <Text style={{ color: '#8D95A8' }}>{navStatusText}</Text>
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
          {errorBadge && (
            <Text style={{ color: '#F4F7FF', marginTop: 6, fontWeight: '600' }}>
              Код: {errorBadge.code} · request-id: {errorBadge.requestId}
            </Text>
          )}
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
          routeProgress={safeProgress}
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
        <MetricText value={`${Math.round(safeProgress * 100)}%`} label="Progress" />
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
        <ActionButton
          title={showThreeWorld ? '3D On' : '3D Off'}
          onPress={toggleThreeWorld}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['low', 'medium', 'high'] as const).map((density) => (
          <ActionButton
            key={density}
            title={density.toUpperCase()}
            onPress={() => setObjectDensity(density)}
            active={objectDensity === density}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

const ActionButton = ({
  title,
  onPress,
  active = false,
}: {
  title: string;
  onPress: () => void;
  active?: boolean;
}): React.JSX.Element => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flex: 1,
      backgroundColor: active ? '#31508A' : '#121A2A',
      paddingVertical: 12,
      borderRadius: 12,
      borderColor: active ? '#5E82C4' : '#2A3A5F',
      borderWidth: 1,
    }}
  >
    <Text style={{ color: '#F2F5FF', textAlign: 'center', fontWeight: '600' }}>
      {title}
    </Text>
  </TouchableOpacity>
);
