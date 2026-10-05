import { Injectable, inject } from "@angular/core";
import { AuthService } from "../auth/auth.service";

export type HistoryRange = "live" | "1h" | "24h" | "7d" | "30d";
export interface HistorySample {
  timestamp: number;
  pressure: number;
  flow: number;
}
interface HistoryResponse {
  range: HistoryRange;
  source: "SIMULATED_WITH_LIVE_SAMPLES";
  samples: HistorySample[];
  generatedAt: number;
}

@Injectable({ providedIn: "root" })
export class TelemetryHistoryService {
  private readonly auth = inject(AuthService);

  async getHistory(
    range: HistoryRange,
    signal?: AbortSignal,
  ): Promise<HistoryResponse> {
    const token = this.auth.getToken();
    if (!token) throw new Error("Unauthorized");
    const response = await fetch(
      `http://localhost:8081/api/history?range=${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      },
    );
    if (!response.ok)
      throw new Error(`History request failed: ${response.status}`);
    return (await response.json()) as HistoryResponse;
  }
}
