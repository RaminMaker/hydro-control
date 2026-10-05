import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

interface GaugeTick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

@Component({
  selector: "app-metric-needle-gauge",
  standalone: true,
  templateUrl: "./metric-needle-gauge.component.html",
  styleUrl: "./metric-needle-gauge.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetricNeedleGaugeComponent {
  private static nextId = 0;
  @Input({ required: true }) label = "";
  @Input({ required: true }) value = 0;
  @Input() min = 0;
  @Input() max = 100;
  @Input() unit = "";
  @Input() decimals = 0;
  @Input() status = "";
  @Input() icon = "•";
  @Input() tone: "default" | "warm" | "good" | "warn" = "default";

  readonly uniqueId = MetricNeedleGaugeComponent.nextId++;
  readonly gradientId = `metric-gauge-gradient-${this.uniqueId}`;
  readonly glowId = `metric-gauge-glow-${this.uniqueId}`;
  readonly ticks: GaugeTick[] = Array.from({ length: 9 }, (_, index) => {
    const theta = Math.PI - index * (Math.PI / 8);
    return {
      x1: 160 + 103 * Math.cos(theta),
      y1: 145 - 103 * Math.sin(theta),
      x2: 160 + 91 * Math.cos(theta),
      y2: 145 - 91 * Math.sin(theta),
    };
  });

  get progress(): number {
    if (!Number.isFinite(this.value) || this.max <= this.min) return 0;
    return Math.max(
      0,
      Math.min(100, ((this.value - this.min) / (this.max - this.min)) * 100),
    );
  }
  get needleTheta(): number {
    return Math.PI - (this.progress / 100) * Math.PI;
  }
  get needleX(): number {
    return 160 + 78 * Math.cos(this.needleTheta);
  }
  get needleY(): number {
    return 145 - 78 * Math.sin(this.needleTheta);
  }
  get formattedValue(): string {
    return Number.isFinite(this.value)
      ? this.value.toFixed(this.decimals)
      : "—";
  }
  get minLabel(): string {
    return this.compact(this.min);
  }
  get maxLabel(): string {
    return this.compact(this.max);
  }

  private compact(value: number): string {
    if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
    if (Math.abs(value) >= 100) return `${Math.round(value)}`;
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
  }
}
