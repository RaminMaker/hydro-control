import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
} from "@angular/core";
import * as d3 from "d3";
import { LanguageService } from "../../../../core/i18n/language.service";
import { ThemeService } from "../../../../core/theme/theme.service";

@Component({
  selector: "app-pressure-gauge",
  standalone: true,
  templateUrl: "./pressure-gauge.component.html",
  styleUrl: "./pressure-gauge.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PressureGaugeComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) value = 0;
  @Input() target = 3.4;
  @ViewChild("svg", { static: true })
  private svgRef!: ElementRef<SVGSVGElement>;

  readonly i18n = inject(LanguageService);
  private readonly theme = inject(ThemeService);
  private static idCounter = 0;
  readonly uid = PressureGaugeComponent.idCounter++;
  private ready = false;

  constructor() {
    effect(() => {
      this.i18n.language();
      this.theme.theme();
      if (this.ready) this.render();
    });
  }

  ngAfterViewInit(): void {
    this.ready = true;
    this.render();
  }
  ngOnChanges(_changes: SimpleChanges): void {
    if (this.ready) this.render();
  }

  private render(): void {
    const width = 360,
      height = 244,
      cx = 180,
      cy = 138,
      max = 8;
    const start = -Math.PI * 0.75,
      end = Math.PI * 0.75;
    const actual = Number.isFinite(this.value)
      ? Math.max(0, Math.min(max, this.value))
      : 0;
    const target = Number.isFinite(this.target)
      ? Math.max(0, Math.min(max, this.target))
      : 0;
    const angle = d3.scaleLinear().domain([0, max]).range([start, end]);
    const light = this.theme.theme() === "light";
    const label = light ? "#57727e" : "#90a8b5";
    const tick = light ? "#66808a" : "#688291";
    const bright = light ? "#18323e" : "#f0fbff";
    const track = light ? "#d8e6eb" : "#1a2b36";
    const font = this.i18n.isRtl()
      ? "Vazir, Tahoma, sans-serif"
      : "Inter, system-ui, sans-serif";
    const svg = d3
      .select(this.svgRef.nativeElement)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
    svg.selectAll("*").remove();

    const gradientId = `gauge-gradient-${this.uid}`;
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%")
      .attr("x2", "100%");
    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", light ? "#079fc0" : "#2ed6f4");
    gradient
      .append("stop")
      .attr("offset", "72%")
      .attr("stop-color", light ? "#2ba979" : "#69e3b1");
    gradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", light ? "#bf862b" : "#f4c86a");

    const g = svg
      .append("g")
      .attr("transform", `translate(${cx},${cy})`)
      .attr("font-family", font);
    const arc = d3
      .arc<unknown>()
      .innerRadius(88)
      .outerRadius(98)
      .cornerRadius(4)
      .startAngle(start);
    g.append("path")
      .attr("d", arc({ endAngle: end } as never))
      .attr("fill", track);
    g.append("path")
      .attr("d", arc({ endAngle: angle(actual) } as never))
      .attr("fill", `url(#${gradientId})`);
    const xy = (r: number, radians: number) => ({
      x: Math.sin(radians) * r,
      y: -Math.cos(radians) * r,
    });
    for (const value of d3.range(0, max + 0.001, 1)) {
      const radians = angle(value),
        a = xy(76, radians),
        b = xy(83, radians),
        t = xy(63, radians);
      g.append("line")
        .attr("x1", a.x)
        .attr("y1", a.y)
        .attr("x2", b.x)
        .attr("y2", b.y)
        .attr("stroke", tick)
        .attr("stroke-width", 1.5)
        .attr("stroke-linecap", "round");
      g.append("text")
        .attr("x", t.x)
        .attr("y", t.y + 3.5)
        .attr("text-anchor", "middle")
        .attr("font-size", 11)
        .attr("fill", label)
        .text(value);
    }
    const markerA = xy(101, angle(target)),
      markerB = xy(112, angle(target));
    g.append("line")
      .attr("x1", markerA.x)
      .attr("y1", markerA.y)
      .attr("x2", markerB.x)
      .attr("y2", markerB.y)
      .attr("stroke", light ? "#b77920" : "#f4c86a")
      .attr("stroke-width", 4)
      .attr("stroke-linecap", "round");
    g.append("text")
      .attr("x", 0)
      .attr("y", -22)
      .attr("text-anchor", "middle")
      .attr("fill", label)
      .attr("font-size", 11)
      .text(this.i18n.t("gauge.dischargePressure"));
    g.append("text")
      .attr("x", 0)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("direction", "ltr")
      .attr("fill", bright)
      .attr("font-size", 34)
      .attr("font-weight", 800)
      .text(actual.toFixed(2));
    g.append("text")
      .attr("x", 0)
      .attr("y", 41)
      .attr("text-anchor", "middle")
      .attr("direction", "ltr")
      .attr("fill", label)
      .attr("font-size", 11)
      .text("bar");

    g.append("rect")
      .attr("x", -66)
      .attr("y", 56)
      .attr("width", 132)
      .attr("height", 40)
      .attr("rx", 9)
      .attr("fill", light ? "#ecf3f6" : "#10232f")
      .attr("stroke", light ? "#cbdfe7" : "#25404f");
    g.append("text")
      .attr("x", 0)
      .attr("y", 72)
      .attr("text-anchor", "middle")
      .attr("fill", label)
      .attr("font-size", 10)
      .text(this.i18n.t("gauge.setpoint"));
    g.append("text")
      .attr("x", 0)
      .attr("y", 88)
      .attr("text-anchor", "middle")
      .attr("direction", "ltr")
      .attr("fill", bright)
      .attr("font-size", 12)
      .attr("font-weight", "700")
      .text(`${target.toFixed(1)} bar`);
  }
}
