export type Coordinate = {
  lat: number;
  lng: number;
};

export type RouteAnnotation = {
  speedKph?: number;
  congestionLevel?: 'low' | 'medium' | 'high';
  roadClass?: 'motorway' | 'primary' | 'secondary' | 'residential' | 'service';
};

export type Maneuver = {
  id: string;
  instruction: string;
  distanceMeters: number;
  location: Coordinate;
  type: 'turn-left' | 'turn-right' | 'continue' | 'u-turn' | 'arrive';
};

export type RouteSummary = {
  etaSeconds: number;
  distanceMeters: number;
};

export type Route = {
  id: string;
  geometry: Coordinate[];
  summary: RouteSummary;
  maneuvers: Maneuver[];
  annotations: RouteAnnotation[];
};

export type VehicleState = {
  timestamp: string;
  coordinate: Coordinate;
  headingDeg: number;
  speedKph: number;
  accuracyMeters: number;
  source: 'gps' | 'simulation' | 'map-match';
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
  origin: Coordinate;
  destination: Coordinate;
  waypoints?: Coordinate[];
  profile: 'car';
  avoidTolls?: boolean;
};
