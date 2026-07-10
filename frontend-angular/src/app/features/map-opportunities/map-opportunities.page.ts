import { NgFor, NgIf } from "@angular/common";
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormsModule } from "@angular/forms";
import * as L from "leaflet";
import { finalize } from "rxjs";
import { MapOpportunity } from "../../core/models/map-opportunity.model";
import { MapOpportunitiesApiService } from "../../core/services/map-opportunities-api.service";

const DEFAULT_CENTER: L.LatLngExpression = [-22.05, -50.18];
const DEFAULT_ZOOM = 9;
const APPROXIMATION_WARNING =
  "Localização aproximada por município. A base da Receita Federal não fornece latitude e longitude exatas deste estabelecimento.";

@Component({
  selector: "app-map-opportunities-page",
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  template: `
    <section class="page-header">
      <div>
        <h1>Mapa de oportunidades</h1>
        <p>Visualize oportunidades com coordenadas reais retornadas pelo backend e rastreabilidade da origem.</p>
      </div>
      <span class="primary disabled-action" aria-disabled="true" title="Importacao ainda nao migrada">
        Importar CNPJs
      </span>
    </section>

    <section class="filters" aria-label="Filtros do mapa">
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
          <option value="aproximado">Aproximado</option>
          <option value="confiavel_cadastralmente">Confiavel cadastralmente</option>
          <option value="nao_verificado">Nao verificado</option>
          <option value="verificado">Verificado</option>
          <option value="divergente">Divergente</option>
        </select>
      </label>

      <button type="button" (click)="clearFilters()">Limpar filtros</button>
    </section>

    <section *ngIf="loading" class="state" aria-label="Carregando mapa">
      <strong>Carregando oportunidades do mapa...</strong>
      <span>Consultando GET /map/opportunities no backend real.</span>
    </section>

    <section *ngIf="error && !loading" class="state state-error">
      <strong>Nao foi possivel carregar o mapa.</strong>
      <span>{{ error }}</span>
      <button type="button" (click)="loadOpportunities()">Tentar novamente</button>
    </section>

    <section *ngIf="!loading && !error && opportunities.length === 0" class="state">
      <strong>Nenhuma oportunidade encontrada.</strong>
      <span>O endpoint respondeu sem pontos para exibir no Leaflet.</span>
    </section>

    <ng-container *ngIf="!loading && !error && opportunities.length > 0">
      <section class="summary-grid">
        <article>
          <strong>{{ opportunities.length }}</strong>
          <span>Pontos carregados</span>
        </article>
        <article>
          <strong>{{ filteredPoints.length }}</strong>
          <span>Pontos filtrados</span>
        </article>
        <article>
          <strong>{{ approximateCount }}</strong>
          <span>Localizacoes aproximadas</span>
        </article>
      </section>

      <section class="map-layout">
        <article class="map-card">
          <header>
            <div>
              <h2>Oportunidades no mapa</h2>
              <p *ngIf="pointsWithoutCoordinates.length > 0">
                {{ pointsWithoutCoordinates.length }} ponto(s) filtrado(s) sem latitude/longitude nao aparecem no mapa.
              </p>
            </div>
            <div class="legend" aria-label="Legenda do mapa">
              <span><i class="dot dot-approx"></i> Localizacao aproximada</span>
              <span><i class="dot dot-high"></i> Alta oportunidade</span>
              <span><i class="dot dot-medium"></i> Media oportunidade</span>
              <span><i class="dot dot-low"></i> Baixa oportunidade</span>
            </div>
          </header>

          <div class="map-host">
            <div #mapContainer class="map-container"></div>
            <div *ngIf="filteredPoints.length === 0" class="map-overlay">
              <strong>Nenhuma oportunidade para os filtros atuais.</strong>
              <span>Limpe os filtros para voltar a visualizar todos os pontos.</span>
            </div>
            <div *ngIf="filteredPoints.length > 0 && pointsWithCoordinates.length === 0" class="map-overlay">
              <strong>Sem coordenadas para exibir.</strong>
              <span>Os pontos filtrados nao possuem latitude e longitude no payload.</span>
            </div>
          </div>
        </article>

        <aside class="side-card">
          <h2>Top oportunidades</h2>
          <button
            *ngFor="let point of topOpportunities"
            type="button"
            [disabled]="!hasCoordinates(point)"
            (click)="focusPoint(point)"
          >
            <span>
              <strong>{{ point.companyName }}</strong>
              <small>{{ point.city }}/{{ point.uf }}</small>
            </span>
            <em>{{ point.score }}</em>
          </button>
        </aside>
      </section>

      <section *ngIf="approximateCount > 0" class="approx-warning">
        <strong>Localizacoes aproximadas:</strong>
        {{ approximateCount }} ponto(s) usam centroide/jitter de municipio. {{ approximationWarning }}
      </section>
    </ng-container>
  `,
  styles: `
    .page-header,
    .map-card header {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
    }

    h1,
    h2 {
      margin: 0;
      color: #0b1f33;
    }

    h1 {
      font-size: 26px;
    }

    h2 {
      font-size: 18px;
    }

    p {
      margin: 8px 0 0;
      color: #64748b;
      line-height: 1.5;
    }

    .primary,
    .filters button,
    .state button {
      display: inline-flex;
      min-height: 38px;
      align-items: center;
      border-radius: 10px;
      border: 0;
      background: #0b1f33;
      color: white;
      font-size: 12px;
      font-weight: 900;
      padding: 0 12px;
    }

    .disabled-action {
      cursor: not-allowed;
      opacity: 0.76;
    }

    .filters,
    .summary-grid,
    .map-layout {
      margin-top: 16px;
    }

    .filters {
      display: grid;
      grid-template-columns: repeat(3, minmax(180px, 1fr)) auto;
      gap: 12px;
      align-items: end;
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: white;
      padding: 16px;
    }

    label {
      display: grid;
      gap: 6px;
    }

    label span {
      color: #64748b;
      font-size: 12px;
      font-weight: 800;
    }

    select {
      height: 40px;
      border: 1px solid #dde5ef;
      border-radius: 10px;
      background: #f8fafc;
      color: #0b1f33;
      padding: 0 11px;
    }

    .state,
    .map-card,
    .side-card,
    .summary-grid article,
    .approx-warning {
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: white;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }

    .state {
      display: grid;
      gap: 10px;
      margin-top: 18px;
      padding: 22px;
    }

    .state-error {
      border-color: #fca5a5;
      background: #fef2f2;
      color: #7f1d1d;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
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
    .side-card small {
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
    }

    .map-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 16px;
    }

    .map-card {
      overflow: hidden;
    }

    .map-card header {
      border-bottom: 1px solid #dde5ef;
      padding: 16px;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
      color: #475569;
      font-size: 12px;
      font-weight: 800;
    }

    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .dot {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 999px;
    }

    .dot-approx { border: 2px dashed #0b1f33; background: #f59e0b; }
    .dot-high { background: #15803d; }
    .dot-medium { background: #f59e0b; }
    .dot-low { background: #94a3b8; }

    .map-host {
      position: relative;
      height: 620px;
      background: #e8eef5;
    }

    .map-container {
      height: 100%;
      width: 100%;
    }

    .map-overlay {
      position: absolute;
      inset: 0;
      z-index: 500;
      display: grid;
      place-content: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.9);
      padding: 24px;
      text-align: center;
    }

    .side-card {
      display: grid;
      align-content: start;
      gap: 12px;
      padding: 16px;
    }

    .side-card button {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid #eef2f7;
      border-radius: 12px;
      background: white;
      color: #0b1f33;
      cursor: pointer;
      padding: 12px;
      text-align: left;
    }

    .side-card button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }

    .side-card em {
      border-radius: 8px;
      background: rgba(16, 97, 175, 0.1);
      color: #0f58a0;
      font-style: normal;
      font-weight: 900;
      padding: 5px 8px;
    }

    .approx-warning {
      margin-top: 16px;
      border-color: #bae6fd;
      background: #f0f9ff;
      color: #075985;
      padding: 14px;
      line-height: 1.5;
    }

    @media (max-width: 1080px) {
      .map-layout,
      .filters,
      .summary-grid {
        grid-template-columns: 1fr;
      }

      .page-header,
      .map-card header {
        flex-direction: column;
      }

      .legend {
        justify-content: flex-start;
      }
    }
  `,
})
export class MapOpportunitiesPageComponent implements OnInit, OnDestroy {
  @ViewChild("mapContainer")
  set mapContainer(element: ElementRef<HTMLDivElement> | undefined) {
    if (!element) return;
    this.mapElement = element.nativeElement;
    this.initializeMap();
  }

  readonly approximationWarning = APPROXIMATION_WARNING;

  opportunities: MapOpportunity[] = [];
  loading = true;
  error: string | null = null;

  city = "todos";
  opportunity = "todos";
  verification = "todos";

  private mapElement: HTMLDivElement | null = null;
  private map: L.Map | null = null;
  private markerLayer: L.LayerGroup | null = null;
  private markers = new Map<string, L.CircleMarker>();

  constructor(private readonly mapApi: MapOpportunitiesApiService) {}

  ngOnInit(): void {
    this.loadOpportunities();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  loadOpportunities(): void {
    this.loading = true;
    this.error = null;

    this.mapApi
      .getOpportunities()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (opportunities) => {
          this.opportunities = opportunities;
          this.scheduleMapUpdate();
        },
        error: (error: unknown) => {
          this.error = error instanceof Error ? error.message : "Falha ao consultar GET /map/opportunities.";
        },
      });
  }

  get filteredPoints(): MapOpportunity[] {
    return this.opportunities.filter((point) => {
      if (this.city !== "todos" && point.city !== this.city) return false;
      if (this.opportunity !== "todos" && this.opportunityKey(point) !== this.opportunity) return false;
      if (this.verification !== "todos" && this.verificationKey(point) !== this.verification) return false;
      return true;
    });
  }

  get pointsWithCoordinates(): MapOpportunity[] {
    return this.filteredPoints.filter((point) => this.hasCoordinates(point));
  }

  get pointsWithoutCoordinates(): MapOpportunity[] {
    return this.filteredPoints.filter((point) => !this.hasCoordinates(point));
  }

  get topOpportunities(): MapOpportunity[] {
    return [...this.filteredPoints].sort((a, b) => b.score - a.score).slice(0, 5);
  }

  get cityOptions(): string[] {
    return Array.from(new Set(this.opportunities.map((point) => point.city).filter(Boolean))).sort();
  }

  get approximateCount(): number {
    return this.filteredPoints.filter((point) => this.isApproximate(point)).length;
  }

  onFiltersChanged(): void {
    this.scheduleMapUpdate();
  }

  clearFilters(): void {
    this.city = "todos";
    this.opportunity = "todos";
    this.verification = "todos";
    this.scheduleMapUpdate();
  }

  focusPoint(point: MapOpportunity): void {
    if (!this.hasCoordinates(point)) return;
    const latLng: L.LatLngExpression = [point.latitude!, point.longitude!];
    this.map?.flyTo(latLng, 14);
    this.markers.get(point.id)?.openPopup();
  }

  hasCoordinates(point: MapOpportunity): boolean {
    return typeof point.latitude === "number" && typeof point.longitude === "number";
  }

  private initializeMap(): void {
    if (!this.mapElement || this.map) return;

    this.map = L.map(this.mapElement, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
      minZoom: 3,
    }).addTo(this.map);

    this.markerLayer = L.layerGroup().addTo(this.map);
    this.scheduleMapUpdate();
  }

  private scheduleMapUpdate(): void {
    window.setTimeout(() => this.renderMarkers(), 0);
  }

  private renderMarkers(): void {
    if (!this.map || !this.markerLayer) return;

    this.markerLayer.clearLayers();
    this.markers.clear();

    const points = this.pointsWithCoordinates;

    points.forEach((point) => {
      const marker = L.circleMarker([point.latitude!, point.longitude!], {
        radius: 12,
        color: this.isApproximate(point) ? "#0b1f33" : "#ffffff",
        dashArray: this.isApproximate(point) ? "4 4" : undefined,
        fillColor: this.markerColor(point),
        fillOpacity: this.isApproximate(point) ? 0.72 : 0.9,
        opacity: 1,
        weight: this.isApproximate(point) ? 3 : 2,
      })
        .bindPopup(this.popupHtml(point), { maxWidth: 340, minWidth: 260 })
        .addTo(this.markerLayer!);

      this.markers.set(point.id, marker);
    });

    if (points.length === 0) {
      this.map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      return;
    }

    const bounds = L.latLngBounds(points.map((point) => [point.latitude!, point.longitude!] as L.LatLngTuple));
    if (bounds.isValid()) {
      points.length === 1 ? this.map.setView(bounds.getCenter(), 12) : this.map.fitBounds(bounds.pad(0.2), { maxZoom: 11 });
    }

    window.setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private popupHtml(point: MapOpportunity): string {
    const approximateWarning = this.isApproximate(point)
      ? `<div class="deusa-map-popup-warning">${this.escape(APPROXIMATION_WARNING)}</div>`
      : "";

    return `
      <div class="deusa-map-popup">
        <strong>${this.escape(point.companyName)}</strong>
        <span>${this.escape(this.formatCnpj(point.cnpj))} · ${this.escape(point.city)}/${this.escape(point.uf)}</span>
        <dl>
          <div><dt>Situacao cadastral</dt><dd>${this.escape(point.situacaoCadastral || "Nao disponivel no endpoint")}</dd></div>
          <div><dt>Pontuacao</dt><dd>${this.escape(String(point.pontuacaoOportunidade ?? point.score))}</dd></div>
          <div><dt>Nivel</dt><dd>${this.escape(this.opportunityLabel(point))}</dd></div>
          <div><dt>Confianca cadastral</dt><dd>${this.escape(point.confiancaVerificacao == null ? "Nao disponivel" : `${point.confiancaVerificacao}/100`)}</dd></div>
          <div><dt>Status verificacao</dt><dd>${this.escape(this.verificationLabel(point))}</dd></div>
          <div><dt>Origem coordenada</dt><dd>${this.escape(point.origemCoordenada || "Nao informada")}</dd></div>
        </dl>
        ${approximateWarning}
      </div>
    `;
  }

  private markerColor(point: MapOpportunity): string {
    const key = this.opportunityKey(point);
    if (key === "alta") return "#15803d";
    if (key === "media") return "#f59e0b";
    return "#94a3b8";
  }

  private opportunityKey(point: MapOpportunity): string {
    if (point.nivelOportunidade) return point.nivelOportunidade;
    if (point.potentialLevel === "LOW") return "baixa";
    if (point.potentialLevel === "MEDIUM") return "media";
    return "alta";
  }

  private opportunityLabel(point: MapOpportunity): string {
    const key = this.opportunityKey(point);
    if (key === "alta") return point.potentialLevel === "CRITICAL" ? "Critica / Alta" : "Alta";
    if (key === "media") return "Media";
    return "Baixa";
  }

  private verificationKey(point: MapOpportunity): string {
    if (this.isApproximate(point)) return "aproximado";
    return point.statusVerificacaoEndereco || "nao_verificado";
  }

  private verificationLabel(point: MapOpportunity): string {
    const key = this.verificationKey(point);
    if (key === "confiavel_cadastralmente") return "Confiavel cadastralmente";
    if (key === "aproximado") return "Aproximado";
    if (key === "verificado") return "Verificado";
    if (key === "divergente") return "Divergente";
    return "Nao verificado";
  }

  private isApproximate(point: MapOpportunity): boolean {
    const origin = point.origemCoordenada || "";
    return origin.includes("centroide") || origin.includes("jitter");
  }

  private formatCnpj(value: string): string {
    const digits = value.replace(/\D/g, "");
    return digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : value;
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
  }
}
