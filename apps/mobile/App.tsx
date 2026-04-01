import React, { useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getRuntimeConfigSafe, type RuntimeConfig } from '@greenwave/config';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
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

const RuntimeConfigErrorScreen = ({ error }: { error: string }): React.JSX.Element => (
  <SafeAreaView style={styles.container}>
    <View style={styles.content}>
      <Text style={styles.title}>Configuration error</Text>
      <Text style={styles.body}>{error}</Text>
      <Text style={styles.help}>
        Set EXPO_PUBLIC_ROUTING_BASE_URL and EXPO_PUBLIC_MAP_STYLE_URL in your environment and restart the app.
      </Text>
    </View>
  </SafeAreaView>
);

const App = (): React.JSX.Element => {
  const runtimeConfigResult = useMemo(() => getRuntimeConfigSafe(), []);

  useEffect(() => {
    if (didLogRuntimeConfig) {
      return;
    }

    if (!runtimeConfigResult.ok) {
      console.error('[app] runtime config initialization failed:', runtimeConfigResult.error);
      didLogRuntimeConfig = true;
      return;
    }

    const config: RuntimeConfig = runtimeConfigResult.config;
    console.info('[app] runtime routing base host:', getHostForLog(config.routingBaseUrl));
    console.info('[app] runtime map style host:', getHostForLog(config.mapStyleUrl));
    didLogRuntimeConfig = true;
  }, [runtimeConfigResult]);

  if (!runtimeConfigResult.ok) {
    return <RuntimeConfigErrorScreen error={runtimeConfigResult.error} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationRoot />
    </QueryClientProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071420',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
  },
  body: {
    color: '#fecaca',
    fontSize: 15,
    lineHeight: 22,
  },
  help: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default App;
