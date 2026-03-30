import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RoutingProvider } from '../providers/routing-provider';

const coord = z.object({ lat: z.number(), lng: z.number() }).strict();

const greenWaveHintSchema = z
  .object({
    speedBandKph: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }).strict(),
    advisoryWindowSec: z.object({ start: z.number().nonnegative(), end: z.number().nonnegative() }).strict(),
    confidence: z.number().min(0).max(1),
    reason: z.enum(['sync_with_signal_timing', 'clear_intersection_queue', 'incident_avoidance']),
    source: z.enum(['green-wave-engine', 'routing-provider']),
  })
  .strict();

const routeSchema = z
  .object({
    id: z.string().min(1),
    geometry: z.array(coord).min(2),
    summary: z.object({ etaSeconds: z.number().int().nonnegative(), distanceMeters: z.number().nonnegative() }).strict(),
    maneuvers: z
      .array(
        z
          .object({
            id: z.string().min(1),
            instruction: z.string().min(1),
            distanceMeters: z.number().nonnegative(),
            location: coord,
            type: z.enum(['turn-left', 'turn-right', 'continue', 'u-turn', 'arrive']),
          })
          .strict(),
      )
      .min(1),
    annotations: z.array(
      z
        .object({
          speedKph: z.number().nonnegative().optional(),
          congestionLevel: z.enum(['low', 'medium', 'high']).optional(),
          roadClass: z.enum(['motorway', 'primary', 'secondary', 'residential', 'service']).optional(),
          greenWaveHint: greenWaveHintSchema.optional(),
        })
        .strict(),
    ),
  })
  .strict();

const routeInput = z
  .object({
    origin: coord,
    destination: coord,
    waypoints: z.array(coord).optional(),
    profile: z.literal('car'),
    avoidTolls: z.boolean().optional(),
  })
  .strict();

const routesResponseSchema = z.object({ routes: z.array(routeSchema).min(1) }).strict();

const recalcRequestSchema = routeInput
  .extend({
    reason: z.enum(['off_route', 'traffic_event', 'user_request']),
    metadata: z
      .object({
        previousRouteId: z.string().min(1).optional(),
        deviationMeters: z.number().nonnegative().optional(),
        trafficEventId: z.string().min(1).optional(),
        requestedBy: z.enum(['driver', 'system']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const recalcResponseSchema = z
  .object({
    routes: z.array(routeSchema).min(1),
    reason: z.enum(['off_route', 'traffic_event', 'user_request']),
    metadata: z
      .object({
        previousRouteId: z.string().min(1).optional(),
        deviationMeters: z.number().nonnegative().optional(),
        trafficEventId: z.string().min(1).optional(),
        requestedBy: z.enum(['driver', 'system']).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const mapMatchRequestSchema = z
  .object({
    trace: z
      .array(
        z
          .object({
            coordinate: coord,
            timestamp: z.string().datetime(),
            headingDeg: z.number().min(0).max(360).optional(),
            speedKph: z.number().nonnegative().optional(),
            accuracyMeters: z.number().nonnegative().optional(),
          })
          .strict(),
      )
      .min(2),
    profile: z.literal('car'),
  })
  .strict();

const mapMatchResponseSchema = z
  .object({
    provider: z.string().min(1),
    matchedPath: z.array(coord).min(2),
    matchedPoints: z
      .array(
        z
          .object({
            original: coord,
            matched: coord,
            distanceFromTraceMeters: z.number().nonnegative(),
            confidence: z.number().min(0).max(1),
            roadClass: z.enum(['motorway', 'primary', 'secondary', 'residential', 'service']).optional(),
          })
          .strict(),
      )
      .min(2),
    confidence: z.number().min(0).max(1),
  })
  .strict();

const respondIfInvalid = <T>(reply: { status: (code: number) => { send: (data: unknown) => unknown } }, parsed: z.SafeParseReturnType<unknown, T>): parsed is z.SafeParseSuccess<T> => {
  if (parsed.success) {
    return true;
  }

  reply.status(400).send({ error: parsed.error.format() });
  return false;
};


const toRoutingRequest = (input: z.infer<typeof routeInput>) => ({
  origin: input.origin,
  destination: input.destination,
  profile: input.profile,
  ...(input.waypoints ? { waypoints: input.waypoints } : {}),
  ...(input.avoidTolls !== undefined ? { avoidTolls: input.avoidTolls } : {}),
});

const toMapMatchRequest = (input: z.infer<typeof mapMatchRequestSchema>) => ({
  profile: input.profile,
  trace: input.trace.map((point) => ({
    coordinate: point.coordinate,
    timestamp: point.timestamp,
    ...(point.headingDeg !== undefined ? { headingDeg: point.headingDeg } : {}),
    ...(point.speedKph !== undefined ? { speedKph: point.speedKph } : {}),
    ...(point.accuracyMeters !== undefined ? { accuracyMeters: point.accuracyMeters } : {}),
  })),
});

export const registerNavigationRoutes = (app: FastifyInstance, routingProvider: RoutingProvider): void => {
  app.post('/routes', async (request, reply) => {
    const parsed = routeInput.safeParse(request.body);
    if (!respondIfInvalid(reply, parsed)) {
      return;
    }

    const routes = await routingProvider.route(toRoutingRequest(parsed.data));
    const response = routesResponseSchema.safeParse({ routes });
    if (!response.success) {
      request.log.error({ error: response.error.flatten() }, 'Routing provider returned invalid /routes payload');
      return reply.status(502).send({ error: 'Invalid routing response payload' });
    }

    return response.data;
  });

  app.post('/routes/recalculate', async (request, reply) => {
    const parsed = recalcRequestSchema.safeParse(request.body);
    if (!respondIfInvalid(reply, parsed)) {
      return;
    }

    const routes = await routingProvider.route(toRoutingRequest(parsed.data));
    const response = recalcResponseSchema.safeParse({
      routes,
      reason: parsed.data.reason,
      metadata: parsed.data.metadata,
    });
    if (!response.success) {
      request.log.error({ error: response.error.flatten() }, 'Routing provider returned invalid /routes/recalculate payload');
      return reply.status(502).send({ error: 'Invalid routing response payload' });
    }

    return response.data;
  });

  app.post('/map-match', async (request, reply) => {
    const parsed = mapMatchRequestSchema.safeParse(request.body);
    if (!respondIfInvalid(reply, parsed)) {
      return;
    }

    const matched = await routingProvider.mapMatch(toMapMatchRequest(parsed.data));
    const response = mapMatchResponseSchema.safeParse(matched);
    if (!response.success) {
      request.log.error({ error: response.error.flatten() }, 'Routing provider returned invalid /map-match payload');
      return reply.status(502).send({ error: 'Invalid map-match response payload' });
    }

    return response.data;
  });
};
