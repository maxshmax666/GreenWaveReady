import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { smoothHeading, type CameraModel } from '@greenwave/navigation-core';
import type { Coordinate, VehicleState } from '@greenwave/types';

type CameraMode = 'follow' | 'overview';

type DeriveCameraModel = (speedKph: number) => CameraModel;

type CameraConfig = {
  centerCoordinate?: [number, number];
  zoomLevel?: number;
  pitch?: number;
  heading?: number;
  animationDuration?: number;
};

type CameraAnimationMode = 'flyTo' | 'easeTo' | 'linearTo' | 'moveTo';

export type MapCameraController = {
  setCamera: (config: CameraConfig & { animationMode?: CameraAnimationMode }) => void;
  easeTo?: (config: CameraConfig) => void;
  flyTo: (coordinates: [number, number], durationMs?: number) => void;
  fitBounds: (
    northEast: [number, number],
    southWest: [number, number],
    padding?: [number, number, number, number],
    durationMs?: number,
  ) => void;
};

type UseCameraControllerInput = {
  vehicleState: VehicleState | undefined;
  cameraMode: CameraMode;
  routeProgress: number;
  routePolyline: Coordinate[];
  deriveCameraModel: DeriveCameraModel;
  cameraRef: RefObject<MapCameraController | null>;
};

const CAMERA_UPDATE_HZ = 7;
const CAMERA_TICK_MS = Math.round(1000 / CAMERA_UPDATE_HZ);
const HEADING_SPIKE_DEG = 40;
const HEADING_DEBOUNCE_MS = 320;
const OVERVIEW_PADDING: [number, number, number, number] = [48, 24, 220, 24];
const DEFAULT_OVERVIEW_DURATION_MS = 750;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

const angularDelta = (a: number, b: number): number => {
  const delta = ((b - a + 540) % 360) - 180;
  return Math.abs(delta);
};

const haversineMeters = (a: Coordinate, b: Coordinate): number => {
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const latA = toRad(a.lat);
  const latB = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(latA) * Math.cos(latB) * sinLon * sinLon;
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const clamp01 = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
};

const computeBounds = (
  polyline: Coordinate[],
): { northEast: [number, number]; southWest: [number, number] } | null => {
  if (polyline.length === 0) {
    return null;
  }

  let minLat = polyline[0]!.lat;
  let maxLat = polyline[0]!.lat;
  let minLng = polyline[0]!.lng;
  let maxLng = polyline[0]!.lng;

  for (let i = 1; i < polyline.length; i += 1) {
    const pt = polyline[i]!;
    minLat = Math.min(minLat, pt.lat);
    maxLat = Math.max(maxLat, pt.lat);
    minLng = Math.min(minLng, pt.lng);
    maxLng = Math.max(maxLng, pt.lng);
  }

  return {
    northEast: [maxLng, maxLat],
    southWest: [minLng, minLat],
  };
};

const computeCumulativeDistances = (polyline: Coordinate[]): number[] => {
  if (polyline.length === 0) {
    return [0];
  }
  const cumulative: number[] = [0];
  for (let i = 1; i < polyline.length; i += 1) {
    cumulative.push(
      cumulative[i - 1]! + haversineMeters(polyline[i - 1]!, polyline[i]!),
    );
  }
  return cumulative;
};

const interpolateAtDistance = (
  polyline: Coordinate[],
  cumulative: number[],
  distanceMeters: number,
): Coordinate | null => {
  if (polyline.length === 0) {
    return null;
  }
  if (polyline.length === 1) {
    return polyline[0]!;
  }

  const routeTotal = cumulative[cumulative.length - 1] ?? 0;
  const clampedDistance = Math.min(Math.max(0, distanceMeters), routeTotal);

  let rightIdx = cumulative.findIndex((d) => d >= clampedDistance);
  if (rightIdx <= 0) {
    rightIdx = 1;
  }

  const leftIdx = rightIdx - 1;
  const leftDistance = cumulative[leftIdx] ?? 0;
  const rightDistance = cumulative[rightIdx] ?? leftDistance;
  const segmentDistance = rightDistance - leftDistance;
  const t =
    segmentDistance <= 0
      ? 0
      : (clampedDistance - leftDistance) / segmentDistance;

  const left = polyline[leftIdx]!;
  const right = polyline[rightIdx]!;

  return {
    lat: left.lat + (right.lat - left.lat) * t,
    lng: left.lng + (right.lng - left.lng) * t,
  };
};

export const useCameraController = ({
  vehicleState,
  cameraMode,
  routeProgress,
  routePolyline,
  deriveCameraModel,
  cameraRef,
}: UseCameraControllerInput): void => {
  const routeDistances = useMemo(
    () => computeCumulativeDistances(routePolyline),
    [routePolyline],
  );
  const routeBounds = useMemo(
    () => computeBounds(routePolyline),
    [routePolyline],
  );

  const pendingCommandRef = useRef<(() => void) | null>(null);
  const smoothedHeadingRef = useRef<number | null>(null);
  const lastRawHeadingRef = useRef<number | null>(null);
  const lastHeadingSpikeAtRef = useRef<number>(0);
  const lastCameraCenterRef = useRef<Coordinate | null>(null);
  const wasOverviewRef = useRef<boolean>(false);
  const lastOverviewRouteHashRef = useRef<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      const runPending = pendingCommandRef.current;
      if (!runPending) {
        return;
      }
      pendingCommandRef.current = null;
      runPending();
    }, CAMERA_TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }

    if (cameraMode === 'overview') {
      const routeHash = `${routePolyline.length}:${routePolyline[0]?.lat ?? 0}:${routePolyline[0]?.lng ?? 0}:${routePolyline.at(-1)?.lat ?? 0}:${routePolyline.at(-1)?.lng ?? 0}`;
      const shouldRefit =
        !wasOverviewRef.current ||
        routeHash !== lastOverviewRouteHashRef.current;

      if (shouldRefit && routeBounds) {
        lastOverviewRouteHashRef.current = routeHash;
        wasOverviewRef.current = true;
        pendingCommandRef.current = () => {
          camera.fitBounds(
            routeBounds.northEast,
            routeBounds.southWest,
            OVERVIEW_PADDING,
            DEFAULT_OVERVIEW_DURATION_MS,
          );
        };
      }

      return;
    }

    wasOverviewRef.current = false;

    if (!vehicleState) {
      return;
    }

    const now = Date.now();
    const previousRawHeading = lastRawHeadingRef.current;
    lastRawHeadingRef.current = vehicleState.headingDeg;

    const isHeadingSpike =
      previousRawHeading !== null &&
      angularDelta(previousRawHeading, vehicleState.headingDeg) >=
        HEADING_SPIKE_DEG;
    if (isHeadingSpike) {
      lastHeadingSpikeAtRef.current = now;
    }

    const isDebounceWindow =
      now - lastHeadingSpikeAtRef.current < HEADING_DEBOUNCE_MS;

    if (smoothedHeadingRef.current === null) {
      smoothedHeadingRef.current = vehicleState.headingDeg;
    } else if (!isDebounceWindow) {
      smoothedHeadingRef.current = smoothHeading(
        smoothedHeadingRef.current,
        vehicleState.headingDeg,
        0.18,
      );
    }

    const cameraModel = deriveCameraModel(vehicleState.speedKph);
    const routeTotalMeters = routeDistances[routeDistances.length - 1] ?? 0;
    const currentDistance = routeTotalMeters * clamp01(routeProgress);
    const lookAheadDistance = currentDistance + cameraModel.lookAheadMeters;
    const lookAheadTarget =
      interpolateAtDistance(routePolyline, routeDistances, lookAheadDistance) ??
      vehicleState.coordinate;

    const lastCenter = lastCameraCenterRef.current;
    const movedMeters = lastCenter
      ? haversineMeters(lastCenter, lookAheadTarget)
      : 0;
    const nextCenter: [number, number] = [
      lookAheadTarget.lng,
      lookAheadTarget.lat,
    ];
    const heading = smoothedHeadingRef.current ?? vehicleState.headingDeg;

    pendingCommandRef.current = () => {
      if (movedMeters > 260) {
        camera.flyTo(nextCenter, 550);
        if (camera.easeTo) {
          camera.easeTo({
            heading,
            pitch: cameraModel.pitch,
            zoomLevel: cameraModel.zoom,
            animationDuration: 350,
          });
        } else {
          camera.setCamera({
            heading,
            pitch: cameraModel.pitch,
            zoomLevel: cameraModel.zoom,
            animationDuration: 350,
            animationMode: 'easeTo',
          });
        }
      } else {
        camera.setCamera({
          centerCoordinate: nextCenter,
          heading,
          pitch: cameraModel.pitch,
          zoomLevel: cameraModel.zoom,
          animationDuration: 180,
        });
      }
    };

    lastCameraCenterRef.current = lookAheadTarget;
  }, [
    cameraMode,
    cameraRef,
    deriveCameraModel,
    routeBounds,
    routeDistances,
    routePolyline,
    routeProgress,
    vehicleState,
  ]);
};
