import type { MapMatchRequest, MapMatchResult, Route, RoutingRequest } from '@greenwave/types';
import type { RoutingProvider } from './routing-provider';

const toManeuver = (id: string, instruction: string, distanceMeters: number, lat: number, lng: number) => ({
  id,
  instruction,
  distanceMeters,
  location: { lat, lng },
  type: 'continue' as const,
});

export class MockRoutingProvider implements RoutingProvider {
  async route(input: RoutingRequest): Promise<Route[]> {
    const geometry = [input.origin, ...(input.waypoints ?? []), input.destination];
    return [
      {
        id: 'mock-primary',
        geometry,
        summary: { etaSeconds: 760, distanceMeters: 8400 },
        maneuvers: [toManeuver('m1', 'Continue straight', 1200, input.origin.lat, input.origin.lng)],
        annotations: geometry.map((_, index) => ({
          speedKph: 45,
          congestionLevel: 'medium' as const,
          ...(index % 2 === 0
            ? {
                greenWaveHint: {
                  speedBandKph: { min: 38, max: 46 },
                  advisoryWindowSec: { start: 5, end: 22 },
                  confidence: 0.72,
                  reason: 'sync_with_signal_timing' as const,
                  source: 'green-wave-engine' as const,
                },
              }
            : {}),
        })),
      },
    ];
  }

  async mapMatch(input: MapMatchRequest): Promise<MapMatchResult> {
    const matchedPoints = input.trace.map((point) => ({
      original: point.coordinate,
      matched: {
        lat: Number(point.coordinate.lat.toFixed(5)),
        lng: Number(point.coordinate.lng.toFixed(5)),
      },
      distanceFromTraceMeters: 4,
      confidence: 0.87,
      roadClass: 'primary' as const,
    }));

    return {
      provider: 'mock',
      matchedPath: matchedPoints.map((point) => point.matched),
      matchedPoints,
      confidence: 0.87,
    };
  }
}
