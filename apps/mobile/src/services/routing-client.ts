import { runtimeConfig } from '@greenwave/config';
import type { Route, RoutingRequest } from '@greenwave/types';

export const fetchRoutes = async (input: RoutingRequest): Promise<Route[]> => {
  const response = await fetch(`${runtimeConfig.routingBaseUrl}/routes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Routing failed with status ${response.status}`);
  }

  const parsed = (await response.json()) as { routes: Route[] };
  return parsed.routes;
};
