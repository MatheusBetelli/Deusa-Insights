import { DecimalPipe, NgClass } from "@angular/common";
import { Component, Input } from "@angular/core";

@Component({
  selector: "app-dashboard-metric-card",
  standalone: true,
  imports: [DecimalPipe, NgClass],
  template: `
    <article class="metric-card">
      <div>
        <strong>{{ value | number: "1.0-0" }}</strong>
        <span>{{ label }}</span>
      </div>
      <div class="marker" [ngClass]="{ alert: alert }">{{ marker }}</div>
    </article>
  `,
  styles: `
    .metric-card {
      display: flex;
      min-height: 116px;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: white;
      padding: 20px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }

    strong {
      display: block;
      color: #0b1f33;
      font-size: 34px;
      line-height: 1;
    }

    span {
      display: block;
      margin-top: 10px;
      color: #0b1f33;
      font-size: 14px;
      font-weight: 800;
    }

    .marker {
      display: grid;
      height: 42px;
      width: 42px;
      place-items: center;
      border-radius: 12px;
      background: rgba(16, 97, 175, 0.1);
      color: #1061af;
      font-weight: 900;
    }

    .marker.alert {
      background: rgba(237, 28, 36, 0.1);
      color: #ed1c24;
    }
  `,
})
export class DashboardMetricCardComponent {
  @Input({ required: true }) label = "";
  @Input({ required: true }) value = 0;
  @Input({ required: true }) marker = "";
  @Input() alert = false;
}
