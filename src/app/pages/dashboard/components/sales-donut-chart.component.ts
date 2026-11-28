import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const FR_NUMBER_FORMAT = new Intl.NumberFormat('fr-FR');

@Component({
  selector: 'app-sales-donut-chart',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; height: 100%; }
    .donut-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      height: 100%;
    }
    .donut-ring {
      position: relative;
      width: 128px;
      height: 128px;
      flex-shrink: 0;
    }
    .donut-ring svg {
      width: 128px;
      height: 128px;
      display: block;
    }
    .donut-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      pointer-events: none;
    }
    .donut-pct {
      font-size: 22px;
      font-weight: 800;
      color: var(--gw-text);
      line-height: 1.05;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .donut-sub {
      font-size: 11.5px;
      font-weight: 600;
      color: var(--gw-text-secondary);
      margin-top: 2px;
    }
    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    .donut-leg-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .donut-leg-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-top: 4px;
      flex-shrink: 0;
    }
    .donut-leg-dot.is-15 {
      border-radius: 2px;
    }
    .donut-leg-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--gw-text);
      line-height: 1.2;
      white-space: nowrap;
    }
    .donut-leg-val {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--gw-text-secondary);
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .donut-leg-amount {
      font-size: 11.5px;
      font-weight: 500;
      color: var(--gw-muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
  `],
  template: `
    <div class="donut-wrap">
      <div class="donut-ring">
        <svg viewBox="0 0 140 140" width="128" height="128" role="img" [attr.aria-label]="ariaSummary()">
          <!-- Background Track -->
          <circle cx="70" cy="70" [attr.r]="radius" fill="none" stroke="#e9f2fc" [attr.stroke-width]="strokeW"/>

          <!-- 1,5 L Arc (Deep Teal) -->
          @if (arc15() > 0) {
            <circle
              cx="70" cy="70" [attr.r]="radius"
              fill="none"
              stroke="#0d9488"
              [attr.stroke-width]="strokeW"
              [attr.stroke-dasharray]="arc15() + ' ' + circumference"
              [attr.stroke-dashoffset]="-offset15()"
              transform="rotate(-90 70 70)"/>
          }

          <!-- 0,5 L Arc (Royal Blue) -->
          @if (arc05() > 0) {
            <circle
              cx="70" cy="70" [attr.r]="radius"
              fill="none"
              stroke="#0066e6"
              [attr.stroke-width]="strokeW"
              [attr.stroke-dasharray]="arc05() + ' ' + circumference"
              stroke-dashoffset="0"
              transform="rotate(-90 70 70)"/>
          }
        </svg>

        <div class="donut-center">
          <div class="donut-pct">{{ primaryPct() }}%</div>
          <div class="donut-sub">{{ primaryLabel() }}</div>
        </div>
      </div>

      <div class="donut-legend">
        <div class="donut-leg-item">
          <span class="donut-leg-dot" style="background:#0066e6" aria-hidden="true"></span>
          <div>
            <div class="donut-leg-name">0,5 L</div>
            <div class="donut-leg-val">{{ displayPct05() }}%</div>
            @if (total05L() > 0) {
              <div class="donut-leg-amount">{{ formatFCFA(total05L()) }}</div>
            }
          </div>
        </div>

        <div class="donut-leg-item">
          <span class="donut-leg-dot is-15" style="background:#0d9488" aria-hidden="true"></span>
          <div>
            <div class="donut-leg-name">1,5 L</div>
            <div class="donut-leg-val">{{ displayPct15() }}%</div>
            @if (total15L() > 0) {
              <div class="donut-leg-amount">{{ formatFCFA(total15L()) }}</div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class SalesDonutChartComponent {
  readonly pct05L = input.required<number>();
  readonly pct15L = input.required<number>();
  readonly hasData = input<boolean>(true);
  readonly total05L = input<number>(0);
  readonly total15L = input<number>(0);

  readonly radius = 52;
  readonly strokeW = 24;
  readonly circumference = 2 * Math.PI * this.radius;

  readonly displayPct05 = computed(() => Math.round(Math.max(0, Math.min(100, this.pct05L()))));
  readonly displayPct15 = computed(() => Math.round(Math.max(0, Math.min(100, this.pct15L()))));

  readonly ariaSummary = computed(() =>
    this.hasData()
      ? `Répartition des ventes : 0,5 L ${this.displayPct05()} % et 1,5 L ${this.displayPct15()} %`
      : 'Aucune vente enregistrée pour calculer la répartition'
  );

  readonly primaryPct = computed(() => {
    if (!this.hasData()) return 0;
    return this.displayPct05() >= this.displayPct15() ? this.displayPct05() : this.displayPct15();
  });

  readonly primaryLabel = computed(() => {
    if (!this.hasData()) return 'Aucune vente';
    return this.displayPct05() >= this.displayPct15() ? '0,5 L' : '1,5 L';
  });

  readonly arc05 = computed(() => {
    if (!this.hasData()) return 0;
    const raw = (this.displayPct05() / 100) * this.circumference;
    return this.displayPct05() > 0 && this.displayPct15() > 0 ? Math.max(0, raw - 2.5) : raw;
  });

  readonly offset15 = computed(() => {
    if (!this.hasData()) return 0;
    return (this.displayPct05() / 100) * this.circumference + (this.displayPct05() > 0 && this.displayPct15() > 0 ? 1.25 : 0);
  });

  readonly arc15 = computed(() => {
    if (!this.hasData()) return 0;
    const raw = (this.displayPct15() / 100) * this.circumference;
    return this.displayPct05() > 0 && this.displayPct15() > 0 ? Math.max(0, raw - 2.5) : raw;
  });

  formatFCFA(n: number): string {
    return `${FR_NUMBER_FORMAT.format(Math.round(Number.isFinite(n) ? n : 0))} FCFA`;
  }
}
