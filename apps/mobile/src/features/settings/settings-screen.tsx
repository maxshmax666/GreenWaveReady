import React from 'react';
import { Switch, Text, View } from 'react-native';
import { GlassPanel } from '@greenwave/ui';
import { useNavigationStore } from '../../state/navigation-store';

export const SettingsScreen = (): React.JSX.Element => {
  const {
    debugHud,
    toggleDebugHud,
    showRawGps,
    showFilteredGps,
    showSnappedPosition,
    showRouteLine,
    showPassedRoute,
    showThreeWorld,
    cameraFollowEnabled,
    objectDensity,
    toggleRawGps,
    toggleFilteredGps,
    toggleSnappedPosition,
    toggleRouteLine,
    togglePassedRoute,
    toggleThreeWorld,
    toggleCameraFollow,
    setObjectDensity,
  } = useNavigationStore((state) => state);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <GlassPanel>
        <Text style={{ color: '#EFF4FF', fontSize: 17, fontWeight: '700' }}>
          Developer toggles
        </Text>
      </GlassPanel>
      <Toggle label="Debug HUD" value={debugHud} onValueChange={toggleDebugHud} />
      <Toggle label="Raw GPS" value={showRawGps} onValueChange={toggleRawGps} />
      <Toggle label="Filtered GPS" value={showFilteredGps} onValueChange={toggleFilteredGps} />
      <Toggle label="Snapped position" value={showSnappedPosition} onValueChange={toggleSnappedPosition} />
      <Toggle label="Route line" value={showRouteLine} onValueChange={toggleRouteLine} />
      <Toggle label="Passed route" value={showPassedRoute} onValueChange={togglePassedRoute} />
      <Toggle label="3D world layer" value={showThreeWorld} onValueChange={toggleThreeWorld} />
      <Toggle label="Camera follow" value={cameraFollowEnabled} onValueChange={toggleCameraFollow} />

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['low', 'medium', 'high'] as const).map((density) => (
          <Text
            key={density}
            onPress={() => setObjectDensity(density)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: objectDensity === density ? '#31508A' : '#162238',
              color: '#EAF1FF',
              overflow: 'hidden',
            }}
          >
            {density}
          </Text>
        ))}
      </View>
    </View>
  );
};

const Toggle = ({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: () => void;
}): React.JSX.Element => (
  <View
    style={{
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: '#111827',
      borderWidth: 1,
      borderColor: '#25324B',
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
    }}
  >
    <Text style={{ color: '#DEE7FB' }}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} />
  </View>
);
