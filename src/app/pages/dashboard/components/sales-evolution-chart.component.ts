import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export type EvolutionPeriod = '7d' | '30d';

interface ChartPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

const FR_NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');
let nextChartInstanceId = 0;

@Component({
  selector: 'app-sales-evolution-chart',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; height: 100%; }
    .evo-card {
      background: #ffffff;
      border-radius: 18px;
      padding: 18px 22px 16px;
      box-shadow: var(--gw-shadow);
      border: 1px solid rgba(226, 237, 249, 0.9);
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .evo-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 6px;
      flex-wrap: wrap;
    }
    .evo-title-group {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .evo-title-icon {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: #e8f3ff;
      color: #0066e6;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .evo-title {
      margin: 0;
      font-size: 15.5px;
      font-weight: 700;
      color: var(--gw-text);
      letter-spacing: -0.01em;
    }
    .evo-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .evo-select {
      appearance: none;
      background-color: #f6faff;
      border: 1px solid #d9e7f6;
      border-radius: 9px;
      padding: 6px 28px 6px 11px;
      font-family: inherit;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--gw-text-secondary);
      cursor: pointer;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23475d79' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 9px center;
      transition: border-color 0.15s;
    }
    .evo-select:hover {
      border-color: var(--gw-ocean-500);
    }
    .evo-select:focus-visible {
      border-color: var(--gw-ocean-500);
      outline: 2px solid var(--gw-ocean-500);
      outline-offset: 2px;
    }
    .evo-legend {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 16px;
      margin-bottom: 6px;
      font-size: 12px;
      font-weight: 600;
      color: var(--gw-text-secondary);
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .legend-swatch-05 {
      width: 14px;
      height: 3px;
      border-radius: 999px;
      background: #0066e6;
    }
    .legend-swatch-15 {
      width: 14px;
      height: 0;
      border-top: 3px dashed #0d9488;
    }
    .evo-canvas {
      position: relative;
      flex: 1;
      min-height: 205px;
      width: 100%;
    }
    .evo-svg {
      width: 100%;
      height: 100%;
      display: block;
      overflow: visible;
    }
    .grid-line {
      stroke: #ecf2f9;
      stroke-width: 1;
    }
    .axis-label {
      fill: #52667d;
      font-size: 11px;
      font-weight: 500;
      font-family: inherit;
    }
    .data-dot {
      pointer-events: none;
      transition: r 0.12s ease;
    }
    .hit-col {
      fill: transparent;
      cursor: pointer;
    }
    .hit-col:focus-visible {
      outline: 2px solid var(--gw-ocean-500);
      outline-offset: -2px;
    }
    .evo-tooltip {
      position: absolute;
      top: 6px;
      transform: translateX(-50%);
      background: rgba(8, 32, 74, 0.95);
      color: #ffffff;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 11.5px;
      pointer-events: none;
      box-shadow: 0 8px 20px rgba(5, 22, 53, 0.25);
      display: flex;
      flex-direction: column;
      gap: 3px;
      z-index: 5;
      white-space: nowrap;
    }
    .evo-tooltip-day {
      font-weight: 700;
      color: #93c5fd;
      margin-bottom: 1px;
    }
    .evo-empty {
      position: absolute;
      inset: 14px 18px 26px 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .evo-empty-pill {
      background: rgba(241, 247, 254, 0.94);
      border: 1px solid #d5e5f6;
      color: var(--gw-text-secondary);
      border-radius: 999px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 600;
    }
  `],
  template: `
    <div class="evo-card">
      <div class="evo-header">
        <div class="evo-title-group">
          <span class="evo-title-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </span>
          <h2 class="evo-title">Évolution des Ventes</h2>
        </div>

        <div class="evo-controls">
          <label class="sr-only" for="dashboard-evo-period">Période d'analyse</label>
          <select id="dashboard-evo-period" name="evoPeriod" class="evo-select" [value]="period()" (change)="onPeriodSelect($event)">
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>
        </div>
      </div>

      <div class="evo-legend">
        <span class="legend-item">
          <span class="legend-swatch-05" aria-hidden="true"></span>
          <span>0,5 L</span>
        </span>
        <span class="legend-item">
          <span class="legend-swatch-15" aria-hidden="true"></span>
          <span>1,5 L</span>
        </span>
      </div>

      <div class="evo-canvas" (mouseleave)="hoveredIndex.set(null)">
        @if (hoveredIndex() !== null) {
          @let idx = hoveredIndex()!;
          <div class="evo-tooltip tabular-nums" [style.left.%]="tooltipLeftPct()">
            <div class="evo-tooltip-day">{{ labels()[idx] }}</div>
            <div>0,5 L : <strong>{{ formatFCFA(series05L()[idx] || 0) }}</strong></div>
            <div>1,5 L : <strong>{{ formatFCFA(series15L()[idx] || 0) }}</strong></div>
          </div>
        }

        @if (!hasData()) {
          <div class="evo-empty">
            <span class="evo-empty-pill">Aucune vente enregistrée sur cette période</span>
          </div>
        }

        <svg class="evo-svg" [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" aria-label="Graphique d'évolution des ventes 0,5 L et 1,5 L">
          <defs>
            <linearGradient [attr.id]="grad05Id" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0066e6" stop-opacity="0.22"/>
              <stop offset="100%" stop-color="#0066e6" stop-opacity="0.01"/>
            </linearGradient>
            <linearGradient [attr.id]="grad15Id" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0d9488" stop-opacity="0.18"/>
              <stop offset="100%" stop-color="#0d9488" stop-opacity="0.01"/>
            </linearGradient>
          </defs>

          <!-- Horizontal gridlines & Y ticks -->
          @for (tick of yTicks(); track $index) {
            <line class="grid-line" [attr.x1]="padLeft" [attr.y1]="tick.y" [attr.x2]="width - padRight" [attr.y2]="tick.y"/>
            <text class="axis-label" [attr.x]="padLeft - 10" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.label }}</text>
          }

          <!-- Vertical subtle guides + X ticks -->
          @for (pt of points05L(); track $index) {
            <line class="grid-line" [attr.x1]="pt.x" [attr.y1]="padTop" [attr.x2]="pt.x" [attr.y2]="plotBottom" stroke-opacity="0.55"/>
            <text class="axis-label" [attr.x]="pt.x" [attr.y]="height - 6" text-anchor="middle">{{ pt.label }}</text>
          }

          <!-- Area fills -->
          @if (area15L()) {
            <path [attr.d]="area15L()" [attr.fill]="'url(#' + grad15Id + ')'"/>
          }
          @if (area05L()) {
            <path [attr.d]="area05L()" [attr.fill]="'url(#' + grad05Id + ')'"/>
          }

          <!-- Smooth spline strokes (solid for 0,5 L, dashed for 1,5 L) -->
          @if (path15L()) {
            <path [attr.d]="path15L()" fill="none" stroke="#0d9488" stroke-width="2.5" stroke-dasharray="5 3" stroke-linecap="round" stroke-linejoin="round"/>
          }
          @if (path05L()) {
            <path [attr.d]="path05L()" fill="none" stroke="#0066e6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
          }

          <!-- Hover highlight line -->
          @if (hoveredIndex() !== null && points05L()[hoveredIndex()!]) {
            <line
              [attr.x1]="points05L()[hoveredIndex()!].x"
              [attr.y1]="padTop"
              [attr.x2]="points05L()[hoveredIndex()!].x"
              [attr.y2]="plotBottom"
              stroke="#0066e6"
              stroke-width="1"
              stroke-dasharray="3 3"
              stroke-opacity="0.55"/>
          }

          <!-- Data markers 1,5 L (squares for shape differentiation) -->
          @for (pt of points15L(); track $index) {
            @let size = hoveredIndex() === $index ? 9 : 7;
            <rect
              class="data-dot"
              [attr.x]="pt.x - size / 2"
              [attr.y]="pt.y - size / 2"
              [attr.width]="size"
              [attr.height]="size"
              rx="1.5"
              fill="#0d9488"
              stroke="#ffffff"
              stroke-width="2"/>
          }

          <!-- Data markers 0,5 L (circles) -->
          @for (pt of points05L(); track $index) {
            <circle
              class="data-dot"
              [attr.cx]="pt.x"
              [attr.cy]="pt.y"
              [attr.r]="hoveredIndex() === $index ? 5.5 : 4"
              fill="#0066e6"
              stroke="#ffffff"
              stroke-width="2"/>
          }

          <!-- Accessible full-height hit columns -->
          @for (pt of points05L(); track $index) {
            <rect
              class="hit-col"
              [attr.x]="pt.x - hitColWidth() / 2"
              [attr.y]="padTop"
              [attr.width]="hitColWidth()"
              [attr.height]="plotHeight"
              tabindex="0"
              role="button"
              [attr.aria-label]="pointAriaLabel($index)"
              (mouseenter)="hoveredIndex.set($index)"
              (focus)="hoveredIndex.set($index)"
              (blur)="hoveredIndex.set(null)"/>
          }
        </svg>
      </div>
    </div>
  `
})
export class SalesEvolutionChartComponent {
  readonly labels = input.required<string[]>();
  readonly series05L = input.required<number[]>();
  readonly series15L = input.required<number[]>();
  readonly period = input<EvolutionPeriod>('7d');
  readonly periodChange = output<EvolutionPeriod>();

  readonly hoveredIndex = signal<number | null>(null);

  private readonly instanceId = ++nextChartInstanceId;
  readonly grad05Id = `gwGrad05_${this.instanceId}`;
  readonly grad15Id = `gwGrad15_${this.instanceId}`;

  readonly width = 620;
  readonly height = 215;
  readonly padLeft = 48;
  readonly padRight = 18;
  readonly padTop = 14;
  readonly padBottom = 26;
  readonly plotBottom = this.height - this.padBottom;
  readonly plotHeight = this.height - this.padTop - this.padBottom;
  readonly plotWidth = this.width - this.padLeft - this.padRight;

  readonly hasData = computed(() =>
    this.series05L().some(v => Number.isFinite(v) && v > 0) ||
    this.series15L().some(v => Number.isFinite(v) && v > 0)
  );

  readonly hitColWidth = computed(() => {
    const count = Math.max(1, this.labels().length);
    return Math.max(24, this.plotWidth / count);
  });

  readonly tooltipLeftPct = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null) return 50;
    const pt = this.points05L()[idx];
    if (!pt) return 50;
    const rawPct = (pt.x / this.width) * 100;
    return Math.max(18, Math.min(82, rawPct));
  });

  readonly maxScale = computed(() => {
    const clean05 = this.series05L().map(v => (Number.isFinite(v) ? Math.max(0, v) : 0));
    const clean15 = this.series15L().map(v => (Number.isFinite(v) ? Math.max(0, v) : 0));
    const rawMax = Math.max(0, ...clean05, ...clean15);
    if (rawMax <= 0) return 1_000_000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const step = magnitude / 2;
    return Math.max(4000, Math.ceil(rawMax / step) * step);
  });

  readonly yTicks = computed(() => {
    const max = this.maxScale();
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const ratio = i / steps;
      const val = max * (1 - ratio);
      const y = this.padTop + ratio * this.plotHeight;
      return { y, label: this.formatShort(val) };
    });
  });

  readonly points05L = computed(() => this.buildPoints(this.series05L()));
  readonly points15L = computed(() => this.buildPoints(this.series15L()));

  readonly path05L = computed(() => this.buildSmoothPath(this.points05L()));
  readonly path15L = computed(() => this.buildSmoothPath(this.points15L()));

  readonly area05L = computed(() => this.buildAreaPath(this.points05L(), this.path05L()));
  readonly area15L = computed(() => this.buildAreaPath(this.points15L(), this.path15L()));

  onPeriodSelect(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as EvolutionPeriod;
    this.periodChange.emit(val);
  }

  pointAriaLabel(idx: number): string {
    const label = this.labels()[idx] || '';
    const v05 = this.formatFCFA(this.series05L()[idx] || 0);
    const v15 = this.formatFCFA(this.series15L()[idx] || 0);
    return `${label} : 0,5 L ${v05}, 1,5 L ${v15}`;
  }

  formatFCFA(n: number): string {
    return `${FR_NUMBER_FORMAT.format(Math.round(Number.isFinite(n) ? n : 0))} FCFA`;
  }

  private formatShort(val: number): string {
    if (val <= 0) return '0';
    if (val >= 1_000_000) {
      const m = val / 1_000_000;
      const s = Number.isInteger(m) ? String(m) : m.toFixed(1).replace('.', ',');
      return `${s} M`;
    }
    if (val >= 1_000) {
      const k = val / 1_000;
      return `${Number.isInteger(k) ? k : Math.round(k)} k`;
    }
    return String(Math.round(val));
  }

  private buildPoints(values: number[]): ChartPoint[] {
    const lbls = this.labels();
    const max = this.maxScale();
    const count = Math.max(1, lbls.length);
    return lbls.map((label, i) => {
      const raw = values[i] ?? 0;
      const value = Number.isFinite(raw) ? Math.max(0, raw) : 0;
      const x = count === 1
        ? this.padLeft + this.plotWidth / 2
        : this.padLeft + (i / (count - 1)) * this.plotWidth;
      const ratio = Math.min(1, Math.max(0, value / max));
      const y = this.plotBottom - ratio * this.plotHeight;
      return { x, y, value, label };
    });
  }

  private buildSmoothPath(pts: ChartPoint[]): string {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = Math.min(this.plotBottom, Math.max(this.padTop, p1.y + (p2.y - p0.y) / 6));
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = Math.min(this.plotBottom, Math.max(this.padTop, p2.y - (p3.y - p1.y) / 6));
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  private buildAreaPath(pts: ChartPoint[], linePath: string): string {
    if (pts.length < 2 || !linePath) return '';
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${linePath} L ${last.x.toFixed(1)} ${this.plotBottom} L ${first.x.toFixed(1)} ${this.plotBottom} Z`;
  }
}
