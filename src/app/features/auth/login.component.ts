import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../core/auth/auth.service";
import { LanguageService } from "../../core/i18n/language.service";
import { ThemeService } from "../../core/theme/theme.service";
import { InputTextModule } from "primeng/inputtext";
import { PasswordModule } from "primeng/password";
import { ButtonModule } from "primeng/button";
import { MessageModule } from "primeng/message";
import { FormsModule } from "@angular/forms";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    FormsModule,
  ],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  readonly auth = inject(AuthService);
  readonly i18n = inject(LanguageService);
  readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly showPassword = signal(false);

  username = "admin";
  password = "admin";

  submitForm(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  onUsernameInput(event: Event): void {
    this.username = (event.target as HTMLInputElement).value;
    this.auth.clearError();
  }

  onPasswordInput(event: Event): void {
    this.password = (event.target as HTMLInputElement).value;
    this.auth.clearError();
  }

  async submit(): Promise<void> {
    const ok = await this.auth.login(this.username.trim(), this.password);
    if (!ok) return;
    const requested = this.route.snapshot.queryParamMap.get("returnUrl");
    const target =
      requested?.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/dashboard";
    await this.router.navigateByUrl(target, { replaceUrl: true });
    this.auth.warmApplicationRoutes();
  }

  errorText(): string {
    if (this.auth.error() === "INVALID_CREDENTIALS")
      return this.i18n.t("login.invalid");
    if (this.auth.error() === "SERVER_UNREACHABLE")
      return this.i18n.t("login.serverUnavailable");
    return this.i18n.t("login.serverError");
  }
}
