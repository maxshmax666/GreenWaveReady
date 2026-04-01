declare module 'expo-location' {
  export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

  export type LocationPermissionResponse = {
    status: PermissionStatus;
  };

  export type LocationSubscription = {
    remove: () => void;
  };

  export type LocationObject = {
    timestamp: number;
    coords: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
  };

  export const Accuracy: {
    Balanced: number;
  };

  export function requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  export function watchPositionAsync(
    options: { accuracy: number; distanceInterval?: number; timeInterval?: number },
    callback: (location: LocationObject) => void,
  ): Promise<LocationSubscription>;
}
