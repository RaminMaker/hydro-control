import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { LanguageService } from "../../../../core/i18n/language.service";
import { PumpTelemetry } from "../../../../core/models/pump.models";

@Component({
  selector: "app-room-heat-map",
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: "./room-heat-map.component.html",
  styleUrl: "./room-heat-map.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoomHeatMapComponent {
  @Input({ required: true }) telemetry!: PumpTelemetry;
  readonly i18n = inject(LanguageService);
  readonly rooms = [
    { key: "heating.livingRoom" },
    { key: "heating.bedroom" },
    { key: "heating.office" },
    { key: "heating.kitchen" },
    { key: "heating.guestRoom" },
  ];

  valve(index: number): number {
    return Math.round(this.telemetry.radiatorValvePcts[index] ?? 0);
  }
  roomHeat(index: number): string {
    return `${Math.max(0.12, Math.min(1, ((this.telemetry.roomTempsC[index] ?? 18) - 18) / 8))}`;
  }
  radiatorHeat(index: number): string {
    return `${Math.max(8, Math.min(100, (((this.telemetry.radiatorTempsC[index] ?? 22) - 22) / 42) * 100))}%`;
  }
  heatOutput(index: number): number {
    const valve = (this.telemetry.radiatorValvePcts[index] ?? 0) / 100;
    const heat = Math.max(
      0,
      (this.telemetry.radiatorTempsC[index] ?? 22) -
        (this.telemetry.roomTempsC[index] ?? 20),
    );
    const airlock =
      this.telemetry.heatingFaultMode === "AIRLOCK" && index === 2 ? 0.18 : 1;
    return Math.round(Math.min(100, (heat / 36) * 100 * valve * airlock));
  }

  faultLabel(): string {
    switch (this.telemetry.heatingFaultMode) {
      case "BOILER_FAILURE":
        return this.i18n.t("heating.faultBoiler");
      case "LOW_PRESSURE":
        return this.i18n.t("heating.faultPressure");
      case "AIRLOCK":
        return this.i18n.t("heating.faultAirlock");
      default:
        return this.i18n.t("heating.normal");
    }
  }
}
