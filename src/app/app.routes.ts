import { Routes } from "@angular/router";
import { authGuard, guestGuard } from "./core/auth/auth.guard";

export const routes: Routes = [
  {
    path: "login",
    canActivate: [guestGuard],
    loadComponent: () =>
      import("./features/auth/login.component").then((m) => m.LoginComponent),
  },
  {
    path: "",
    canActivate: [authGuard],
    loadComponent: () =>
      import("./layout/shell.component").then((m) => m.ShellComponent),
    children: [
      { path: "", pathMatch: "full", redirectTo: "dashboard" },
      {
        path: "dashboard",
        loadComponent: () =>
          import("./features/dashboard/dashboard.component").then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: "analytics",
        loadComponent: () =>
          import("./features/analytics/analytics.component").then(
            (m) => m.AnalyticsComponent,
          ),
      },
      {
        path: "heating",
        loadComponent: () =>
          import("./features/heating/pages/heating/heating.component").then(
            (m) => m.HeatingComponent,
          ),
      },
      {
        path: "alarms",
        loadComponent: () =>
          import("./features/alarms/alarms.component").then(
            (m) => m.AlarmsComponent,
          ),
      },
      {
        path: "settings",
        loadComponent: () =>
          import("./features/settings/settings.component").then(
            (m) => m.SettingsComponent,
          ),
      },
    ],
  },
  { path: "**", redirectTo: "dashboard" },
];
