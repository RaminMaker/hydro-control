export type PumpMode = "AUTO" | "MANUAL" | "OFF";
export type ConnectionState = "connecting" | "online" | "offline" | "error";
export type AlarmSeverity = "info" | "warning" | "critical";
export type HeatingFaultMode =
  | "NONE"
  | "BOILER_FAILURE"
  | "LOW_PRESSURE"
  | "AIRLOCK";

export interface PumpTelemetry {
  timestamp: number;
  pressureBar: number;
  flowLpm: number;
  rpm: number;
  powerKw: number;
  temperatureC: number;
  tankLevelPct: number;
  valvePct: number;
  pumpRunning: boolean;
  mode: PumpMode;
  targetPressureBar: number;

  boilerEnabled: boolean;
  boilerColdInletC: number;
  boilerHotOutletC: number;
  boilerSupplyC: number;
  boilerReturnC: number;
  heatExchangerC: number;
  burnerOn: boolean;
  radiatorValvePct: number;
  radiatorValvePcts: number[];
  radiatorTempsC: number[];
  roomTempsC: number[];
  heatingFaultMode: HeatingFaultMode;
}

export interface AlarmEvent {
  id: string;
  timestamp: number;
  severity: AlarmSeverity;
  title: string;
  message: string;
  acknowledged: boolean;
}

export type PumpCommand =
  | { type: "SET_MODE"; mode: PumpMode }
  | { type: "SET_TARGET_PRESSURE"; value: number }
  | { type: "SET_VALVE"; value: number }
  | { type: "SET_BOILER_ENABLED"; value: boolean }
  | { type: "SET_RADIATOR_VALVE"; value: number }
  | { type: "SET_RADIATOR_ZONE_VALVE"; index: number; value: number }
  | { type: "SET_HEATING_FAULT"; mode: HeatingFaultMode }
  | { type: "START" }
  | { type: "STOP" }
  | { type: "ACK_ALARM"; id: string };

export interface SocketEnvelope<T = unknown> {
  type: "TELEMETRY" | "ALARM" | "SNAPSHOT" | "COMMAND_ACK";
  payload: T;
}
