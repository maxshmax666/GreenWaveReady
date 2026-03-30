import cors from '@fastify/cors';
import { runtimeConfig } from '@greenwave/config';
import Fastify from 'fastify';
import { registerGreenWaveRoutes } from './routes/green-wave';
import { registerNavigationRoutes } from './routes/navigation';
import { MockRoutingProvider } from './providers/mock-routing-provider';

const bootstrap = async (): Promise<void> => {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  const routingProvider = new MockRoutingProvider();

  app.get('/health', async () => ({ status: 'ok', mockMode: runtimeConfig.mockMode }));
  registerNavigationRoutes(app, routingProvider);
  registerGreenWaveRoutes(app);

  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void bootstrap();
