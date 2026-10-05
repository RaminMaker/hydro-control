import { DecimalPipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { LanguageService } from "../../../../core/i18n/language.service";
import { PumpSocketService } from "../../../../core/services/pump-socket.service";
import { HeatingLoopPanelComponent } from "../../../dashboard/components/heating-loop-panel/heating-loop-panel.component";
import { HeatingTelemetryCanvasComponent } from "../../components/heating-telemetry-canvas/heating-telemetry-canvas.component";
import { RoomHeatMapComponent } from "../../components/room-heat-map/room-heat-map.component";
import { HeatingControlCenterComponent } from "../../components/heating-control-center/heating-control-center.component";
import { PumpCommand } from "../../../../core/models/pump.models";

@Component({
  selector: "app-heating",
  standalone: true,
  imports: [
    DecimalPipe,
    HeatingLoopPanelComponent,
    HeatingTelemetryCanvasComponent,
    RoomHeatMapComponent,
    HeatingControlCenterComponent,
  ],
  templateUrl: "./heating.component.html",
  styleUrl: "./heating.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatingComponent {
  readonly pump = inject(PumpSocketService);
  readonly i18n = inject(LanguageService);
  send(command: PumpCommand): void {
    this.pump.send(command);
  }

  readonly avgRadiator = computed(() => {
    const values = this.pump.telemetry().radiatorTempsC;
    return (
      values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
    );
  });
}
