import { DatePipe, DecimalPipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { LanguageService } from "../../core/i18n/language.service";
import { PumpCommand } from "../../core/models/pump.models";
import { PumpSocketService } from "../../core/services/pump-socket.service";
import { ControlPanelComponent } from "./components/control-panel/control-panel.component";
import { HeatingLoopPanelComponent } from "./components/heating-loop-panel/heating-loop-panel.component";
import { MetricNeedleGaugeComponent } from "./components/metric-needle-gauge/metric-needle-gauge.component";
import { PressureGaugeComponent } from "./components/pressure-gauge/pressure-gauge.component";
import { PumpScene3dComponent } from "./components/pump-scene3d/pump-scene3d.component";
import { TelemetryCanvasComponent } from "./components/telemetry-canvas/telemetry-canvas.component";
import { TagModule } from "primeng/tag";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    PumpScene3dComponent,
    PressureGaugeComponent,
    TelemetryCanvasComponent,
    ControlPanelComponent,
    HeatingLoopPanelComponent,
    MetricNeedleGaugeComponent,
    TagModule,
  ],
  templateUrl: "./dashboard.component.html",
  styleUrl: "./dashboard.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly pump = inject(PumpSocketService);
  readonly i18n = inject(LanguageService);
  readonly t = this.pump.telemetry;

  readonly headMeters = computed(() =>
    (this.t().pressureBar * 10.2).toFixed(1),
  );
  readonly rpmPct = computed(() => Math.round((this.t().rpm / 2850) * 100));
  readonly efficiency = computed(() =>
    Math.round(Math.min(97, 51 + this.t().flowLpm * 1.3)),
  );
  readonly tankLiters = computed(() => (this.t().tankLevelPct / 100) * 1200);
  readonly reserveMinutes = computed(() =>
    Math.round(
      ((this.t().tankLevelPct / 100) * 1200) / Math.max(this.t().flowLpm, 1),
    ),
  );
  readonly burnerAlarm = computed(() =>
    this.pump
      .alarms()
      .find((alarm) =>
        [
          "Boiler ignition",
          "Boiler standby",
          "Boiler package enabled",
          "Boiler package disabled",
          "Boiler failure simulated",
          "Low pressure simulated",
          "Radiator airlock simulated",
        ].includes(alarm.title),
      ),
  );

  send(command: PumpCommand): void {
    this.pump.send(command);
  }
}
