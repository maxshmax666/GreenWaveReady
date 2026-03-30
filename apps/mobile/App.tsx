import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationScreen } from './src/features/navigation/navigation-screen';

const queryClient = new QueryClient();

const App = (): React.JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <NavigationScreen />
  </QueryClientProvider>
);

export default App;
