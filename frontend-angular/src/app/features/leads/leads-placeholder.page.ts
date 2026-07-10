import { Component } from "@angular/core";

@Component({
  selector: "app-leads-placeholder-page",
  standalone: true,
  template: `
    <section class="placeholder">
      <p>Fase Angular base</p>
      <h1>Leads ainda nao migrados</h1>
      <span>O service para <code>GET /leads</code> ja existe. A tabela e filtros serao migrados em fase propria.</span>
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
    }
  `,
})
export class LeadsPlaceholderPageComponent {}
