import type { Route, RoutingRequest } from '@greenwave/types';
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
        annotations: geometry.map(() => ({ speedKph: 45, congestionLevel: 'medium' as const })),
      },
    ];
  }
}
