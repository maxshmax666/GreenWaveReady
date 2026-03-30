import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GlassPanel } from '@greenwave/ui';

type RootStackParamList = {
  RoutePlanning: undefined;
  ActiveNavigation: undefined;
  Settings: undefined;
};

export const RoutePlanningScreen = (): React.JSX.Element => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <GlassPanel>
        <Text style={{ color: '#EFF4FF', fontSize: 18, fontWeight: '700' }}>
          Планирование маршрута
        </Text>
        <Text style={{ color: '#97A4C0', marginTop: 6 }}>
          MVP: A/B preset, альтернативы, готово к live geocoding.
        </Text>
      </GlassPanel>

      <TouchableOpacity
        onPress={() => navigation.navigate('ActiveNavigation')}
        style={{
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: '#1A2B49',
          borderWidth: 1,
          borderColor: '#2B4475',
        }}
      >
        <Text style={{ textAlign: 'center', color: '#EFF4FF', fontWeight: '700' }}>
          Start Driving Mode
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Settings')}
        style={{
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: '#111A2C',
          borderWidth: 1,
          borderColor: '#293751',
        }}
      >
        <Text style={{ textAlign: 'center', color: '#D9E4FF', fontWeight: '600' }}>
          Debug / Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
};
