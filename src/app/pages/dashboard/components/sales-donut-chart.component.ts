import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sales-donut-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; height: 100%; }
    .donut-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
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
      font-size: 23px;
      font-weight: 800;
      color: var(--gw-text);
      line-height: 1.05;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
    }
    .donut-sub {
      font-size: 12px;
      font-weight: 600;
      color: var(--gw-text-secondary);
      margin-top: 2px;
    }
    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 14px;
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
  `],
  template: `
    <div class="donut-wrap">
      <div class="donut-ring">
        <svg viewBox="0 0 140 140" width="142" height="142" role="img" [attr.aria-label]="'Répartition 0,5 L ' + displayPct05() + '% et 1,5 L ' + displayPct15() + '%'">
          <!-- Background Track -->
          <circle cx="70" cy="70" [attr.r]="radius" fill="none" stroke="#e9f2fc" [attr.stroke-width]="strokeW"/>

          <!-- 1,5 L Arc (Cyan) -->
          @if (arc15() > 0) {
            <circle
              cx="70" cy="70" [attr.r]="radius"
              fill="none"
              stroke="#17c3eb"
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
              stroke="#0b74f5"
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
          <span class="donut-leg-dot" style="background:#0b74f5"></span>
          <div>
            <div class="donut-leg-name">0,5 L</div>
            <div class="donut-leg-val">{{ displayPct05() }}%</div>
          </div>
        </div>

        <div class="donut-leg-item">
          <span class="donut-leg-dot" style="background:#17c3eb"></span>
          <div>
            <div class="donut-leg-name">1,5 L</div>
            <div class="donut-leg-val">{{ displayPct15() }}%</div>
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

  readonly radius = 52;
  readonly strokeW = 24;
  readonly circumference = 2 * Math.PI * this.radius;

  readonly displayPct05 = computed(() => Math.round(Math.max(0, Math.min(100, this.pct05L()))));
  readonly displayPct15 = computed(() => Math.round(Math.max(0, Math.min(100, this.pct15L()))));

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
}
