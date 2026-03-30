export type LatLng = {
  lat: number;
  lng: number;
};

export type Coordinate = LatLng;

export type GreenWaveHint = {
  speedBandKph: {
    min: number;
    max: number;
  };
  advisoryWindowSec: {
    start: number;
    end: number;
  };
  confidence: number;
  reason:
    | 'sync_with_signal_timing'
    | 'clear_intersection_queue'
    | 'incident_avoidance';
  source: 'green-wave-engine' | 'routing-provider';
};

export type RouteAnnotation = {
  speedKph?: number;
  congestionLevel?: 'low' | 'medium' | 'high';
  roadClass?: 'motorway' | 'primary' | 'secondary' | 'residential' | 'service';
  greenWaveHint?: GreenWaveHint;
};

export type NavigationManeuver = {
  id: string;
  instruction: string;
  distanceMeters: number;
  location: LatLng;
  type: 'turn-left' | 'turn-right' | 'continue' | 'u-turn' | 'arrive';
};

export type Maneuver = NavigationManeuver;

export type RouteSummary = {
  etaSeconds: number;
  distanceMeters: number;
};

export type NavigationRoute = {
  id: string;
  geometry: LatLng[];
  summary: RouteSummary;
  maneuvers: NavigationManeuver[];
  annotations: RouteAnnotation[];
};

export type Route = NavigationRoute;

export type VehicleState = {
  timestamp: string;
  coordinate: LatLng;
  headingDeg: number;
  speedKph: number;
  accuracyMeters: number;
  source: 'gps' | 'simulation' | 'map-match';
};

export type PositionPipelineState = {
  rawGps: VehicleState;
  filteredGps: VehicleState;
  snappedPosition?: VehicleState;
  renderedPosition: VehicleState;
  rawHeadingDeg: number;
  filteredHeadingDeg: number;
  cameraBearingDeg: number;
};

export type RouteProgress = {
  traveledMeters: number;
  remainingMeters: number;
  progress: number;
  etaSeconds: number;
  nextManeuver?: NavigationManeuver;
};

export type TrafficLight = {
  id: string;
  lat: number;
  lng: number;
  headingGroup: string;
  intersectionId: string;
  source: 'camera' | 'map-provider' | 'manual';
  confidence: number;
};

export type SignalPhasePrediction = {
  trafficLightId: string;
  timestamp: string;
  phase: 'red' | 'yellow' | 'green';
  confidence: number;
  cycleEstimateSec: number;
  redRemainingSec?: number;
  greenRemainingSec?: number;
};

export type CorridorSegment = {
  routeSegmentId: string;
  recommendedSpeedMin: number;
  recommendedSpeedMax: number;
  confidence: number;
  reason: string;
  affectedLights: string[];
};

export type RoutingRequest = {
  origin: LatLng;
  destination: LatLng;
  waypoints?: LatLng[];
  profile: 'car';
  avoidTolls?: boolean;
};

export type RecalculateReason = 'off_route' | 'traffic_event' | 'user_request';

export type RecalculateMetadata = {
  previousRouteId?: string;
  deviationMeters?: number;
  trafficEventId?: string;
  requestedBy?: 'driver' | 'system';
};

export type MapMatchTracePoint = {
  coordinate: LatLng;
  timestamp: string;
  headingDeg?: number;
  speedKph?: number;
  accuracyMeters?: number;
};

export type MapMatchRequest = {
  trace: MapMatchTracePoint[];
  profile: 'car';
};

export type MapMatchedPoint = {
  original: LatLng;
  matched: LatLng;
  distanceFromTraceMeters: number;
  confidence: number;
  roadClass?: 'motorway' | 'primary' | 'secondary' | 'residential' | 'service';
};

export type MapMatchResult = {
  provider: string;
  matchedPath: LatLng[];
  matchedPoints: MapMatchedPoint[];
  confidence: number;
};
