import type { FastifyInstance } from 'fastify';

export const registerGreenWaveRoutes = (app: FastifyInstance): void => {
  app.get('/green-wave/corridor/:routeId', async (request) => {
    const routeId = (request.params as { routeId: string }).routeId;
    return {
      routeId,
      segments: [
        {
          routeSegmentId: `${routeId}-1`,
          recommendedSpeedMin: 38,
          recommendedSpeedMax: 46,
          confidence: 0.62,
          reason: 'sync_with_estimated_green_phase',
          affectedLights: ['tl-101', 'tl-102'],
        },
      ],
    };
  });

  app.post('/telemetry/events', async () => ({ status: 'accepted' }));
};
