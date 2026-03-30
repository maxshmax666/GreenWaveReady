import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationRoot } from './src/app/navigation-root';

const queryClient = new QueryClient();

const App = (): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <NavigationRoot />
  </QueryClientProvider>
);

export default App;
