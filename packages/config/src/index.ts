export type RuntimeConfig = {
  routingBaseUrl: string;
  tileSourceUrl: string;
  mockMode: boolean;
};

export const runtimeConfig: RuntimeConfig = {
  routingBaseUrl: process.env.ROUTING_BASE_URL ?? 'http://localhost:3000',
  tileSourceUrl: process.env.TILE_SOURCE_URL ?? 'https://demotiles.maplibre.org/style.json',
  mockMode: process.env.MOCK_MODE === 'true',
};
