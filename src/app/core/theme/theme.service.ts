import { DOCUMENT } from "@angular/common";
import { Injectable, inject, signal } from "@angular/core";

export type AppTheme = "dark" | "light";

@Injectable({ providedIn: "root" })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly _theme = signal<AppTheme>(this.readInitialTheme());
  readonly theme = this._theme.asReadonly();

  constructor() {
    this.apply(this._theme());
  }

  setTheme(theme: AppTheme): void {
    this._theme.set(theme);
    localStorage.setItem("hydro.control.theme", theme);
    this.apply(theme);
  }

  toggle(): void {
    this.setTheme(this._theme() === "dark" ? "light" : "dark");
  }

  private readInitialTheme(): AppTheme {
    const saved = localStorage.getItem("hydro.control.theme");
    if (saved === "dark" || saved === "light") return saved;
    return matchMedia?.("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  private apply(theme: AppTheme): void {
    this.document.documentElement.dataset["theme"] = theme;
    this.document.documentElement.style.colorScheme = theme;
    const meta = this.document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", theme === "dark" ? "#071018" : "#f3f7f9");
  }
}
