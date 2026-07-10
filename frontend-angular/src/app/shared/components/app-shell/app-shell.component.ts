import { AsyncPipe, NgFor } from "@angular/common";
import { Component } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { AuthService } from "../../../core/services/auth.service";

type NavItem = {
  label: string;
  path: string;
  note: string;
};

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [AsyncPipe, NgFor, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <strong>Deusa Analytics</strong>
          <span>Angular paralelo</span>
        </div>

        <nav aria-label="Navegacao principal">
          <a
            *ngFor="let item of navItems"
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <span>{{ item.label }}</span>
            <small>{{ item.note }}</small>
          </a>
        </nav>
      </aside>

      <section class="content">
        <header class="topbar">
          <div>
            <span class="kicker">Sessao validada no backend</span>
            <strong>{{ (auth.user$ | async)?.name || "Usuario" }}</strong>
          </div>
          <button type="button" (click)="logout()">Sair</button>
        </header>

        <main>
          <router-outlet />
        </main>
      </section>
    </div>
  `,
  styles: `
    .shell {
      display: grid;
      min-height: 100vh;
      grid-template-columns: 280px minmax(0, 1fr);
      background: #f5f7fa;
    }

    .sidebar {
      display: flex;
      min-height: 100vh;
      flex-direction: column;
      background: #0b1b2b;
      color: white;
    }

    .brand {
      display: grid;
      gap: 5px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 24px;
    }

    .brand strong {
      font-size: 18px;
    }

    .brand span {
      color: #94a3b8;
      font-size: 12px;
      font-weight: 700;
    }

    nav {
      display: grid;
      gap: 8px;
      padding: 18px 12px;
    }

    nav a {
      display: grid;
      gap: 3px;
      border-radius: 10px;
      color: #cbd5e1;
      padding: 12px;
    }

    nav a.active,
    nav a:hover {
      background: rgba(255, 255, 255, 0.09);
      color: white;
    }

    nav small {
      color: #94a3b8;
      font-size: 11px;
    }

    .content {
      min-width: 0;
    }

    .topbar {
      display: flex;
      height: 64px;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #dde5ef;
      background: white;
      padding: 0 28px;
    }

    .topbar div {
      display: grid;
      gap: 3px;
    }

    .kicker {
      color: #1061af;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .topbar button {
      height: 36px;
      border: 1px solid #dde5ef;
      border-radius: 9px;
      background: white;
      color: #0b1f33;
      cursor: pointer;
      font-size: 13px;
      font-weight: 800;
      padding: 0 14px;
    }

    main {
      padding: 28px;
    }

    @media (max-width: 820px) {
      .shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        min-height: auto;
      }
    }
  `,
})
export class AppShellComponent {
  readonly navItems: NavItem[] = [
    { label: "Dashboard", path: "/app/dashboard", note: "dados reais" },
    { label: "Leads", path: "/app/leads", note: "dados reais" },
    { label: "Mapa", path: "/app/map-opportunities", note: "dados reais" },
  ];

  constructor(
    readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl("/login");
  }
}
