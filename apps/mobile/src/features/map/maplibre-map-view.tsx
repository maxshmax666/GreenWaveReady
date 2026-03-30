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
import { deriveCameraModel } from '@greenwave/navigation-core';

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

export const MapLibreMapView = ({
  route,
  vehicle,
  cameraMode,
  showGreenWaveOverlay,
  routeProgress,
}: MapAdapterProps): React.JSX.Element => {
  const [mapRenderEpoch, setMapRenderEpoch] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);

  const routeCoordinates = useMemo(
    () =>
      route?.geometry.map(
        (point) => [point.lng, point.lat] as [number, number],
      ) ?? [],
    [route],
  );

  const cameraRef = useRef<MapCameraController | null>(null);

  useCameraController({
    vehicleState: vehicle,
    cameraMode,
    routeProgress,
    routePolyline: route?.geometry ?? [],
    deriveCameraModel,
    cameraRef,
  });

  const routeGeoJson = useMemo<GeoFeatureCollection<GeoLineString>>(() => {
    if (routeCoordinates.length < 2) {
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
  }, [routeCoordinates]);

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

  const terrainEnabled = Boolean(
    (MapLibreGL as unknown as { Terrain?: unknown }).Terrain,
  );
  const skyEnabled = Boolean(
    (MapLibreGL as unknown as { SkyLayer?: unknown }).SkyLayer,
  );

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
          zoomLevel={13.6}
          pitch={35}
        />

        <MapLibreGL.VectorSource
          id="greenwave-base"
          tileUrlTemplates={[runtimeConfig.mapTileEndpoint]}
        >
          <MapLibreGL.FillExtrusionLayer
            id="buildings-3d"
            sourceLayerID="building"
            minZoomLevel={14}
            style={{
              fillExtrusionColor: '#4B648E',
              fillExtrusionOpacity: 0.42,
              fillExtrusionHeight: ['coalesce', ['get', 'height'], 10],
              fillExtrusionBase: ['coalesce', ['get', 'min_height'], 0],
            }}
          />
        </MapLibreGL.VectorSource>

        {terrainEnabled ? (
          <>
            <MapLibreGL.RasterDemSource
              id="terrain-dem"
              tileUrlTemplates={[runtimeConfig.mapTileEndpoint]}
              tileSize={256}
            >
              <MapLibreGL.Terrain sourceID="terrain-dem" exaggeration={1.15} />
            </MapLibreGL.RasterDemSource>
          </>
        ) : null}

        {skyEnabled ? (
          <MapLibreGL.SkyLayer
            id="map-sky"
            style={{
              skyType: 'atmosphere',
              skyAtmosphereColor: '#4FA3FF',
              skyAtmosphereSun: [0.0, 90.0],
              skyAtmosphereSunIntensity: 8,
            }}
          />
        ) : null}

        <MapLibreGL.ShapeSource id="route-shape" shape={routeGeoJson}>
          <MapLibreGL.LineLayer
            id="route-line"
            style={{
              lineColor: '#69A8FF',
              lineWidth: 5,
              lineCap: 'round',
              lineJoin: 'round',
            }}
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

      {mapError ? (
        <View style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
          <GlassPanel>
            <Text
              style={{ color: '#F6F9FF', fontWeight: '700', marginBottom: 6 }}
            >
              Map temporarily unavailable
            </Text>
            <Text style={{ color: '#A9B5CC', marginBottom: 10 }}>
              {mapError}
            </Text>
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
