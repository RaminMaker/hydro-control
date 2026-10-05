import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import {
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { PumpSocketService } from "../core/services/pump-socket.service";
import { LanguageService } from "../core/i18n/language.service";
import { ThemeService } from "../core/theme/theme.service";
import { AuthService } from "../core/auth/auth.service";
import { ButtonModule } from "primeng/button";
import { TagModule } from "primeng/tag";
import { SelectButtonModule } from "primeng/selectbutton";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ButtonModule,
    TagModule,
    SelectButtonModule,
    FormsModule,
  ],
  templateUrl: "./shell.component.html",
  styleUrl: "./shell.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit {
  readonly pump = inject(PumpSocketService);
  readonly i18n = inject(LanguageService);
  readonly theme = inject(ThemeService);
  readonly auth = inject(AuthService);
  readonly burnerBanner = computed(
    () => this.pump.telemetry().boilerEnabled && this.pump.telemetry().burnerOn,
  );
  readonly sidebarCollapsed = signal(this.readSidebarState());
  readonly routeFailed = signal(false);
  readonly languageOptions = [
    { label: "EN", value: "en" },
    { label: "فا", value: "fa" },
  ];
  private readonly router = inject(Router);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart || event instanceof NavigationEnd)
        this.routeFailed.set(false);
      if (event instanceof NavigationError) this.routeFailed.set(true);
    });
  }

  reloadPage(): void {
    window.location.reload();
  }

  ngOnInit(): void {
    this.pump.connect();
    this.auth.warmApplicationRoutes();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => {
      const next = !value;
      try {
        localStorage.setItem(
          "hydro.control.sidebar.collapsed",
          next ? "1" : "0",
        );
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }

  async logout(): Promise<void> {
    this.pump.disconnect();
    await this.auth.logout();
    await this.router.navigateByUrl("/login", { replaceUrl: true });
  }

  private readSidebarState(): boolean {
    try {
      return localStorage.getItem("hydro.control.sidebar.collapsed") === "1";
    } catch {
      return false;
    }
  }
}
