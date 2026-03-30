import React from 'react';
import { View } from 'react-native';

export const VehicleMarker = ({ headingDeg }: { headingDeg: number }): React.JSX.Element => (
  <View
    style={{
      width: 24,
      height: 38,
      borderRadius: 8,
      backgroundColor: '#ECF2FF',
      borderWidth: 1,
      borderColor: '#97A8D6',
      transform: [{ rotate: `${headingDeg}deg` }],
      shadowColor: '#0F1629',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    }}
  />
);
