import { Injectable, computed, inject, signal } from "@angular/core";
import {
  AlarmEvent,
  ConnectionState,
  PumpCommand,
  PumpTelemetry,
  SocketEnvelope,
} from "../models/pump.models";
import { AuthService } from "../auth/auth.service";

const INITIAL_TELEMETRY: PumpTelemetry = {
  timestamp: Date.now(),
  pressureBar: 3.2,
  flowLpm: 18,
  rpm: 2140,
  powerKw: 0.82,
  temperatureC: 43,
  tankLevelPct: 74,
  valvePct: 68,
  pumpRunning: true,
  mode: "AUTO",
  targetPressureBar: 3.4,
  boilerEnabled: true,
  boilerColdInletC: 21.5,
  boilerHotOutletC: 48,
  boilerSupplyC: 56,
  boilerReturnC: 42,
  heatExchangerC: 61,
  burnerOn: true,
  radiatorValvePct: 82,
  radiatorValvePcts: [100, 88, 78, 92, 70],
  radiatorTempsC: [49, 47.5, 46.8, 45.9, 44.7],
  roomTempsC: [23.4, 22.8, 22.3, 21.9, 22.1],
  heatingFaultMode: "NONE",
};

@Injectable({ providedIn: "root" })
export class PumpSocketService {
  private readonly auth = inject(AuthService);
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempt = 0;
  private manualDisconnect = false;
  private pendingCommands: PumpCommand[] = [];
  private readonly url = "ws://localhost:8081";

  private readonly _connection = signal<ConnectionState>("offline");
  private readonly _telemetry = signal<PumpTelemetry>(INITIAL_TELEMETRY);
  private readonly _alarms = signal<AlarmEvent[]>([]);
  private readonly _lastAck = signal<string>("—");

  readonly connection = this._connection.asReadonly();
  readonly telemetry = this._telemetry.asReadonly();
  readonly alarms = this._alarms.asReadonly();
  readonly lastAck = this._lastAck.asReadonly();
  readonly isOnline = computed(() => this._connection() === "online");
  readonly activeAlarms = computed(() =>
    this._alarms().filter((a) => !a.acknowledged),
  );

  connect(): void {
    this.manualDisconnect = false;
    if (
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    )
      return;

    const token = this.auth.getToken();
    if (!token) {
      this._connection.set("offline");
      return;
    }

    this._connection.set("connecting");
    try {
      this.socket = new WebSocket(
        `${this.url}?token=${encodeURIComponent(token)}`,
      );
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this._connection.set("online");
      this.flushPendingCommands();
    };

    this.socket.onmessage = (event) => this.handleMessage(event.data);
    this.socket.onerror = () => this._connection.set("error");
    this.socket.onclose = (event) => {
      this._connection.set("offline");
      this.socket = undefined;
      if (this.manualDisconnect) return;
      if (event.code === 4401) {
        this.auth.clearSession();
        return;
      }
      if (this.auth.isAuthenticated()) this.scheduleReconnect();
    };
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.socket?.close(1000, "Client disconnect");
    this.socket = undefined;
    this.pendingCommands = [];
    this._connection.set("offline");
  }

  send(command: PumpCommand): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "COMMAND", payload: command }));
      return;
    }

    if (!this.auth.isAuthenticated()) return;
    this.queueCommand(command);
    this.connect();
  }

  private queueCommand(command: PumpCommand): void {
    const replaceable = new Set([
      "SET_MODE",
      "SET_TARGET_PRESSURE",
      "SET_VALVE",
      "SET_BOILER_ENABLED",
      "SET_RADIATOR_VALVE",
      "SET_HEATING_FAULT",
    ]);
    if (command.type === "SET_RADIATOR_ZONE_VALVE") {
      this.pendingCommands = this.pendingCommands.filter(
        (item) =>
          item.type !== "SET_RADIATOR_ZONE_VALVE" ||
          item.index !== command.index,
      );
    } else if (replaceable.has(command.type)) {
      this.pendingCommands = this.pendingCommands.filter(
        (item) => item.type !== command.type,
      );
    }
    this.pendingCommands.push(command);
    if (this.pendingCommands.length > 24)
      this.pendingCommands.splice(0, this.pendingCommands.length - 24);
  }

  private flushPendingCommands(): void {
    if (
      this.socket?.readyState !== WebSocket.OPEN ||
      this.pendingCommands.length === 0
    )
      return;
    const queued = this.pendingCommands.splice(0);
    queued.forEach((command) =>
      this.socket?.send(JSON.stringify({ type: "COMMAND", payload: command })),
    );
  }

  acknowledgeAlarm(id: string): void {
    this.send({ type: "ACK_ALARM", id });
    this._alarms.update((items) =>
      items.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    );
  }

  private handleMessage(raw: string): void {
    try {
      const message = JSON.parse(raw) as SocketEnvelope;
      if (message.type === "TELEMETRY")
        this._telemetry.set(message.payload as PumpTelemetry);
      if (message.type === "ALARM") {
        const alarm = message.payload as AlarmEvent;
        this._alarms.update((items) => [alarm, ...items].slice(0, 50));
      }
      if (message.type === "SNAPSHOT") {
        const snapshot = message.payload as {
          telemetry: PumpTelemetry;
          alarms: AlarmEvent[];
        };
        this._telemetry.set(snapshot.telemetry);
        this._alarms.set(snapshot.alarms);
      }
      if (message.type === "COMMAND_ACK") {
        const ack = message.payload as { message: string };
        this._lastAck.set(ack.message);
      }
    } catch {}
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 8000);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
