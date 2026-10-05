import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from "@angular/core";
import { LanguageService } from "../../../../core/i18n/language.service";
import { PumpTelemetry } from "../../../../core/models/pump.models";
import { ThemeService } from "../../../../core/theme/theme.service";

interface HeatingSample {
  t: number;
  supply: number;
  return: number;
  avg: number;
  exchanger: number;
  burner: number;
}

@Component({
  selector: "app-heating-telemetry-canvas",
  standalone: true,
  templateUrl: "./heating-telemetry-canvas.component.html",
  styleUrl: "./heating-telemetry-canvas.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeatingTelemetryCanvasComponent
  implements AfterViewInit, OnDestroy
{
  @ViewChild("canvas", { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;
  readonly i18n = inject(LanguageService);
  private readonly theme = inject(ThemeService);
  private samples: HeatingSample[] = [];
  private resize?: ResizeObserver;
  private ready = false;

  constructor() {
    effect(() => {
      this.i18n.language();
      this.theme.theme();
      if (this.ready) this.draw();
    });
  }

  @Input() set telemetry(value: PumpTelemetry | null) {
    if (!value) return;
    const last = this.samples.at(-1);
    if (last?.t === value.timestamp) return;
    const avg =
      value.radiatorTempsC.reduce((sum, item) => sum + item, 0) /
      Math.max(1, value.radiatorTempsC.length);
    this.samples.push({
      t: value.timestamp,
      supply: value.boilerSupplyC,
      return: value.boilerReturnC,
      avg,
      exchanger: value.heatExchangerC,
      burner: value.burnerOn ? 1 : 0,
    });
    if (this.samples.length > 90) this.samples.shift();
    if (this.ready) this.draw();
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(this.canvasRef.nativeElement);
    this.draw();
    void document.fonts.ready.then(() => {
      if (this.ready) this.draw();
    });
  }

  ngOnDestroy(): void {
    this.resize?.disconnect();
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const light = this.theme.theme() === "light";
    const pad = { l: 44, r: 20, t: 18, b: w < 620 ? 52 : 34 };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;
    const grid = light ? "rgba(63,101,117,.12)" : "rgba(120,160,178,.10)";
    const muted = light ? "#718792" : "#667f8e";
    const supply = "#efb866";
    const ret = light ? "#0b93c7" : "#45cff4";
    const avg = light ? "#2a9d72" : "#71ddaa";
    const hx = light ? "#c8683b" : "#ff9f63";

    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (ch * i) / 5;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const x = pad.l + (cw * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x, pad.t);
      ctx.lineTo(x, h - pad.b);
      ctx.stroke();
    }

    const data = this.samples.length > 1 ? this.samples : this.seedData();
    this.plot(ctx, data, (s) => s.supply, 20, 80, pad, cw, ch, supply);
    this.plot(ctx, data, (s) => s.return, 20, 80, pad, cw, ch, ret);
    this.plot(ctx, data, (s) => s.avg, 20, 80, pad, cw, ch, avg);
    this.plot(ctx, data, (s) => s.exchanger, 20, 85, pad, cw, ch, hx, [6, 4]);

    ctx.font = this.i18n.isRtl()
      ? "11px Vazir, Tahoma, sans-serif"
      : "10px Inter, system-ui, sans-serif";
    ctx.fillStyle = muted;
    ctx.fillText("80°", 6, pad.t + 4);
    ctx.fillText("20°", 6, h - pad.b + 3);

    const legendItems = [
      [supply, this.i18n.t("dashboard.boilerSupply")],
      [ret, this.i18n.t("dashboard.boilerReturn")],
      [avg, this.i18n.t("heating.avgTemp")],
      [hx, this.i18n.t("dashboard.heatExchanger")],
    ] as const;
    if (w < 620) {
      const columnWidth = Math.max(120, (w - pad.l - pad.r) / 2);
      legendItems.forEach(([color, label], index) =>
        this.legend(
          ctx,
          pad.l + (index % 2) * columnWidth,
          h - 24 + Math.floor(index / 2) * 14,
          color,
          label,
        ),
      );
    } else {
      let lx = pad.l;
      legendItems.forEach(([color, label]) => {
        this.legend(ctx, lx, h - 10, color, label);
        lx += 42 + Math.min(120, ctx.measureText(label).width + 18);
      });
    }

    const burnerOn = data.at(-1)?.burner === 1;
    ctx.fillStyle = burnerOn ? hx : muted;
    ctx.fillText(
      `${this.i18n.t("dashboard.burner")}: ${burnerOn ? this.i18n.t("heating.on") : this.i18n.t("heating.off")}`,
      Math.max(pad.l, w - 168),
      16,
    );
  }

  private plot(
    ctx: CanvasRenderingContext2D,
    data: HeatingSample[],
    value: (s: HeatingSample) => number,
    min: number,
    max: number,
    pad: { l: number; r: number; t: number; b: number },
    cw: number,
    ch: number,
    color: string,
    dash: number[] = [],
  ): void {
    ctx.beginPath();
    data.forEach((s, i) => {
      const x = pad.l + (i / Math.max(1, data.length - 1)) * cw;
      const y = pad.t + ch - ((value(s) - min) / (max - min)) * ch;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 7;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  private legend(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    text: string,
  ): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 6, 16, 2);
    ctx.fillText(text, x + 22, y);
  }

  private seedData(): HeatingSample[] {
    return Array.from({ length: 24 }, (_, i) => ({
      t: Date.now() - (24 - i) * 1000,
      supply: 56 + Math.sin(i / 4) * 2,
      return: 42 + Math.sin(i / 4 - 0.4) * 1.8,
      avg: 45 + Math.sin(i / 4 - 0.25) * 1.3,
      exchanger: 64 + Math.cos(i / 5) * 2.2,
      burner: i % 8 < 5 ? 1 : 0,
    }));
  }
}
