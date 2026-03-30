import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoutePlanningScreen } from '../features/route-planning/route-planning-screen';
import { ActiveNavigationScreen } from '../features/active-navigation/active-navigation-screen';
import { SettingsScreen } from '../features/settings/settings-screen';

type RootStackParamList = {
  RoutePlanning: undefined;
  ActiveNavigation: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#05070C',
    card: '#0E1320',
    text: '#EFF4FF',
    border: '#1C2943',
    primary: '#5FA2FF',
  },
};

export const NavigationRoot = (): React.JSX.Element => (
  <NavigationContainer theme={navTheme}>
    <Stack.Navigator
      initialRouteName="RoutePlanning"
      screenOptions={{
        headerStyle: { backgroundColor: '#0B101B' },
        headerTintColor: '#EFF4FF',
        contentStyle: { backgroundColor: '#05070C' },
      }}
    >
      <Stack.Screen
        name="RoutePlanning"
        component={RoutePlanningScreen}
        options={{ title: 'GreenWaveReady' }}
      />
      <Stack.Screen
        name="ActiveNavigation"
        component={ActiveNavigationScreen}
        options={{ title: 'Driving Mode' }}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);
