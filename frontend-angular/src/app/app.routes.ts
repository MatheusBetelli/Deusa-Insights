import { Routes } from "@angular/router";
import { authGuard } from "./core/guards/auth.guard";
import { guestGuard } from "./core/guards/guest.guard";
import { AppShellComponent } from "./shared/components/app-shell/app-shell.component";
import { LoginPageComponent } from "./features/auth/login.page";
import { DashboardPageComponent } from "./features/dashboard/dashboard.page";
import { LeadsPageComponent } from "./features/leads/leads.page";
import { MapOpportunitiesPageComponent } from "./features/map-opportunities/map-opportunities.page";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "login" },
  { path: "login", canActivate: [guestGuard], component: LoginPageComponent },
  {
    path: "app",
    canActivate: [authGuard],
    component: AppShellComponent,
    children: [
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      { path: "dashboard", component: DashboardPageComponent },
      { path: "leads", component: LeadsPageComponent },
      { path: "map-opportunities", component: MapOpportunitiesPageComponent },
      { path: "mapa-oportunidades", pathMatch: "full", redirectTo: "map-opportunities" },
    ],
  },
  { path: "**", redirectTo: "login" },
];
