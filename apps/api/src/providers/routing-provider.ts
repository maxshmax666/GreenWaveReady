import type { MapMatchRequest, MapMatchResult, Route, RoutingRequest } from '@greenwave/types';

export interface RoutingProvider {
  route(input: RoutingRequest): Promise<Route[]>;
  mapMatch(input: MapMatchRequest): Promise<MapMatchResult>;
}
