import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapLibreGL, { type CameraRef } from '@maplibre/maplibre-react-native';
import { runtimeConfig } from '@greenwave/config';
import { GlassPanel } from '@greenwave/ui';
import type { MapAdapterProps } from './map-adapter';
import { useCameraController } from '../navigation/use-camera-controller';
import {
  DrivingCameraController,
  toLngLat,
} from '@greenwave/map-core';
import { ThreeWorldManager } from '@greenwave/three-world';
import { ThreeWorldOverlay } from './three-world-overlay';
import { useNavigationStore } from '../../state/navigation-store';

const GREEN_WAVE_POINT_INTERVAL = 6;
const MIN_SYNC_DISTANCE_METERS = 1;
const MIN_SYNC_ANGLE_DELTA_DEGREES = 1;
type MapViewProps = React.ComponentProps<typeof MapLibreGL.MapView>;
type MapStyleValue = NonNullable<MapViewProps['mapStyle']>;
type FillExtrusionStyle = NonNullable<
  React.ComponentProps<typeof MapLibreGL.FillExtrusionLayer>['style']
>;
type ExtrusionNumericValue = NonNullable<FillExtrusionStyle['fillExtrusionHeight']>;
type RawStyleSource = { type?: string; [key: string]: unknown };
type RawStyleLayer = {
  id?: string;
  type?: string;
  source?: string;
  'source-layer'?: string;
  paint?: Record<string, unknown>;
  [key: string]: unknown;
};
type RawStyleSpec = {
  version?: number;
  sources?: Record<string, RawStyleSource>;
  layers?: RawStyleLayer[];
  terrain?: Record<string, unknown>;
  [key: string]: unknown;
};

type GeoPoint = { type: 'Point'; coordinates: [number, number] };
type GeoLineString = { type: 'LineString'; coordinates: [number, number][] };
type GeoFeature<T extends GeoPoint | GeoLineString> = {
  type: 'Feature';
  geometry: T;
  properties: Record<string, unknown>;
};
type GeoFeatureCollection<T extends GeoPoint | GeoLineString> = {
  type: 'FeatureCollection';
  features: Array<GeoFeature<T>>;
};

const emptyFeatureCollection = <
  T extends GeoPoint | GeoLineString,
>(): GeoFeatureCollection<T> => ({
  type: 'FeatureCollection',
  features: [],
});

const cameraController = new DrivingCameraController();

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const meanLat = toRadians((a.lat + b.lat) / 2);
  const earthRadius = 6_371_000;
  const x = lngDelta * Math.cos(meanLat);
  return Math.sqrt(x * x + latDelta * latDelta) * earthRadius;
};

const MIN_TERRAIN_SDK_VERSION = '10.4.2';

const parseSemver = (version: string): [number, number, number] | null => {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  const [major, minor, patch] = match.slice(1, 4);
  return [Number(major), Number(minor), Number(patch)];
};

const isSemverGte = (version: string, minimum: string): boolean => {
  const actual = parseSemver(version);
  const expected = parseSemver(minimum);
  if (!actual || !expected) {
    return false;
  }

  for (let index = 0; index < 3; index += 1) {
    const actualPart = actual[index] ?? 0;
    const expectedPart = expected[index] ?? 0;

    if (actualPart > expectedPart) {
      return true;
    }

    if (actualPart < expectedPart) {
      return false;
    }
  }

  return true;
};

export const MapLibreMapView = ({
  route,
  vehicle,
  deviceLocation,
  pipeline,
  cameraMode,
  showGreenWaveOverlay,
  routeProgress,
  showRouteLine,
  showPassedRoute,
  showThreeWorld,
  qualityMode,
}: MapAdapterProps): React.JSX.Element => {
  const [mapRenderEpoch, setMapRenderEpoch] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [resolvedMapStyle, setResolvedMapStyle] = useState<MapStyleValue>(
    runtimeConfig.mapStyleUrl,
  );
  const [styleLoaded, setStyleLoaded] = useState(false);
  const [buildingLayerMeta, setBuildingLayerMeta] = useState<{
    sourceId: string;
    sourceLayerId: string;
    referenceLayerId: string;
    paint?: Record<string, unknown>;
  } | null>(null);
  const setMapWarnings = useNavigationStore((state) => state.setMapWarnings);
  const setPerfMetrics = useNavigationStore((state) => state.setPerfMetrics);

  const routeCoordinates = useMemo(
    () => route?.geometry.map(toLngLat) ?? [],
    [route],
  );

  const passedCoordinates = useMemo(() => {
    if (routeCoordinates.length < 2 || routeProgress <= 0) {
      return [] as [number, number][];
    }

    const cutoffIndex = Math.max(1, Math.floor(routeCoordinates.length * routeProgress));
    return routeCoordinates.slice(0, cutoffIndex);
  }, [routeCoordinates, routeProgress]);

  const resolvedVehicle = vehicle ?? pipeline?.renderedPosition;
  const routeStart = route?.geometry[0];

  const cameraModel = useMemo(() => {
    const cameraVehicle = deviceLocation ?? resolvedVehicle;
    if (!cameraVehicle) {
      return null;
    }

    return cameraController.nextFrame({
      vehicle: cameraVehicle,
      mode: cameraMode,
      routeProgress,
    });
  }, [cameraMode, deviceLocation, resolvedVehicle, routeProgress]);

  const cameraRef = useRef<CameraRef | null>(null);

  useCameraController({
    vehicleState: deviceLocation ?? resolvedVehicle,
    cameraMode,
    routeProgress,
    routePolyline: route?.geometry ?? [],
    deriveCameraModel: () => ({
      lookAheadMeters: cameraModel?.zoom ?? 50,
      pitch: cameraModel?.pitch ?? 40,
      zoom: cameraModel?.zoom ?? 14,
    }),
    cameraRef,
  });

  const worldRef = useRef(new ThreeWorldManager());
  const [worldObjects, setWorldObjects] = useState(() =>
    worldRef.current.getObjects(),
  );
  const lastWorldSyncRef = useRef<{
    center: { lat: number; lng: number };
    heading: number;
    pitch: number;
  } | null>(null);
  const syncCallsRef = useRef(0);
  const [syncCalls, setSyncCalls] = useState(0);

  useEffect(() => {
    const center =
      deviceLocation?.coordinate ??
      resolvedVehicle?.coordinate ??
      route?.geometry[0] ??
      { lat: 55.751, lng: 37.617 };
    const heading =
      cameraModel?.heading ??
      deviceLocation?.headingDeg ??
      resolvedVehicle?.headingDeg ??
      0;
    const pitch = cameraModel?.pitch ?? 30;

    const previous = lastWorldSyncRef.current;
    if (previous) {
      const centerDeltaMeters = distanceMeters(previous.center, center);
      const headingDelta = Math.abs(previous.heading - heading);
      const pitchDelta = Math.abs(previous.pitch - pitch);
      if (
        centerDeltaMeters < MIN_SYNC_DISTANCE_METERS &&
        headingDelta < MIN_SYNC_ANGLE_DELTA_DEGREES &&
        pitchDelta < MIN_SYNC_ANGLE_DELTA_DEGREES
      ) {
        return;
      }
    }

    const syncStartedAt = globalThis.performance?.now?.() ?? Date.now();
    worldRef.current.setQuality(qualityMode);
    worldRef.current.sync({
      cameraBearing: heading,
      cameraPitch: pitch,
      center,
      routeCorridor: route?.geometry ?? [],
      ...(resolvedVehicle ? { vehicle: resolvedVehicle } : {}),
    });
    const syncFinishedAt = globalThis.performance?.now?.() ?? Date.now();
    setPerfMetrics({ syncMs: Number((syncFinishedAt - syncStartedAt).toFixed(2)) });

    lastWorldSyncRef.current = { center, heading, pitch };
    setWorldObjects(worldRef.current.getObjects());

    if (__DEV__) {
      syncCallsRef.current += 1;
      setSyncCalls(syncCallsRef.current);
    }
  }, [
    qualityMode,
    cameraModel?.heading,
    cameraModel?.pitch,
    deviceLocation,
    resolvedVehicle,
    route?.geometry,
    setPerfMetrics,
  ]);

  const routeGeoJson = useMemo<GeoFeatureCollection<GeoLineString>>(() => {
    if (routeCoordinates.length < 2 || !showRouteLine) {
      return emptyFeatureCollection<GeoLineString>();
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: routeCoordinates },
          properties: {},
        },
      ],
    };
  }, [routeCoordinates, showRouteLine]);

  const passedGeoJson = useMemo<GeoFeatureCollection<GeoLineString>>(() => {
    if (passedCoordinates.length < 2 || !showPassedRoute) {
      return emptyFeatureCollection<GeoLineString>();
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: passedCoordinates },
          properties: {},
        },
      ],
    };
  }, [passedCoordinates, showPassedRoute]);

  const maneuverGeoJson = useMemo<GeoFeatureCollection<GeoPoint>>(() => {
    if (!route || route.maneuvers.length === 0) {
      return emptyFeatureCollection<GeoPoint>();
    }

    return {
      type: 'FeatureCollection',
      features: route.maneuvers.map(
        (maneuver): GeoFeature<GeoPoint> => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [maneuver.location.lng, maneuver.location.lat],
          },
          properties: {
            arrow: '➤',
            instruction: maneuver.instruction,
          },
        }),
      ),
    };
  }, [route]);

  const greenWaveGeoJson = useMemo<GeoFeatureCollection<GeoPoint>>(() => {
    if (!showGreenWaveOverlay || routeCoordinates.length === 0) {
      return emptyFeatureCollection<GeoPoint>();
    }

    return {
      type: 'FeatureCollection',
      features: routeCoordinates
        .filter((_, index) => index % GREEN_WAVE_POINT_INTERVAL === 0)
        .map(
          (coordinate, index): GeoFeature<GeoPoint> => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coordinate },
            properties: {
              confidence: index % 3 === 0 ? 0.9 : 0.65,
            },
          }),
        ),
    };
  }, [routeCoordinates, showGreenWaveOverlay]);

  const vehicleGeoJson = useMemo<GeoFeatureCollection<GeoPoint>>(() => {
    if (!resolvedVehicle) {
      return emptyFeatureCollection<GeoPoint>();
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [
              resolvedVehicle.coordinate.lng,
              resolvedVehicle.coordinate.lat,
            ],
          },
          properties: {
            headingDeg: resolvedVehicle.headingDeg,
          },
        },
      ],
    };
  }, [resolvedVehicle]);

  const deviceLocationGeoJson = useMemo<GeoFeatureCollection<GeoPoint>>(() => {
    if (!deviceLocation) {
      return emptyFeatureCollection<GeoPoint>();
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [
              deviceLocation.coordinate.lng,
              deviceLocation.coordinate.lat,
            ],
          },
          properties: {
            accuracyMeters: deviceLocation.accuracyMeters,
          },
        },
      ],
    };
  }, [deviceLocation]);

  const onDidFailLoadingMap: NonNullable<MapViewProps['onDidFailLoadingMap']> =
    () => {
      setMapError('Failed to load map style or tiles.');
      setStyleLoaded(false);
    };

  useEffect(() => {
    let cancelled = false;

    const loadStyleCapabilities = async (): Promise<void> => {
      setStyleLoaded(false);
      setResolvedMapStyle(runtimeConfig.mapStyleUrl);
      setBuildingLayerMeta(null);

      const warnings: string[] = [];

      try {
        const response = await fetch(runtimeConfig.mapStyleUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const rawStyle = (await response.json()) as RawStyleSpec;
        const sources = rawStyle.sources ?? {};
        const layers = rawStyle.layers ?? [];
        const demSourceEntry = Object.entries(sources).find(
          ([, source]) => source?.type === 'raster-dem',
        );
        const firstFillExtrusion = layers.find(
          (layer) =>
            layer.type === 'fill-extrusion' &&
            typeof layer.source === 'string' &&
            typeof layer['source-layer'] === 'string',
        );

        if (firstFillExtrusion?.source && firstFillExtrusion['source-layer']) {
          setBuildingLayerMeta({
            sourceId: firstFillExtrusion.source,
            sourceLayerId: firstFillExtrusion['source-layer'],
            referenceLayerId: firstFillExtrusion.id ?? 'building',
            ...(firstFillExtrusion.paint ? { paint: firstFillExtrusion.paint } : {}),
          });
        } else {
          warnings.push('3D buildings unavailable: fill-extrusion layer not found in style.');
        }

        const maplibreVersion = MIN_TERRAIN_SDK_VERSION;
        const terrainSupported = isSemverGte(maplibreVersion, MIN_TERRAIN_SDK_VERSION);
        if (!terrainSupported) {
          warnings.push(
            `Terrain disabled: SDK ${maplibreVersion} < ${MIN_TERRAIN_SDK_VERSION}.`,
          );
        } else if (!demSourceEntry) {
          warnings.push('Terrain disabled: raster-dem source not found in style.');
        } else {
          const [demSourceId] = demSourceEntry;
          setResolvedMapStyle({
            ...rawStyle,
            terrain: {
              source: demSourceId,
              exaggeration: 1.05,
            },
          });
        }
      } catch {
        warnings.push('3D checks failed: style metadata is unreachable, using 2D fallback.');
      }

      if (cancelled) {
        return;
      }

      setMapWarnings(warnings);
    };

    void loadStyleCapabilities();

    return () => {
      cancelled = true;
      setMapWarnings([]);
    };
  }, [setMapWarnings]);

  const centerCoordinate: [number, number] = deviceLocation
    ? [deviceLocation.coordinate.lng, deviceLocation.coordinate.lat]
    : resolvedVehicle
      ? [resolvedVehicle.coordinate.lng, resolvedVehicle.coordinate.lat]
      : routeStart
        ? [routeStart.lng, routeStart.lat]
        : [37.617, 55.751];

  const extrusionHeight =
    (buildingLayerMeta?.paint?.['fill-extrusion-height'] as
      | ExtrusionNumericValue
      | undefined) ??
    ['coalesce', ['get', 'height'], 12];
  const extrusionBase =
    (buildingLayerMeta?.paint?.['fill-extrusion-base'] as
      | ExtrusionNumericValue
      | undefined) ??
    ['coalesce', ['get', 'min_height'], 0];

  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1D2A46',
      }}
    >
      <MapLibreGL.MapView
        key={mapRenderEpoch}
        style={{ flex: 1 }}
        mapStyle={resolvedMapStyle}
        onDidFailLoadingMap={onDidFailLoadingMap}
        onDidFinishLoadingStyle={() => {
          setStyleLoaded(true);
          if (mapError) {
            setMapError(null);
          }
        }}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          centerCoordinate={centerCoordinate}
          zoomLevel={cameraModel?.zoom ?? 13.6}
          pitch={cameraModel?.pitch ?? 35}
          heading={cameraModel?.heading ?? 0}
        />

        <MapLibreGL.ShapeSource id="route-shape" shape={routeGeoJson}>
          <MapLibreGL.LineLayer
            id="route-base"
            style={{ lineColor: '#203458', lineWidth: 10, lineCap: 'round' }}
          />
          <MapLibreGL.LineLayer
            id="route-line"
            style={{
              lineColor: '#69A8FF',
              lineWidth: 6,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </MapLibreGL.ShapeSource>

        <MapLibreGL.ShapeSource id="passed-route" shape={passedGeoJson}>
          <MapLibreGL.LineLayer
            id="passed-route-line"
            style={{ lineColor: '#2EEA88', lineWidth: 5, lineCap: 'round' }}
          />
        </MapLibreGL.ShapeSource>

        <MapLibreGL.ShapeSource id="maneuver-source" shape={maneuverGeoJson}>
          <MapLibreGL.SymbolLayer
            id="maneuver-arrows"
            style={{
              textField: ['get', 'arrow'],
              textColor: '#F7FAFF',
              textHaloColor: '#0A0F1A',
              textHaloWidth: 1,
              textSize: 13,
            }}
          />
        </MapLibreGL.ShapeSource>

        <MapLibreGL.ShapeSource id="vehicle-source" shape={vehicleGeoJson}>
          <MapLibreGL.CircleLayer
            id="vehicle-puck"
            style={{
              circleRadius: 7,
              circleColor: '#FFFFFF',
              circleStrokeColor: '#1A73E8',
              circleStrokeWidth: 3,
            }}
          />
        </MapLibreGL.ShapeSource>

        <MapLibreGL.ShapeSource
          id="device-location-source"
          shape={deviceLocationGeoJson}
        >
          <MapLibreGL.CircleLayer
            id="device-location-puck"
            style={{
              circleRadius: 6,
              circleColor: '#2EEA88',
              circleStrokeColor: '#0D3D2B',
              circleStrokeWidth: 2,
            }}
          />
        </MapLibreGL.ShapeSource>

        {showGreenWaveOverlay ? (
          <MapLibreGL.ShapeSource
            id="greenwave-overlay-source"
            shape={greenWaveGeoJson}
          >
            <MapLibreGL.CircleLayer
              id="greenwave-overlay"
              style={{
                circleRadius: 4,
                circleColor: '#2EEA88',
                circleOpacity: 0.72,
                circleStrokeColor: '#0E3322',
                circleStrokeWidth: 1,
              }}
            />
          </MapLibreGL.ShapeSource>
        ) : null}

        {styleLoaded && buildingLayerMeta ? (
          <MapLibreGL.FillExtrusionLayer
            id="gw-3d-buildings"
            sourceID={buildingLayerMeta.sourceId}
            sourceLayerID={buildingLayerMeta.sourceLayerId}
            aboveLayerID={buildingLayerMeta.referenceLayerId}
            minZoomLevel={14}
            style={{
              fillExtrusionColor: '#B7D2FF',
              fillExtrusionOpacity: 0.35,
              fillExtrusionHeight: extrusionHeight,
              fillExtrusionBase: extrusionBase,
              fillExtrusionVerticalGradient: true,
            }}
          />
        ) : null}

        <ThreeWorldOverlay objects={worldObjects} visible={showThreeWorld} />
      </MapLibreGL.MapView>

      {__DEV__ && showThreeWorld ? (
        <View style={{ position: 'absolute', top: 12, left: 12 }}>
          <GlassPanel>
            <Text style={{ color: '#9EB0CC', fontSize: 11 }}>
              three-world debug · {qualityMode} · objects: {worldObjects.length} ·
              sync: {syncCalls}
            </Text>
          </GlassPanel>
        </View>
      ) : null}

      {mapError ? (
        <View style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
          <GlassPanel>
            <Text
              style={{ color: '#F6F9FF', fontWeight: '700', marginBottom: 6 }}
            >
              Map temporarily unavailable
            </Text>
            <Text style={{ color: '#A9B5CC', marginBottom: 10 }}>{mapError}</Text>
            <Pressable
              onPress={() => {
                setMapError(null);
                setMapRenderEpoch((prev) => prev + 1);
              }}
              style={{
                alignSelf: 'flex-start',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#2A3A5F',
                backgroundColor: '#111B2D',
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: '#ECF2FF', fontWeight: '600' }}>Retry</Text>
            </Pressable>
          </GlassPanel>
        </View>
      ) : null}
    </View>
  );
};
