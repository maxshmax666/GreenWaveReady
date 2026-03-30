import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RoutingProvider } from '../providers/routing-provider';

const coord = z.object({ lat: z.number(), lng: z.number() });
const routeInput = z.object({
  origin: coord,
  destination: coord,
  waypoints: z.array(coord).optional(),
  profile: z.literal('car'),
  avoidTolls: z.boolean().optional(),
});

export const registerNavigationRoutes = (app: FastifyInstance, routingProvider: RoutingProvider): void => {
  app.post('/routes', async (request, reply) => {
    const parsed = routeInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const routes = await routingProvider.route(parsed.data);
    return { routes };
  });

  app.post('/routes/recalculate', async (request, reply) => {
    const parsed = routeInput.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.format() });
    }
    const routes = await routingProvider.route(parsed.data);
    return { routes, reason: 'deviation_detected' };
  });

  app.post('/map-match', async () => ({ status: 'stub', provider: 'pending' }));
};
