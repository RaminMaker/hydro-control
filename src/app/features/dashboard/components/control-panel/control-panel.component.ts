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
  PumpMode,
} from "../../../../core/models/pump.models";
import { computed } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ButtonModule } from "primeng/button";
import { SliderModule } from "primeng/slider";
import { ToggleSwitchModule } from "primeng/toggleswitch";
import { SelectButtonModule } from "primeng/selectbutton";
import { TagModule } from "primeng/tag";

@Component({
  selector: "app-control-panel",
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    SliderModule,
    ToggleSwitchModule,
    SelectButtonModule,
    TagModule,
  ],
  templateUrl: "./control-panel.component.html",
  styleUrl: "./control-panel.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControlPanelComponent {
  @Input({ required: true }) telemetry!: PumpTelemetry;
  @Output() command = new EventEmitter<PumpCommand>();
  readonly i18n = inject(LanguageService);
  readonly modeOptions = computed(() => {
    this.i18n.language();
    return [
      { label: this.i18n.t("control.auto"), value: "AUTO" },
      { label: this.i18n.t("control.manual"), value: "MANUAL" },
      { label: this.i18n.t("control.off"), value: "OFF" },
    ];
  });
  readonly faultOptions = computed(() => {
    this.i18n.language();
    return [
      { label: this.i18n.t("control.normalOperation"), value: "NONE" },
      { label: this.i18n.t("control.boilerFailure"), value: "BOILER_FAILURE" },
      { label: this.i18n.t("control.lowPressure"), value: "LOW_PRESSURE" },
      { label: this.i18n.t("control.airlock"), value: "AIRLOCK" },
    ];
  });
  setMode(value: PumpMode): void {
    if (value) this.emit({ type: "SET_MODE", mode: value });
  }
  setPressureValue(value: number): void {
    this.emit({ type: "SET_TARGET_PRESSURE", value });
  }
  setValveValue(value: number): void {
    this.emit({ type: "SET_VALVE", value });
  }
  setRadiatorValveValue(value: number): void {
    this.emit({ type: "SET_RADIATOR_VALVE", value });
  }
  setZoneValveValue(index: number, value: number): void {
    this.emit({ type: "SET_RADIATOR_ZONE_VALVE", index, value });
  }

  emit(command: PumpCommand): void {
    this.command.emit(command);
  }
  setPressure(event: Event): void {
    this.emit({
      type: "SET_TARGET_PRESSURE",
      value: Number((event.target as HTMLInputElement).value),
    });
  }
  setValve(event: Event): void {
    this.emit({
      type: "SET_VALVE",
      value: Number((event.target as HTMLInputElement).value),
    });
  }
  setRadiatorValve(event: Event): void {
    this.emit({
      type: "SET_RADIATOR_VALVE",
      value: Number((event.target as HTMLInputElement).value),
    });
  }
  setZoneValve(index: number, event: Event): void {
    this.emit({
      type: "SET_RADIATOR_ZONE_VALVE",
      index,
      value: Number((event.target as HTMLInputElement).value),
    });
  }
  toggleZoneValve(index: number): void {
    this.emit({
      type: "SET_RADIATOR_ZONE_VALVE",
      index,
      value: (this.telemetry.radiatorValvePcts[index] ?? 0) > 0 ? 0 : 100,
    });
  }
  toggleBoiler(): void {
    this.emit({
      type: "SET_BOILER_ENABLED",
      value: !this.telemetry.boilerEnabled,
    });
  }
  setFault(mode: HeatingFaultMode): void {
    this.emit({ type: "SET_HEATING_FAULT", mode });
  }
}
