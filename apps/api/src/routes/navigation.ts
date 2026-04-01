import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { RouteService } from '../services/route-service';

const coord = z.object({ lat: z.number(), lng: z.number() }).strict();
const routeInput = z
  .object({
    origin: coord,
    destination: coord,
    waypoints: z.array(coord).optional(),
    profile: z.literal('car'),
    avoidTolls: z.boolean().optional(),
  })
  .strict();

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

const routesResponseSchema = z.object({ routes: z.array(routeSchema).min(1) }).strict();
const recalcRequestSchema = routeInput.extend({
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
});

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

const respondIfInvalid = <T>(
  requestId: string,
  reply: { status: (code: number) => { send: (data: unknown) => unknown } },
  parsed: z.SafeParseReturnType<unknown, T>,
): parsed is z.SafeParseSuccess<T> => {
  if (parsed.success) {
    return true;
  }

  reply.status(400).send({ error: parsed.error.format(), requestId });
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


const toRecalculateMetadata = (
  metadata: z.infer<typeof recalcRequestSchema>['metadata'],
) => {
  if (!metadata) {
    return undefined;
  }

  return {
    ...(metadata.previousRouteId ? { previousRouteId: metadata.previousRouteId } : {}),
    ...(metadata.deviationMeters !== undefined ? { deviationMeters: metadata.deviationMeters } : {}),
    ...(metadata.trafficEventId ? { trafficEventId: metadata.trafficEventId } : {}),
    ...(metadata.requestedBy ? { requestedBy: metadata.requestedBy } : {}),
  };
};

export const registerNavigationRoutes = (
  app: FastifyInstance,
  routeService: RouteService,
): void => {
  app.post('/routes', async (request, reply) => {
    reply.header('x-request-id', request.id);
    const parsed = routeInput.safeParse(request.body);
    if (!respondIfInvalid(request.id, reply, parsed)) {
      return;
    }

    const routes = await routeService.calculateRoutes(toRoutingRequest(parsed.data));
    const response = routesResponseSchema.safeParse({ routes });

    if (!response.success) {
      request.log.error(
        { error: response.error.flatten(), requestId: request.id },
        'Invalid /routes payload after normalization',
      );
      return reply.status(502).send({
        error: 'Invalid routing response payload',
        requestId: request.id,
      });
    }

    return response.data;
  });

  app.post('/routes/recalculate', async (request, reply) => {
    reply.header('x-request-id', request.id);
    const parsed = recalcRequestSchema.safeParse(request.body);
    if (!respondIfInvalid(request.id, reply, parsed)) {
      return;
    }

    return routeService.recalculateRoutes(toRoutingRequest(parsed.data), parsed.data.reason, toRecalculateMetadata(parsed.data.metadata));
  });

  app.post('/map-match', async (request, reply) => {
    reply.header('x-request-id', request.id);
    const parsed = mapMatchRequestSchema.safeParse(request.body);
    if (!respondIfInvalid(request.id, reply, parsed)) {
      return;
    }

    return routeService.mapMatch(toMapMatchRequest(parsed.data));
  });
};
