import { DecimalPipe, NgClass, NgFor, NgIf } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { finalize } from "rxjs";
import { Lead, LeadStatus, PotentialLevel } from "../../core/models/lead.model";
import { LeadsApiService } from "../../core/services/leads-api.service";

type PendingFilter = "todos" | "sim" | "nao";

const PAGE_SIZE = 10;

const statusLabels: Record<LeadStatus, string> = {
  NEW: "Novo",
  NO_CONTACT: "Sem contato",
  CONTACTED: "Contatado",
  INTERESTED: "Interessado",
  NEGOTIATION: "Em negociacao",
  CONVERTED: "Convertido",
  NOT_INTERESTED: "Descartado",
  INACTIVE: "Inativo",
};

const potentialFallbackLabels: Record<PotentialLevel, string> = {
  LOW: "Baixa Oportunidade",
  MEDIUM: "Media Oportunidade",
  HIGH: "Alta Oportunidade",
  CRITICAL: "Alta Oportunidade",
};

@Component({
  selector: "app-leads-page",
  standalone: true,
  imports: [DecimalPipe, FormsModule, NgClass, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1>Leads B2B</h1>
        <p>Encontre leads prioritarios e acompanhe a qualidade cadastral antes da proxima acao comercial.</p>
      </div>
      <div class="actions">
        <span class="primary disabled-action" aria-disabled="true" title="Importacao ainda nao migrada">
          Importar CNPJs
        </span>
        <span class="secondary disabled-action" aria-disabled="true" title="Exportacao ainda nao migrada">
          Exportar CSV
        </span>
      </div>
    </section>

    <section class="summary-grid" aria-label="Resumo de leads">
      <article>
        <strong>{{ leads.length | number: "1.0-0" }}</strong>
        <span>Total de leads</span>
      </article>
      <article>
        <strong>{{ highPotentialCount | number: "1.0-0" }}</strong>
        <span>Alto potencial</span>
      </article>
      <article>
        <strong>{{ pendingCount | number: "1.0-0" }}</strong>
        <span>Pendentes de validacao</span>
      </article>
    </section>

    <section class="filters" aria-label="Filtros de leads">
      <label class="search-field">
        <span>Busca</span>
        <input
          [(ngModel)]="search"
          (ngModelChange)="onFiltersChanged()"
          type="search"
          placeholder="Empresa, CNPJ, cidade ou situacao"
        />
      </label>

      <label>
        <span>Cidade</span>
        <select [(ngModel)]="city" (ngModelChange)="onFiltersChanged()">
          <option value="todos">Todas</option>
          <option *ngFor="let option of cityOptions" [value]="option">{{ option }}</option>
        </select>
      </label>

      <label>
        <span>Oportunidade</span>
        <select [(ngModel)]="opportunity" (ngModelChange)="onFiltersChanged()">
          <option value="todos">Todas</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baixa">Baixa</option>
        </select>
      </label>

      <label>
        <span>Verificacao</span>
        <select [(ngModel)]="verification" (ngModelChange)="onFiltersChanged()">
          <option value="todos">Todos</option>
          <option value="confiavel_cadastralmente">Confiavel cadastralmente</option>
          <option value="aproximado">Aproximado</option>
          <option value="nao_verificado">Nao verificado</option>
          <option value="verificado">Verificado</option>
          <option value="divergente">Divergente</option>
        </select>
      </label>

      <label>
        <span>Pendente</span>
        <select [(ngModel)]="pending" (ngModelChange)="onFiltersChanged()">
          <option value="todos">Qualquer estado</option>
          <option value="sim">Apenas pendentes</option>
          <option value="nao">Sem pendencias</option>
        </select>
      </label>

      <label>
        <span>Status comercial</span>
        <select [(ngModel)]="commercialStatus" (ngModelChange)="onFiltersChanged()">
          <option value="todos">Todos</option>
          <option *ngFor="let option of commercialStatusOptions" [value]="option">
            {{ statusLabel(option) }}
          </option>
        </select>
      </label>

      <button type="button" (click)="clearFilters()">Limpar filtros</button>
    </section>

    <section *ngIf="loading" class="state" aria-label="Carregando leads">
      <strong>Carregando leads B2B...</strong>
      <span>Consultando dados reais do backend.</span>
    </section>

    <section *ngIf="error && !loading" class="state state-error">
      <strong>Nao foi possivel carregar leads.</strong>
      <span>{{ error }}</span>
      <button type="button" (click)="loadLeads()">Tentar novamente</button>
    </section>

    <section *ngIf="!loading && !error && leads.length === 0" class="state">
      <strong>Nenhum lead retornado pelo backend.</strong>
      <span>Importe CNPJs reais antes de continuar a migracao dessa tela.</span>
    </section>

    <section *ngIf="!loading && !error && leads.length > 0 && filteredLeads.length === 0" class="state">
      <strong>Nenhum lead encontrado para os filtros atuais.</strong>
      <span>Limpe os filtros para voltar a visualizar a base carregada.</span>
    </section>

    <section *ngIf="!loading && !error && filteredLeads.length > 0" class="table-card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Cidade / Situacao</th>
              <th>Status comercial</th>
              <th>Oportunidade</th>
              <th>Qualidade cadastral</th>
              <th>Validacao</th>
              <th>Detalhe</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let lead of visibleLeads">
              <td>
                <strong>{{ companyName(lead) }}</strong>
                <small>{{ formatCnpj(lead.company.cnpj) }}</small>
                <small>{{ lead.company.razaoSocial }}</small>
              </td>
              <td>
                <strong>{{ lead.company.cidade || "-" }}{{ lead.company.uf ? "/" + lead.company.uf : "" }}</strong>
                <span class="badge" [ngClass]="registrationClass(lead.company.situacaoCadastral)">
                  {{ registrationLabel(lead.company.situacaoCadastral) }}
                </span>
              </td>
              <td>
                <span class="badge" [ngClass]="commercialStatusClass(lead.status)">
                  {{ statusLabel(lead.status) }}
                </span>
                <small *ngIf="lead.lastContactAt">Contato: {{ formatDateTime(lead.lastContactAt) }}</small>
              </td>
              <td>
                <div class="score-line">
                  <span class="score">{{ opportunityScore(lead) | number: "1.0-0" }}</span>
                  <span class="badge" [ngClass]="opportunityClass(lead)">
                    {{ opportunityLabel(lead) }}
                  </span>
                </div>
              </td>
              <td>
                <div class="quality-stack">
                  <span [ngClass]="confidenceClass(lead.company.confiancaVerificacao)">
                    Confianca {{ lead.company.confiancaVerificacao ?? "-" }}{{ lead.company.confiancaVerificacao != null ? "/100" : "" }}
                  </span>
                  <span class="badge" [ngClass]="verificationClass(lead.company.statusVerificacaoEndereco)">
                    {{ verificationLabel(lead.company.statusVerificacaoEndereco) }}
                  </span>
                </div>
              </td>
              <td>
                <span
                  class="badge"
                  [ngClass]="lead.company.pendenteValidacao ? 'badge-warning' : 'badge-muted'"
                >
                  {{ lead.company.pendenteValidacao ? "Pendente de validacao" : "Sem pendencia" }}
                </span>
                <small *ngIf="lead.company.origemCoordenada">
                  Origem: {{ lead.company.origemCoordenada }}
                </small>
              </td>
              <td>
                <span class="detail-placeholder" aria-disabled="true">Detalhe futuro</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer>
        <span>
          Mostrando {{ visibleLeads.length }} de {{ filteredLeads.length }} leads
          <ng-container *ngIf="filteredLeads.length !== leads.length">
            filtrados de {{ leads.length }}
          </ng-container>
        </span>
        <div class="pagination">
          <button type="button" [disabled]="page === 1" (click)="previousPage()">Anterior</button>
          <span>Pagina {{ page }} de {{ totalPages }}</span>
          <button type="button" [disabled]="page === totalPages" (click)="nextPage()">Proxima</button>
        </div>
      </footer>
    </section>
  `,
  styles: `
    .page-header,
    .table-card footer {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
    }

    h1 {
      margin: 0;
      color: #0b1f33;
      font-size: 26px;
    }

    .page-header p {
      max-width: 760px;
      margin: 8px 0 0;
      color: #64748b;
      line-height: 1.5;
    }

    .actions,
    .pagination,
    .score-line {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .primary,
    .secondary,
    .filters button,
    .state button,
    .pagination button,
    .detail-placeholder {
      display: inline-flex;
      min-height: 36px;
      align-items: center;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 900;
      padding: 0 12px;
    }

    .primary,
    .state button {
      border: 0;
      background: #0b1f33;
      color: white;
    }

    .secondary,
    .filters button,
    .pagination button,
    .detail-placeholder {
      border: 1px solid #dde5ef;
      background: white;
      color: #0b1f33;
    }

    .disabled-action,
    .detail-placeholder {
      cursor: not-allowed;
      opacity: 0.76;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
      margin: 22px 0 16px;
    }

    .summary-grid article,
    .filters,
    .state,
    .table-card {
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: white;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }

    .summary-grid article {
      padding: 18px;
    }

    .summary-grid strong {
      display: block;
      color: #0b1f33;
      font-size: 28px;
    }

    .summary-grid span,
    label span,
    small {
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
    }

    .filters {
      display: grid;
      grid-template-columns: minmax(240px, 2fr) repeat(5, minmax(150px, 1fr)) auto;
      gap: 12px;
      align-items: end;
      margin-bottom: 16px;
      padding: 16px;
    }

    label {
      display: grid;
      gap: 6px;
    }

    input,
    select {
      height: 40px;
      min-width: 0;
      border: 1px solid #dde5ef;
      border-radius: 10px;
      background: #f8fafc;
      color: #0b1f33;
      padding: 0 11px;
      outline: none;
    }

    input:focus,
    select:focus {
      border-color: #1061af;
      background: white;
    }

    .state {
      display: grid;
      gap: 10px;
      padding: 22px;
    }

    .state-error {
      border-color: #fca5a5;
      background: #fef2f2;
      color: #7f1d1d;
    }

    .table-card {
      overflow: hidden;
    }

    .table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
      min-width: 1180px;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    thead {
      border-bottom: 1px solid #dde5ef;
      background: #f8fafc;
      color: #64748b;
      font-size: 11px;
      text-transform: uppercase;
    }

    th,
    td {
      padding: 13px 14px;
      vertical-align: top;
    }

    tbody tr {
      border-bottom: 1px solid #eef2f7;
    }

    tbody tr:hover {
      background: #f8fafc;
    }

    td strong,
    td small {
      display: block;
    }

    td strong {
      color: #0b1f33;
      margin-bottom: 4px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 900;
      padding: 4px 8px;
    }

    .score {
      display: inline-flex;
      min-width: 38px;
      justify-content: center;
      border-radius: 8px;
      background: rgba(16, 97, 175, 0.1);
      color: #0f58a0;
      font-size: 12px;
      font-weight: 900;
      padding: 6px 8px;
    }

    .quality-stack {
      display: grid;
      gap: 6px;
      justify-items: start;
    }

    .confidence-high { color: #047857; font-weight: 900; }
    .confidence-medium { color: #b45309; font-weight: 900; }
    .confidence-low { color: #dc2626; font-weight: 900; }

    .badge-high { background: #15803d; color: white; }
    .badge-medium { background: #f59e0b; color: white; }
    .badge-low { background: #94a3b8; color: white; }
    .badge-critical { background: rgba(237, 28, 36, 0.1); color: #ed1c24; }
    .badge-blue { background: rgba(16, 97, 175, 0.1); color: #0f58a0; }
    .badge-green { background: #dcfce7; color: #047857; }
    .badge-teal { background: #ccfbf1; color: #0f766e; }
    .badge-orange { background: #ffedd5; color: #c2410c; }
    .badge-red { background: #fee2e2; color: #b91c1c; }
    .badge-warning { background: #ffedd5; color: #c2410c; }
    .badge-muted { background: #f1f5f9; color: #64748b; }

    .table-card footer {
      border-top: 1px solid #dde5ef;
      color: #64748b;
      font-size: 12px;
      font-weight: 800;
      padding: 14px;
    }

    .pagination button {
      cursor: pointer;
    }

    .pagination button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    @media (max-width: 1280px) {
      .filters {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .search-field {
        grid-column: span 2;
      }
    }

    @media (max-width: 760px) {
      .page-header,
      .table-card footer {
        flex-direction: column;
      }

      .summary-grid,
      .filters {
        grid-template-columns: 1fr;
      }

      .search-field {
        grid-column: auto;
      }
    }
  `,
})
export class LeadsPageComponent implements OnInit {
  leads: Lead[] = [];
  loading = true;
  error: string | null = null;

  search = "";
  city = "todos";
  opportunity = "todos";
  verification = "todos";
  pending: PendingFilter = "todos";
  commercialStatus: LeadStatus | "todos" = "todos";
  page = 1;

  constructor(private readonly leadsApi: LeadsApiService) {}

  ngOnInit(): void {
    this.loadLeads();
  }

  loadLeads(): void {
    this.loading = true;
    this.error = null;

    this.leadsApi
      .getLeads()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (leads) => {
          this.leads = leads;
          this.page = 1;
        },
        error: (error: unknown) => {
          this.error = error instanceof Error ? error.message : "Falha ao consultar GET /leads.";
        },
      });
  }

  get filteredLeads(): Lead[] {
    const search = this.normalize(this.search);

    return this.leads.filter((lead) => {
      const company = lead.company;
      const searchable = this.normalize(
        `${company.nomeFantasia ?? ""} ${company.razaoSocial} ${company.cnpj} ${company.cidade} ${company.situacaoCadastral}`,
      );
      const digits = this.search.replace(/\D/g, "");

      if (search && !searchable.includes(search) && !company.cnpj.includes(digits)) return false;
      if (this.city !== "todos" && company.cidade !== this.city) return false;
      if (this.opportunity !== "todos" && this.opportunityKey(lead) !== this.opportunity) return false;
      if (this.verification !== "todos" && this.verificationKey(company.statusVerificacaoEndereco) !== this.verification) return false;
      if (this.pending === "sim" && !company.pendenteValidacao) return false;
      if (this.pending === "nao" && company.pendenteValidacao) return false;
      if (this.commercialStatus !== "todos" && lead.status !== this.commercialStatus) return false;

      return true;
    });
  }

  get visibleLeads(): Lead[] {
    return this.filteredLeads.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredLeads.length / PAGE_SIZE));
  }

  get cityOptions(): string[] {
    return Array.from(new Set(this.leads.map((lead) => lead.company.cidade).filter(Boolean))).sort();
  }

  get commercialStatusOptions(): LeadStatus[] {
    return Array.from(new Set(this.leads.map((lead) => lead.status))).sort();
  }

  get highPotentialCount(): number {
    return this.leads.filter((lead) => this.opportunityKey(lead) === "alta").length;
  }

  get pendingCount(): number {
    return this.leads.filter((lead) => lead.company.pendenteValidacao).length;
  }

  onFiltersChanged(): void {
    this.page = 1;
  }

  clearFilters(): void {
    this.search = "";
    this.city = "todos";
    this.opportunity = "todos";
    this.verification = "todos";
    this.pending = "todos";
    this.commercialStatus = "todos";
    this.page = 1;
  }

  previousPage(): void {
    this.page = Math.max(1, this.page - 1);
  }

  nextPage(): void {
    this.page = Math.min(this.totalPages, this.page + 1);
  }

  companyName(lead: Lead): string {
    return lead.company.nomeFantasia || lead.company.razaoSocial;
  }

  formatCnpj(value: string): string {
    const digits = value.replace(/\D/g, "");
    return digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : value;
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  }

  statusLabel(status: LeadStatus): string {
    return statusLabels[status] ?? status;
  }

  opportunityScore(lead: Lead): number {
    return lead.company.pontuacaoOportunidade ?? lead.score;
  }

  opportunityLabel(lead: Lead): string {
    const nivel = lead.company.nivelOportunidade;
    if (nivel === "alta") return "Alta Oportunidade";
    if (nivel === "media") return "Media Oportunidade";
    if (nivel === "baixa") return "Baixa Oportunidade";
    return potentialFallbackLabels[lead.potentialLevel] ?? "Sem nivel";
  }

  opportunityClass(lead: Lead): string {
    const key = this.opportunityKey(lead);
    if (key === "alta") return "badge-high";
    if (key === "media") return "badge-medium";
    if (key === "baixa") return "badge-low";
    return "badge-muted";
  }

  confidenceClass(value?: number | null): string {
    if (value == null) return "confidence-low";
    if (value >= 80) return "confidence-high";
    if (value >= 50) return "confidence-medium";
    return "confidence-low";
  }

  verificationLabel(status?: string | null): string {
    const key = this.verificationKey(status);
    if (key === "confiavel_cadastralmente") return "Confiavel cadastralmente";
    if (key === "aproximado") return "Aproximado";
    if (key === "verificado") return "Verificado";
    if (key === "divergente") return "Divergente";
    return "Nao verificado";
  }

  verificationClass(status?: string | null): string {
    const key = this.verificationKey(status);
    if (key === "confiavel_cadastralmente") return "badge-teal";
    if (key === "aproximado") return "badge-blue";
    if (key === "verificado") return "badge-green";
    if (key === "divergente") return "badge-red";
    return "badge-muted";
  }

  registrationLabel(situation?: string | null): string {
    const key = situation?.toUpperCase();
    if (key === "ATIVA") return "Ativa";
    if (key === "BAIXADA") return "Baixada";
    if (key === "INAPTA") return "Inapta";
    if (key === "SUSPENSA") return "Suspensa";
    return situation || "Desconhecida";
  }

  registrationClass(situation?: string | null): string {
    const key = situation?.toUpperCase();
    if (key === "ATIVA") return "badge-green";
    if (key === "BAIXADA") return "badge-red";
    if (key === "INAPTA") return "badge-orange";
    if (key === "SUSPENSA") return "badge-medium";
    return "badge-muted";
  }

  commercialStatusClass(status: LeadStatus): string {
    if (status === "CONVERTED") return "badge-green";
    if (status === "NEGOTIATION") return "badge-blue";
    if (status === "INTERESTED") return "badge-medium";
    if (status === "NOT_INTERESTED" || status === "INACTIVE") return "badge-muted";
    return "badge-critical";
  }

  private opportunityKey(lead: Lead): string {
    if (lead.company.nivelOportunidade) return lead.company.nivelOportunidade;
    if (lead.potentialLevel === "LOW") return "baixa";
    if (lead.potentialLevel === "MEDIUM") return "media";
    return "alta";
  }

  private verificationKey(status?: string | null): string {
    return status || "nao_verificado";
  }

  private normalize(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }
}
