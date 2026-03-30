import React, { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { runtimeConfig } from '@greenwave/config';
import { GlassPanel } from '@greenwave/ui';
import type { MapAdapterProps } from './map-adapter';
import {
  useCameraController,
  type MapCameraController,
} from '../navigation/use-camera-controller';
import {
  DrivingCameraController,
  type CameraMode,
  toLngLat,
} from '@greenwave/map-core';
import { ThreeWorldManager } from '@greenwave/three-world';

const GREEN_WAVE_POINT_INTERVAL = 6;

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

export const MapLibreMapView = ({
  route,
  vehicle,
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

  const cameraModel = useMemo(() => {
    if (!vehicle) {
      return null;
    }

    return cameraController.nextFrame({
      vehicle,
      mode: cameraMode as CameraMode,
      routeProgress,
    });
  }, [cameraMode, routeProgress, vehicle]);

  const cameraRef = useRef<MapCameraController | null>(null);

  useCameraController({
    vehicleState: vehicle,
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
  worldRef.current.setQuality(qualityMode);
  worldRef.current.sync({
    cameraBearing: cameraModel?.heading ?? vehicle?.headingDeg ?? 0,
    cameraPitch: cameraModel?.pitch ?? 30,
    center: vehicle?.coordinate ?? route?.geometry[0] ?? { lat: 55.751, lng: 37.617 },
    routeCorridor: route?.geometry ?? [],
    ...(vehicle ? { vehicle } : {}),
  });

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
    if (!vehicle) {
      return emptyFeatureCollection<GeoPoint>();
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [vehicle.coordinate.lng, vehicle.coordinate.lat],
          },
          properties: {
            headingDeg: vehicle.headingDeg,
          },
        },
      ],
    };
  }, [vehicle]);

  const centerCoordinate = vehicle
    ? ([vehicle.coordinate.lng, vehicle.coordinate.lat] as [number, number])
    : (routeCoordinates[0] ?? [37.617, 55.751]);

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
        styleURL={runtimeConfig.mapStyleUrl}
        onDidFailLoadingMap={(event: {
          nativeEvent?: { message?: string };
        }) => {
          setMapError(
            event.nativeEvent?.message ?? 'Failed to load map style or tiles.',
          );
        }}
        onDidFinishLoadingStyle={() => {
          if (mapError) {
            setMapError(null);
          }
        }}
      >
        <MapLibreGL.Camera
          ref={cameraRef as React.RefObject<unknown>}
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
      </MapLibreGL.MapView>

      {showThreeWorld ? (
        <View style={{ position: 'absolute', top: 12, left: 12 }}>
          <GlassPanel>
            <Text style={{ color: '#EAF1FF', fontSize: 12, fontWeight: '600' }}>
              3D World active · {qualityMode}
            </Text>
            <Text style={{ color: '#9EB0CC', fontSize: 11 }}>
              Objects: {worldRef.current.getObjects().length}
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
