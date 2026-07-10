import { NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { DashboardSummary } from "../../core/models/dashboard.model";
import { DashboardApiService } from "../../core/services/dashboard-api.service";
import { DashboardMetricCardComponent } from "./dashboard-metric-card.component";

type MetricCard = {
  label: string;
  value: number;
  marker: string;
  alert?: boolean;
};

const recommendedActions = [
  "Importar CNPJs ativos da cidade foco.",
  "Distribuir leads criticos para o responsavel comercial.",
  "Registrar contato nos leads sem interacao recente.",
];

@Component({
  selector: "app-dashboard-page",
  standalone: true,
  imports: [DashboardMetricCardComponent, NgFor, NgIf, RouterLink],
  template: `
    <section class="page-header">
      <div>
        <h1>Central Comercial</h1>
        <p class="subtitle">Visao rapida das principais oportunidades de expansao B2B</p>
      </div>
      <div class="actions">
        <span class="primary disabled-action" aria-disabled="true" title="Importacao ainda nao migrada">
          Importar novos CNPJs
        </span>
        <a routerLink="/app/leads" class="secondary">Ver leads</a>
      </div>
    </section>

    <section *ngIf="loading" class="metric-grid" aria-label="Carregando dashboard">
      <div class="skeleton" *ngFor="let item of skeletonCards"></div>
    </section>

    <section *ngIf="error && !loading" class="state state-error">
      <strong>Nao foi possivel carregar a Central Comercial.</strong>
      <span>{{ error }}</span>
      <button type="button" (click)="loadSummary()">Tentar novamente</button>
    </section>

    <section *ngIf="!loading && !error && !summary" class="state">
      <strong>Sem dados de dashboard.</strong>
      <span>O endpoint respondeu sem payload para exibir.</span>
    </section>

    <ng-container *ngIf="!loading && !error && summary">
      <section class="metric-grid" aria-label="Indicadores principais">
        <app-dashboard-metric-card
          *ngFor="let card of metricCards"
          [label]="card.label"
          [value]="card.value"
          [marker]="card.marker"
          [alert]="card.alert || false"
        />
      </section>

      <section class="dashboard-grid">
        <article class="priority-card">
          <header>
            <div>
              <p>Prioridade da semana</p>
              <h2>{{ summary.priorityCity || "Sem prioridade definida" }}</h2>
            </div>
            <span class="critical">Critico</span>
          </header>

          <div class="priority-details">
            <div>
              <small>Cidade foco</small>
              <strong>{{ summary.priorityCity || "-" }}</strong>
            </div>
            <div>
              <small>CNAE foco</small>
              <strong>{{ summary.priorityCnae || "-" }}</strong>
            </div>
            <div>
              <small>Oportunidades</small>
              <strong>{{ summary.criticalOpportunities }}</strong>
            </div>
            <div>
              <small>Proxima acao</small>
              <strong>Importar CNPJs e acionar leads criticos.</strong>
            </div>
          </div>
        </article>

        <article class="recommended-card">
          <h2>Acoes recomendadas</h2>
          <div class="recommended-list">
            <div *ngFor="let action of recommendedActions; let index = index">
              <span>{{ index + 1 }}</span>
              <p>{{ action }}</p>
            </div>
          </div>
        </article>
      </section>
    </ng-container>
  `,
  styles: `
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 22px;
    }

    .priority-card p {
      margin: 0 0 8px;
      color: #1061af;
      font-size: 12px;
      font-weight: 900;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      max-width: 760px;
      margin: 0;
      color: #0b1f33;
      font-size: 26px;
      line-height: 1.25;
    }

    .subtitle {
      margin: 8px 0 0;
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .actions a,
    .disabled-action,
    .state button {
      display: inline-flex;
      height: 40px;
      align-items: center;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 900;
      padding: 0 14px;
    }

    .primary,
    .state button {
      border: 0;
      background: #0b1f33;
      color: white;
      cursor: pointer;
    }

    .disabled-action {
      cursor: not-allowed;
      opacity: 0.76;
    }

    .secondary {
      border: 1px solid #dde5ef;
      background: white;
      color: #0b1f33;
    }

    .metric-grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .skeleton {
      height: 116px;
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7);
      background-size: 200% 100%;
      animation: pulse 1.5s infinite;
    }

    .state {
      display: grid;
      gap: 10px;
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: white;
      padding: 22px;
    }

    .state-error {
      border-color: #fca5a5;
      background: #fef2f2;
      color: #7f1d1d;
    }

    .dashboard-grid {
      display: grid;
      gap: 20px;
      grid-template-columns: minmax(0, 1.15fr) minmax(300px, 0.85fr);
      margin-top: 24px;
    }

    .priority-card,
    .recommended-card {
      overflow: hidden;
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: white;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }

    .priority-card header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid #dde5ef;
      padding: 22px;
    }

    h2 {
      margin: 0;
      color: #0b1f33;
      font-size: 22px;
    }

    .critical {
      height: fit-content;
      border-radius: 8px;
      background: #ed1c24;
      color: white;
      font-size: 12px;
      font-weight: 900;
      padding: 7px 10px;
    }

    .priority-details {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .priority-details div {
      min-height: 100px;
      border-right: 1px solid #dde5ef;
      padding: 18px;
    }

    .priority-details div:last-child {
      border-right: 0;
    }

    small {
      display: block;
      color: #64748b;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .priority-details strong {
      display: block;
      margin-top: 9px;
      color: #0b1f33;
      font-size: 15px;
      line-height: 1.35;
    }

    .recommended-card {
      padding: 20px;
    }

    .recommended-list {
      display: grid;
      gap: 12px;
      margin-top: 16px;
    }

    .recommended-list div {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      border-radius: 12px;
      background: #f8fafc;
      padding: 12px;
    }

    .recommended-list span {
      display: grid;
      height: 28px;
      width: 28px;
      flex: 0 0 auto;
      place-items: center;
      border: 1px solid #dde5ef;
      border-radius: 8px;
      background: white;
      font-size: 12px;
      font-weight: 900;
    }

    .recommended-list p {
      margin: 0;
      color: #0b1f33;
      font-size: 14px;
      font-weight: 800;
      line-height: 1.55;
    }

    @keyframes pulse {
      from {
        background-position: 200% 0;
      }

      to {
        background-position: -200% 0;
      }
    }

    @media (max-width: 1100px) {
      .metric-grid,
      .priority-details {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 700px) {
      .page-header {
        flex-direction: column;
      }

      .metric-grid,
      .priority-details {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DashboardPageComponent implements OnInit {
  loading = true;
  error = "";
  summary: DashboardSummary | null = null;
  metricCards: MetricCard[] = [];
  readonly skeletonCards = Array.from({ length: 4 });
  readonly recommendedActions = recommendedActions;

  constructor(private readonly dashboardApi: DashboardApiService) {}

  ngOnInit(): void {
    this.loadSummary();
  }

  loadSummary(): void {
    this.loading = true;
    this.error = "";

    this.dashboardApi
      .getSummary()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          this.metricCards = this.createMetricCards(summary);
        },
        error: (error: unknown) => {
          this.summary = null;
          this.metricCards = [];
          this.error = error instanceof Error ? error.message : "API indisponivel.";
        },
      });
  }

  private createMetricCards(summary: DashboardSummary): MetricCard[] {
    return [
      { label: "Potenciais clientes", value: summary.potentialClients, marker: "P" },
      { label: "Clientes ativos", value: summary.activeClients, marker: "A" },
      { label: "Clientes inativos", value: summary.inactiveClients, marker: "I" },
      { label: "Oportunidades criticas", value: summary.criticalOpportunities, marker: "C", alert: true },
    ];
  }
}
