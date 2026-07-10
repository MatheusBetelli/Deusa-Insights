import { Component } from "@angular/core";

@Component({
  selector: "app-map-opportunities-placeholder-page",
  standalone: true,
  template: `
    <section class="placeholder">
      <p>Fase Angular base</p>
      <h1>Mapa ainda nao migrado</h1>
      <span>
        O service para <code>GET /map/opportunities</code> ja existe. A migracao do Leaflet preservara
        <code>origemCoordenada</code>, <code>statusVerificacaoEndereco</code> e os avisos de localizacao aproximada.
      </span>
    </section>
  `,
  styles: `
    .placeholder {
      border: 1px solid #dde5ef;
      border-radius: 14px;
      background: white;
      padding: 28px;
    }

    p {
      margin: 0 0 10px;
      color: #1061af;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 28px;
    }

    span {
      color: #64748b;
      line-height: 1.6;
    }
  `,
})
export class MapOpportunitiesPlaceholderPageComponent {}
