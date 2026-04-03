import React, { useEffect, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  getRuntimeConfigDiagnostics,
  getRuntimeConfigSafe,
  readExpoConstantsExtra,
  setRuntimeConfigSource,
  type RuntimeConfig,
  type RuntimeConfigDiagnostics,
} from '@greenwave/config';
import Constants from 'expo-constants';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { NavigationRoot } from './src/app/navigation-root';

const queryClient = new QueryClient();
let didLogRuntimeConfig = false;

setRuntimeConfigSource({ expoExtra: readExpoConstantsExtra(Constants) });

const getHostForLog = (rawUrl: string): string => {
  try {
    return new URL(rawUrl).host;
  } catch {
    return 'invalid-url';
  }
};

const RuntimeConfigErrorScreen = ({
  error,
  diagnostics,
}: {
  error: string;
  diagnostics: RuntimeConfigDiagnostics;
}): React.JSX.Element => {
  const primaryError = diagnostics.errors[0];
  const reason = primaryError
    ? `Reason: ${primaryError.key} (${primaryError.rule})`
    : 'Reason: unknown runtime config error';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Configuration error</Text>
        <Text style={styles.body}>{error}</Text>
        <Text style={styles.reason}>{reason}</Text>
        <Text style={styles.help}>Hint: проверьте expo extra / env.</Text>
      </View>
    </SafeAreaView>
  );
};

const App = (): React.JSX.Element => {
  const runtimeConfigResult = useMemo(() => getRuntimeConfigSafe(), []);
  const runtimeConfigDiagnostics = useMemo(() => getRuntimeConfigDiagnostics(), []);

  useEffect(() => {
    if (didLogRuntimeConfig) {
      return;
    }

    if (!runtimeConfigResult.ok) {
      console.error('[app] runtime config initialization failed:', runtimeConfigResult.error);
      console.error('[app] runtime config diagnostics:', {
        nodeEnv: runtimeConfigDiagnostics.nodeEnv,
        errors: runtimeConfigDiagnostics.errors,
        sources: runtimeConfigDiagnostics.sources,
        resolvedHosts: runtimeConfigDiagnostics.resolvedHosts,
      });
      didLogRuntimeConfig = true;
      return;
    }

    const config: RuntimeConfig = runtimeConfigResult.config;
    console.info('[app] runtime routing base host:', getHostForLog(config.routingBaseUrl));
    console.info('[app] runtime map style host:', getHostForLog(config.mapStyleUrl));
    didLogRuntimeConfig = true;
  }, [runtimeConfigDiagnostics, runtimeConfigResult]);

  if (!runtimeConfigResult.ok) {
    return (
      <RuntimeConfigErrorScreen
        error={runtimeConfigResult.error}
        diagnostics={runtimeConfigDiagnostics}
      />
    );
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
  reason: {
    color: '#fde68a',
    fontSize: 14,
    lineHeight: 20,
  },
  help: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
});

export default App;
