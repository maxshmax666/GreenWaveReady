import { deriveCameraModel, projectProgress } from '@greenwave/navigation-core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNavigationStore } from './navigation-store';

export type DerivedMetrics = {
  progress: number;
  etaSeconds: number;
  cameraPitch: number;
};

const DEFAULT_UI_METRICS_INTERVAL_MS = 1_000;

const areMetricsEqual = (
  left: DerivedMetrics,
  right: DerivedMetrics,
): boolean =>
  left.progress === right.progress &&
  left.etaSeconds === right.etaSeconds &&
  left.cameraPitch === right.cameraPitch;

export const useDerivedMetrics = (
  updateIntervalMs = DEFAULT_UI_METRICS_INTERVAL_MS,
): DerivedMetrics => {
  const { activeRoute, vehicleState } = useNavigationStore(
    useShallow((state) => ({
      activeRoute: state.activeRoute,
      vehicleState: state.vehicleState,
    })),
  );

  const instantMetrics = useMemo<DerivedMetrics>(() => {
    const progress =
      activeRoute && vehicleState
        ? projectProgress(activeRoute.geometry, vehicleState)
        : 0;
    const clampedProgress = Math.min(Math.max(progress, 0), 1);
    const etaSeconds = Math.max(
      0,
      Math.round(
        (activeRoute?.summary.etaSeconds ?? 0) * (1 - clampedProgress),
      ),
    );
    const cameraPitch =
      Math.round(deriveCameraModel(vehicleState?.speedKph ?? 0).pitch * 10) /
      10;

    return {
      progress: Number(clampedProgress.toFixed(3)),
      etaSeconds,
      cameraPitch,
    };
  }, [activeRoute, vehicleState]);

  const instantMetricsRef = useRef(instantMetrics);
  const [sampledMetrics, setSampledMetrics] = useState(instantMetrics);

  useEffect(() => {
    instantMetricsRef.current = instantMetrics;
  }, [instantMetrics]);

  useEffect(() => {
    setSampledMetrics((currentMetrics) =>
      areMetricsEqual(currentMetrics, instantMetrics)
        ? currentMetrics
        : instantMetrics,
    );
  }, [instantMetrics]);

  useEffect(() => {
    const id = setInterval(() => {
      setSampledMetrics((currentMetrics) => {
        const nextMetrics = instantMetricsRef.current;

        return areMetricsEqual(currentMetrics, nextMetrics)
          ? currentMetrics
          : nextMetrics;
      });
    }, updateIntervalMs);

    return () => clearInterval(id);
  }, [updateIntervalMs]);

  return sampledMetrics;
};
