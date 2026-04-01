import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runtimeConfig } from '@greenwave/config';
import { NavigationRoot } from './src/app/navigation-root';

const queryClient = new QueryClient();
let didLogRuntimeConfig = false;

const getHostForLog = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).host;
  } catch {
    return 'invalid-url';
  }
};

const App = (): React.JSX.Element => {
  useEffect(() => {
    if (!didLogRuntimeConfig) {
      console.info('[app] runtime routing base host:', getHostForLog(runtimeConfig.routingBaseUrl));
      console.info('[app] runtime map style host:', getHostForLog(runtimeConfig.mapStyleUrl));
      didLogRuntimeConfig = true;
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationRoot />
    </QueryClientProvider>
  );
};

export default App;
