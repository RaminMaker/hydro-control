import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { LanguageService } from "../../core/i18n/language.service";
import { PumpSocketService } from "../../core/services/pump-socket.service";
import { TelemetryCanvasComponent } from "../dashboard/components/telemetry-canvas/telemetry-canvas.component";
import { CardModule } from "primeng/card";
import { TagModule } from "primeng/tag";

@Component({
  selector: "app-analytics",
  standalone: true,
  imports: [DecimalPipe, TelemetryCanvasComponent, CardModule, TagModule],
  templateUrl: "./analytics.component.html",
  styleUrl: "./analytics.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent {
  readonly pump = inject(PumpSocketService);
  readonly i18n = inject(LanguageService);
  specificEnergy(): number {
    const t = this.pump.telemetry();
    return t.powerKw / Math.max(0.1, t.flowLpm * 0.06);
  }
  hydraulicLoad(): number {
    return Math.min(100, (this.pump.telemetry().flowLpm / 28) * 100);
  }
}
