import React, { useMemo } from 'react';
import MapLibreGL from '@maplibre/maplibre-react-native';
import type { WorldObject } from '@greenwave/three-world';

type GeoPoint = { type: 'Point'; coordinates: [number, number] };
type Feature = {
  type: 'Feature';
  geometry: GeoPoint;
  properties: {
    id: string;
    kind: WorldObject['kind'];
    scale: number;
    glyph: string;
  };
};
type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

const KIND_GLYPH: Record<WorldObject['kind'], string> = {
  tree: '🌳',
  vehicle: '🚗',
  building: '▦',
};

const emptyFeatureCollection = (): FeatureCollection => ({
  type: 'FeatureCollection',
  features: [],
});

export type ThreeWorldOverlayProps = {
  objects: readonly WorldObject[];
  visible: boolean;
};

export const ThreeWorldOverlay = ({
  objects,
  visible,
}: ThreeWorldOverlayProps): React.JSX.Element | null => {
  const overlayGeoJson = useMemo<FeatureCollection>(() => {
    if (!visible || objects.length === 0) {
      return emptyFeatureCollection();
    }

    return {
      type: 'FeatureCollection',
      features: objects.map((object) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [object.coordinate.lng, object.coordinate.lat],
        },
        properties: {
          id: object.id,
          kind: object.kind,
          scale: object.scale,
          glyph: KIND_GLYPH[object.kind],
        },
      })),
    };
  }, [objects, visible]);

  if (!visible) {
    return null;
  }

  return (
    <MapLibreGL.ShapeSource id="three-world-objects" shape={overlayGeoJson}>
      <MapLibreGL.CircleLayer
        id="three-world-trees"
        filter={['==', ['get', 'kind'], 'tree']}
        style={{
          circleColor: '#3ED67A',
          circleRadius: ['interpolate', ['linear'], ['get', 'scale'], 0.7, 3, 1.2, 5],
          circleOpacity: 0.9,
          circleStrokeColor: '#1B4F33',
          circleStrokeWidth: 1,
        }}
      />

      <MapLibreGL.CircleLayer
        id="three-world-vehicles"
        filter={['==', ['get', 'kind'], 'vehicle']}
        style={{
          circleColor: '#4DA3FF',
          circleRadius: ['interpolate', ['linear'], ['get', 'scale'], 0.8, 4, 1.2, 7],
          circleOpacity: 0.95,
          circleStrokeColor: '#173F70',
          circleStrokeWidth: 1.5,
        }}
      />

      <MapLibreGL.SymbolLayer
        id="three-world-buildings"
        filter={['==', ['get', 'kind'], 'building']}
        style={{
          textField: ['get', 'glyph'],
          textSize: ['interpolate', ['linear'], ['get', 'scale'], 0.8, 11, 1.2, 14],
          textColor: '#D5C38B',
          textHaloColor: '#3D2D00',
          textHaloWidth: 0.8,
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
    </MapLibreGL.ShapeSource>
  );
};
