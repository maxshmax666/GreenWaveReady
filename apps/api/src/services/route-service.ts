import type { MapMatchRequest, MapMatchResult, RecalculateMetadata, RecalculateReason, Route, RoutingRequest } from '@greenwave/types';
import type { RoutingProvider } from '../providers/routing-provider';
import type { RouteNormalizer } from '../normalizers/route-normalizer';

export class RouteService {
  constructor(
    private readonly provider: RoutingProvider,
    private readonly normalizer: RouteNormalizer,
  ) {}

  async calculateRoutes(request: RoutingRequest): Promise<Route[]> {
    const routes = await this.provider.route(request);
    return this.normalizer.normalizeRoutes(routes);
  }

  async recalculateRoutes(request: RoutingRequest, reason: RecalculateReason, metadata?: RecalculateMetadata): Promise<{ routes: Route[]; reason: RecalculateReason; metadata?: RecalculateMetadata }> {
    const routes = await this.calculateRoutes(request);
    return {
      routes,
      reason,
      ...(metadata ? { metadata } : {}),
    };
  }

  async mapMatch(request: MapMatchRequest): Promise<MapMatchResult> {
    return this.provider.mapMatch(request);
  }
}
