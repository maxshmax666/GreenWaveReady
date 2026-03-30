import cors from '@fastify/cors';
import { runtimeConfig } from '@greenwave/config';
import Fastify from 'fastify';
import { MockRoutingProvider } from './providers/mock-routing-provider';
import { registerGreenWaveRoutes } from './routes/green-wave';
import { registerNavigationRoutes } from './routes/navigation';
import { DefaultRouteNormalizer } from './normalizers/route-normalizer';
import { RouteService } from './services/route-service';

const REQUEST_TIMEOUT_MS = 10_000;
const PAYLOAD_SIZE_LIMIT_BYTES = 1_048_576;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

type RateBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateBucket>();

const pruneExpiredBuckets = (now: number): void => {
  if (buckets.size < 5_000) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

const applyIpRateLimit = (ip: string): RateBucket => {
  const now = Date.now();
  pruneExpiredBuckets(now);
  const existing = buckets.get(ip);

  if (!existing || existing.resetAt <= now) {
    const nextBucket = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    buckets.set(ip, nextBucket);
    return nextBucket;
  }

  existing.count += 1;
  return existing;
};

const bootstrap = async (): Promise<void> => {
  const app = Fastify({
    logger: true,
    requestTimeout: REQUEST_TIMEOUT_MS,
    bodyLimit: PAYLOAD_SIZE_LIMIT_BYTES,
  });

  await app.register(cors, { origin: true });

  app.addHook('onRequest', async (request, reply) => {
    const bucket = applyIpRateLimit(request.ip);
    reply.header('x-ratelimit-limit', RATE_LIMIT_MAX_REQUESTS);
    reply.header('x-ratelimit-remaining', Math.max(RATE_LIMIT_MAX_REQUESTS - bucket.count, 0));
    reply.header('x-ratelimit-reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
      return reply.status(429).send({
        error: 'Too Many Requests',
        statusCode: 429,
        retryAfterSeconds: Math.max(Math.ceil((bucket.resetAt - Date.now()) / 1000), 1),
      });
    }
  });

  const routingProvider = new MockRoutingProvider();
  const routeService = new RouteService(routingProvider, new DefaultRouteNormalizer());

  app.get('/health', async () => ({ status: 'ok', mockMode: runtimeConfig.mockMode }));
  registerNavigationRoutes(app, routeService);
  registerGreenWaveRoutes(app);

  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void bootstrap();
