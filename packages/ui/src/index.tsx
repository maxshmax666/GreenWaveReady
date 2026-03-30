import React from 'react';
import { Text, View, type ViewProps } from 'react-native';

export const GlassPanel = ({ children, ...props }: ViewProps): React.JSX.Element => (
  <View
    {...props}
    style={[
      {
        backgroundColor: 'rgba(17,20,28,0.72)',
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
      },
      props.style,
    ]}
  >
    {children}
  </View>
);

export const MetricText = ({ value, label }: { value: string; label: string }): React.JSX.Element => (
  <View>
    <Text style={{ color: '#F6F8FF', fontSize: 18, fontWeight: '700' }}>{value}</Text>
    <Text style={{ color: '#8D95A8', fontSize: 12 }}>{label}</Text>
  </View>
);
