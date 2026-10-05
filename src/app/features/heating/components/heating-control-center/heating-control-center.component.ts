import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from "@angular/core";
import { LanguageService } from "../../../../core/i18n/language.service";
import {
  HeatingFaultMode,
  PumpCommand,
  PumpTelemetry,
} from "../../../../core/models/pump.models";
import { computed } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { SelectButtonModule } from "primeng/selectbutton";
import { SliderModule } from "primeng/slider";
import { ProgressBarModule } from "primeng/progressbar";
import { ToggleSwitchModule } from "primeng/toggleswitch";

@Component({
  selector: "app-heating-control-center",
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    SelectButtonModule,
    SliderModule,
    ProgressBarModule,
    ToggleSwitchModule,
  ],
  templateUrl: "./heating-control-center.component.html",
  styleUrl: "./heating-control-center.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatingControlCenterComponent {
  @Input({ required: true }) telemetry!: PumpTelemetry;
  @Output() command = new EventEmitter<PumpCommand>();
  readonly i18n = inject(LanguageService);
  readonly faultOptions = computed(() => {
    this.i18n.language();
    return [
      { label: this.i18n.t("control.normalOperation"), value: "NONE" },
      { label: this.i18n.t("control.boilerFailure"), value: "BOILER_FAILURE" },
      { label: this.i18n.t("control.lowPressure"), value: "LOW_PRESSURE" },
      { label: this.i18n.t("control.airlock"), value: "AIRLOCK" },
    ];
  });
  setZoneValue(index: number, value: number): void {
    this.emit({ type: "SET_RADIATOR_ZONE_VALVE", index, value });
  }
  emit(command: PumpCommand): void {
    this.command.emit(command);
  }
  fault(mode: HeatingFaultMode): void {
    this.emit({ type: "SET_HEATING_FAULT", mode });
  }
  setZone(index: number, event: Event): void {
    this.emit({
      type: "SET_RADIATOR_ZONE_VALVE",
      index,
      value: Number((event.target as HTMLInputElement).value),
    });
  }
  toggleZone(index: number): void {
    this.emit({
      type: "SET_RADIATOR_ZONE_VALVE",
      index,
      value: (this.telemetry.radiatorValvePcts[index] ?? 0) > 0 ? 0 : 100,
    });
  }
}
