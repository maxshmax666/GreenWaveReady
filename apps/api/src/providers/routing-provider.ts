import type { Route, RoutingRequest } from '@greenwave/types';

export interface RoutingProvider {
  route(input: RoutingRequest): Promise<Route[]>;
}
