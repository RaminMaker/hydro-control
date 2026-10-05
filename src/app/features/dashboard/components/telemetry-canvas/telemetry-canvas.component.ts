import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  effect,
  inject,
  signal,
} from "@angular/core";
import { ChartModule, UIChart } from "primeng/chart";
import { ButtonModule } from "primeng/button";
import { TagModule } from "primeng/tag";
import { Chart, type ChartData, type ChartOptions } from "chart.js/auto";
import zoomPlugin from "chartjs-plugin-zoom";
import { LanguageService } from "../../../../core/i18n/language.service";
import { PumpTelemetry } from "../../../../core/models/pump.models";
import { ThemeService } from "../../../../core/theme/theme.service";
import {
  HistoryRange,
  HistorySample,
  TelemetryHistoryService,
} from "../../../../core/services/telemetry-history.service";

Chart.register(zoomPlugin);

type XY = { x: number; y: number };

@Component({
  selector: "app-telemetry-canvas",
  standalone: true,
  imports: [ChartModule, ButtonModule, TagModule],
  templateUrl: "./telemetry-canvas.component.html",
  styleUrl: "./telemetry-canvas.component.css",
  host: { "[class.fixed-height]": "fixedHeight" },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TelemetryCanvasComponent implements OnInit, OnDestroy {
  @Input() fixedHeight = false;
  @ViewChild("plot") plot?: UIChart;
  readonly i18n = inject(LanguageService);
  private readonly theme = inject(ThemeService);
  private readonly historian = inject(TelemetryHistoryService);
  readonly range = signal<HistoryRange>("live");
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly ranges: Array<{ value: HistoryRange; label: string }> = [
    { value: "live", label: "trend.live" },
    { value: "1h", label: "trend.hour" },
    { value: "24h", label: "trend.day" },
    { value: "7d", label: "trend.week" },
    { value: "30d", label: "trend.month" },
  ];

  chartData: ChartData<"line", XY[]> = { datasets: [] };
  chartOptions: ChartOptions<"line"> = {};
  private samples: HistorySample[] = [];
  private controller?: AbortController;
  private lastRefresh = 0;
  private destroyed = false;

  constructor() {
    effect(() => {
      this.i18n.language();
      this.theme.theme();
      this.buildChart();
    });
  }

  @Input() set telemetry(value: PumpTelemetry | null) {
    if (!value || !Number.isFinite(value.timestamp)) return;
    if (!this.samples.length && this.loading()) return;
    const item = {
      timestamp: value.timestamp,
      pressure: value.pressureBar,
      flow: value.flowLpm,
    };
    if (
      this.samples.length &&
      item.timestamp <= this.samples[this.samples.length - 1].timestamp
    )
      return;
    const duration = this.rangeDuration(this.range());
    if (
      this.range() !== "live" &&
      this.samples.length &&
      item.timestamp - this.samples[this.samples.length - 1].timestamp <
        this.rangeStep(this.range())
    )
      return;
    this.samples.push(item);
    const cutoff = item.timestamp - duration;
    while (this.samples.length > 1 && this.samples[0].timestamp < cutoff)
      this.samples.shift();
    if (this.range() === "live" && this.samples.length > 230)
      this.samples.splice(0, this.samples.length - 230);
    if (Date.now() - this.lastRefresh > 1600) {
      this.lastRefresh = Date.now();
      this.syncLiveSamples();
    }
  }

  ngOnInit(): void {
    void this.fetchRange("live");
    void document.fonts.ready.then(() => {
      if (!this.destroyed) this.plot?.chart?.update("none");
    });
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.controller?.abort();
  }

  changeRange(next: HistoryRange): void {
    if (next === this.range()) return;
    this.range.set(next);
    void this.fetchRange(next);
  }
  resetZoom(): void {
    this.plot?.chart?.resetZoom();
  }
  zoomIn(): void {
    this.plot?.chart?.zoom({ x: 1.45, y: 1 });
  }
  zoomOut(): void {
    this.plot?.chart?.zoom({ x: 0.72, y: 1 });
  }

  private async fetchRange(next: HistoryRange): Promise<void> {
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    this.loading.set(true);
    this.error.set(false);
    try {
      const history = await this.historian.getHistory(next, controller.signal);
      if (controller.signal.aborted || this.destroyed || this.range() !== next)
        return;
      this.samples = history.samples;
      this.buildChart();
      this.resetZoom();
    } catch (error) {
      if (!controller.signal.aborted) this.error.set(true);
    } finally {
      if (!controller.signal.aborted) this.loading.set(false);
    }
  }

  private syncLiveSamples(): void {
    const chart = this.plot?.chart;
    if (!chart || chart.data.datasets.length < 2) {
      this.buildChart();
      return;
    }
    // In-place update preserves the user's zoom/pan range across live WebSocket frames.
    chart.data.datasets[0].data = this.samples.map((s) => ({
      x: s.timestamp,
      y: s.pressure,
    }));
    chart.data.datasets[1].data = this.samples.map((s) => ({
      x: s.timestamp,
      y: s.flow,
    }));
    chart.update("none");
  }

  private buildChart(): void {
    const light = this.theme.theme() === "light";
    const muted = light ? "#66808d" : "#8aa4af";
    const grid = light ? "rgba(45,92,111,.13)" : "rgba(125,169,189,.11)";
    const pressure = light ? "#0b99bb" : "#27d7f4";
    const flow = light ? "#258e6d" : "#6de0ab";
    const series = this.samples;
    this.chartData = {
      datasets: [
        {
          label: this.i18n.t("chart.pressure"),
          data: series.map((s) => ({ x: s.timestamp, y: s.pressure })),
          yAxisID: "pressure",
          borderColor: pressure,
          backgroundColor: "rgba(46,214,244,.08)",
          pointBackgroundColor: pressure,
          pointBorderColor: light ? "#fff" : "#0a1821",
          pointBorderWidth: 1.1,
          pointRadius: series.length > 180 ? 1.8 : 2.9,
          pointHoverRadius: 6,
          pointHitRadius: 15,
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          normalized: true,
        },
        {
          label: this.i18n.t("chart.flow"),
          data: series.map((s) => ({ x: s.timestamp, y: s.flow })),
          yAxisID: "flow",
          borderColor: flow,
          backgroundColor: "rgba(109,224,171,.05)",
          pointBackgroundColor: flow,
          pointBorderColor: light ? "#fff" : "#0a1821",
          pointBorderWidth: 1.1,
          pointRadius: series.length > 180 ? 1.8 : 2.9,
          pointHoverRadius: 6,
          pointHitRadius: 15,
          borderWidth: 2,
          tension: 0.3,
          fill: false,
          normalized: true,
        },
      ],
    };

    const locale = this.i18n.isRtl() ? "fa-IR" : "en-US";
    const chartFont = this.i18n.isRtl()
      ? "Vazir, Tahoma, sans-serif"
      : "Inter, system-ui, sans-serif";
    const dateFormat = new Intl.DateTimeFormat(locale, {
      month:
        this.range() === "7d" || this.range() === "30d" ? "short" : undefined,
      day:
        this.range() === "7d" || this.range() === "30d" ? "numeric" : undefined,
      hour:
        this.range() === "7d" || this.range() === "30d" ? undefined : "2-digit",
      minute:
        this.range() === "7d" || this.range() === "30d" ? undefined : "2-digit",
    });

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      animation: false,
      layout: { padding: { top: 10, right: 6, bottom: 0, left: 0 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: light ? "#fff" : "#112633",
          titleColor: light ? "#18313b" : "#eafaff",
          bodyColor: light ? "#18313b" : "#eafaff",
          borderColor: grid,
          borderWidth: 1,
          titleFont: { size: 11, family: chartFont },
          bodyFont: { size: 11, family: chartFont },
          padding: 11,
          displayColors: true,
          callbacks: {
            title: (items) =>
              items.length
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  }).format(Number(items[0].parsed.x))
                : "",
            label: (item) =>
              `${item.dataset.label}: ${Number(item.parsed.y).toFixed(item.datasetIndex === 0 ? 2 : 1)} ${item.datasetIndex === 0 ? "bar" : "L/min"}`,
          },
        },
        zoom: {
          limits: { x: { minRange: this.rangeStep(this.range()) * 3 } },
          pan: { enabled: true, mode: "x", modifierKey: "shift" },
          zoom: {
            wheel: { enabled: true, speed: 0.08 },
            pinch: { enabled: true },
            drag: {
              enabled: true,
              borderWidth: 1,
              borderColor: pressure,
              backgroundColor: "rgba(46,214,244,.1)",
            },
            mode: "x",
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          grid: { color: grid, drawTicks: false },
          border: { display: false },
          ticks: {
            color: muted,
            padding: 10,
            maxTicksLimit: 6,
            maxRotation: 0,
            font: { family: chartFont },
            callback: (value) => dateFormat.format(Number(value)),
          },
        },
        pressure: {
          type: "linear",
          position: "left",
          min: 0,
          max: 7,
          grid: { color: grid },
          border: { display: false },
          title: {
            display: true,
            text: "bar",
            color: pressure,
            font: { size: 10, family: chartFont },
          },
          ticks: {
            color: muted,
            maxTicksLimit: 5,
            padding: 7,
            font: { family: chartFont },
          },
        },
        flow: {
          type: "linear",
          position: "right",
          min: 0,
          max: 40,
          grid: { drawOnChartArea: false },
          border: { display: false },
          title: {
            display: true,
            text: "L/min",
            color: flow,
            font: { size: 10, family: chartFont },
          },
          ticks: {
            color: muted,
            maxTicksLimit: 5,
            padding: 7,
            font: { family: chartFont },
          },
        },
      },
    };
  }

  private rangeDuration(value: HistoryRange): number {
    return {
      live: 5 * 60_000,
      "1h": 60 * 60_000,
      "24h": 86_400_000,
      "7d": 604_800_000,
      "30d": 2_592_000_000,
    }[value];
  }
  private rangeStep(value: HistoryRange): number {
    return {
      live: 5_000,
      "1h": 30_000,
      "24h": 600_000,
      "7d": 3_600_000,
      "30d": 14_400_000,
    }[value];
  }
}
