import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { runtimeConfig } from '@greenwave/config';
import { NavigationRoot } from './src/app/navigation-root';

const queryClient = new QueryClient();
let didLogRuntimeConfig = false;

const App = (): React.JSX.Element => {
  useEffect(() => {
    if (!didLogRuntimeConfig) {
      console.info('[app] runtime routing base URL:', runtimeConfig.routingBaseUrl);
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
