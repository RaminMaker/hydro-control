import { ApplicationConfig } from "@angular/core";
import {
  provideRouter,
  withComponentInputBinding,
  withRouterConfig,
} from "@angular/router";
import { routes } from "./app.routes";
import { providePrimeNG } from "primeng/config";
import Aura from "@primeuix/themes/aura";
import { definePreset } from "@primeuix/themes";

const IndustrialAura = definePreset(Aura, {
  semantic: {
    primary: {
      50: "#f0fdff",
      100: "#cff7ff",
      200: "#9dedff",
      300: "#6ce4ff",
      400: "#3ad8f6",
      500: "#2ed6f4",
      600: "#0ba7c9",
      700: "#0b829e",
      800: "#0e637a",
      900: "#10485b",
      950: "#062b38",
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withComponentInputBinding(),
      withRouterConfig({ onSameUrlNavigation: "reload" }),
    ),
    providePrimeNG({
      theme: {
        preset: IndustrialAura,
        options: {
          darkModeSelector: "html[data-theme='dark']",
          cssLayer: false,
        },
      },
      ripple: true,
    }),
  ],
};
