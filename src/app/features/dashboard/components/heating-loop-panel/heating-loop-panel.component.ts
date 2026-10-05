import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from "@angular/core";
import { DecimalPipe } from "@angular/common";
import { PumpTelemetry } from "../../../../core/models/pump.models";
import { LanguageService } from "../../../../core/i18n/language.service";

@Component({
  selector: "app-heating-loop-panel",
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: "./heating-loop-panel.component.html",
  styleUrl: "./heating-loop-panel.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatingLoopPanelComponent {
  @Input({ required: true }) telemetry!: PumpTelemetry;
  readonly i18n = inject(LanguageService);

  averageRadiatorTemp(): number {
    return (
      this.telemetry.radiatorTempsC.reduce((sum, value) => sum + value, 0) /
      Math.max(1, this.telemetry.radiatorTempsC.length)
    );
  }

  heatPercent(temp: number): string {
    return `${Math.max(18, Math.min(100, ((temp - 22) / 40) * 100))}%`;
  }
  zoneValve(index: number): number {
    return Math.round(this.telemetry.radiatorValvePcts[index] ?? 0);
  }
  flowActive(): boolean {
    return (
      this.telemetry.pumpRunning &&
      this.telemetry.boilerEnabled &&
      this.telemetry.radiatorValvePct > 2
    );
  }

  valveLabel(): string {
    if (this.telemetry.radiatorValvePct === 0)
      return this.i18n.t("control.close");
    if (this.telemetry.radiatorValvePct >= 95)
      return this.i18n.t("control.open");
    return `${this.telemetry.radiatorValvePct.toFixed(0)}%`;
  }

  burnerStateText(): string {
    if (!this.telemetry.boilerEnabled) return this.i18n.t("control.off");
    return this.telemetry.burnerOn
      ? this.i18n.t("heating.on")
      : this.i18n.t("heating.off");
  }

  burnerTitle(): string {
    if (this.telemetry.heatingFaultMode === "BOILER_FAILURE")
      return this.i18n.t("alarm.title.boilerFailureSim");
    if (this.telemetry.heatingFaultMode === "LOW_PRESSURE")
      return this.i18n.t("alarm.title.lowPressureSim");
    if (this.telemetry.heatingFaultMode === "AIRLOCK")
      return this.i18n.t("alarm.title.airlockSim");
    if (!this.telemetry.boilerEnabled)
      return this.i18n.t("alarm.title.boilerDisabled");
    return this.telemetry.burnerOn
      ? this.i18n.t("alarm.title.boilerIgnition")
      : this.i18n.t("alarm.title.boilerStandby");
  }

  burnerMessage(): string {
    if (this.telemetry.heatingFaultMode === "BOILER_FAILURE")
      return this.i18n.t("alarm.msg.boilerFailureSim");
    if (this.telemetry.heatingFaultMode === "LOW_PRESSURE")
      return this.i18n.t("alarm.msg.lowPressureSim");
    if (this.telemetry.heatingFaultMode === "AIRLOCK")
      return this.i18n.t("alarm.msg.airlockSim");
    if (!this.telemetry.boilerEnabled)
      return this.i18n.t("alarm.msg.boilerDisabled");
    return this.telemetry.burnerOn
      ? this.i18n.t("alarm.msg.boilerIgnition")
      : this.i18n.t("alarm.msg.boilerStandby");
  }

  statusText(): string {
    if (this.telemetry.heatingFaultMode === "BOILER_FAILURE")
      return this.i18n.t("alarm.msg.boilerFailureSim");
    if (this.telemetry.heatingFaultMode === "LOW_PRESSURE")
      return this.i18n.t("alarm.msg.lowPressureSim");
    if (this.telemetry.heatingFaultMode === "AIRLOCK")
      return this.i18n.t("alarm.msg.airlockSim");
    if (!this.telemetry.boilerEnabled)
      return this.i18n.t("alarm.msg.boilerDisabled");
    if (this.telemetry.radiatorValvePct === 0)
      return this.i18n.t("alarm.msg.radiatorValveClosed");
    return this.telemetry.burnerOn
      ? this.i18n.t("heating.reignitionOn")
      : this.i18n.t("heating.reignitionOff");
  }
}
