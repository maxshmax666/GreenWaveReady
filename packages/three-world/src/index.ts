import type { Coordinate, VehicleState } from '@greenwave/types';

export type QualityMode = 'low' | 'medium' | 'high';

export type WorldObject = {
  id: string;
  kind: 'tree' | 'building' | 'vehicle';
  coordinate: Coordinate;
  scale: number;
};

export type WorldSyncState = {
  cameraBearing: number;
  cameraPitch: number;
  center: Coordinate;
  routeCorridor: Coordinate[];
  vehicle?: VehicleState;
};

export interface WorldRenderer<TRenderPayload = unknown> {
  render(objects: readonly WorldObject[]): TRenderPayload;
}

export interface WorldLayer {
  setQuality(mode: QualityMode): void;
  sync(state: WorldSyncState): void;
  getObjects(): readonly WorldObject[];
}

const TREE_DENSITY_BY_QUALITY: Record<QualityMode, number> = {
  low: 8,
  medium: 16,
  high: 32,
};

export class ThreeWorldManager implements WorldLayer {
  private quality: QualityMode = 'medium';
  private objects: WorldObject[] = [];
  private objectsById = new Map<string, WorldObject>();

  setQuality(mode: QualityMode): void {
    this.quality = mode;
  }

  sync(state: WorldSyncState): void {
    const density = TREE_DENSITY_BY_QUALITY[this.quality];
    const trees = state.routeCorridor.slice(0, density).map((point, index) => ({
      id: `tree-${index}`,
      kind: 'tree' as const,
      coordinate: {
        lat: point.lat + (index % 2 === 0 ? 0.00006 : -0.00006),
        lng: point.lng + (index % 2 === 0 ? -0.00006 : 0.00006),
      },
      scale: this.quality === 'high' ? 1.1 : 0.9,
    }));

    const buildings = state.routeCorridor
      .slice(0, Math.max(2, Math.floor(density / 4)))
      .map((point, index) => ({
        id: `building-${index}`,
        kind: 'building' as const,
        coordinate: {
          lat: point.lat + 0.00016,
          lng: point.lng + (index % 2 === 0 ? 0.00014 : -0.00014),
        },
        scale: this.quality === 'high' ? 1.2 : 1,
      }));

    const vehicle = state.vehicle
      ? [
          {
            id: 'vehicle-active',
            kind: 'vehicle' as const,
            coordinate: state.vehicle.coordinate,
            scale: 1,
          },
        ]
      : [];

    const nextObjects: WorldObject[] = [];
    const nextIds = new Set<string>();
    const nextCandidates = [...trees, ...buildings, ...vehicle];

    for (const candidate of nextCandidates) {
      nextIds.add(candidate.id);
      const existing = this.objectsById.get(candidate.id);
      if (existing) {
        existing.kind = candidate.kind;
        existing.coordinate = candidate.coordinate;
        existing.scale = candidate.scale;
        nextObjects.push(existing);
      } else {
        this.objectsById.set(candidate.id, candidate);
        nextObjects.push(candidate);
      }
    }

    for (const existingId of this.objectsById.keys()) {
      if (!nextIds.has(existingId)) {
        this.objectsById.delete(existingId);
      }
    }

    this.objects = nextObjects;
  }

  getObjects(): readonly WorldObject[] {
    return this.objects;
  }
}
