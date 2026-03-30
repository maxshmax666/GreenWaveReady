import type { Route } from '@greenwave/types';

export interface RouteNormalizer {
  normalizeRoutes(routes: Route[]): Route[];
}

export class DefaultRouteNormalizer implements RouteNormalizer {
  normalizeRoutes(routes: Route[]): Route[] {
    return routes.map((route, index) => ({
      ...route,
      id: route.id || `route-${index + 1}`,
      maneuvers: route.maneuvers.filter((maneuver) => maneuver.instruction.length > 0),
    }));
  }
}
