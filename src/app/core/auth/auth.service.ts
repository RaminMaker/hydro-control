import { Injectable, computed, signal } from "@angular/core";

interface LoginResponse {
  token: string;
  user: { username: string; displayName: string; role: string };
}
export interface AuthUser {
  username: string;
  displayName: string;
  role: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly tokenKey = "hydro.control.session.token";
  private readonly userKey = "hydro.control.session.user";
  private readonly _token = signal<string | null>(
    sessionStorage.getItem(this.tokenKey),
  );
  private readonly _user = signal<AuthUser | null>(this.restoreUser());
  private readonly _busy = signal(false);
  private readonly _error = signal("");
  private sessionTrusted = false;

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly busy = this._busy.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token() && !!this._user());

  async login(username: string, password: string): Promise<boolean> {
    if (this._busy()) return false;
    this._busy.set(true);
    this._error.set("");
    try {
      const response = await fetch("http://localhost:8081/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        this._error.set(
          response.status === 401 ? "INVALID_CREDENTIALS" : "SERVER_ERROR",
        );
        return false;
      }
      const data = (await response.json()) as LoginResponse;
      this._token.set(data.token);
      this._user.set(data.user);
      this.sessionTrusted = true;
      sessionStorage.setItem(this.tokenKey, data.token);
      sessionStorage.setItem(this.userKey, JSON.stringify(data.user));
      return true;
    } catch {
      this._error.set("SERVER_UNREACHABLE");
      return false;
    } finally {
      this._busy.set(false);
    }
  }

  async validateSession(): Promise<boolean> {
    const token = this._token();
    if (!token || !this._user()) return false;
    if (this.sessionTrusted) return true;
    try {
      const response = await fetch("http://localhost:8081/api/session", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        this.clearSession();
        return false;
      }
      this.sessionTrusted = true;
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async logout(): Promise<void> {
    const token = this._token();
    this.clearSession();
    if (!token) return;
    try {
      await fetch("http://localhost:8081/api/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
  }

  getToken(): string | null {
    return this._token();
  }

  clearError(): void {
    this._error.set("");
  }

  clearSession(): void {
    this.sessionTrusted = false;
    this._token.set(null);
    this._user.set(null);
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
  }

  warmApplicationRoutes(): void {
    const warm = () =>
      Promise.allSettled([
        import("../../features/analytics/analytics.component"),
        import("../../features/heating/pages/heating/heating.component"),
        import("../../features/alarms/alarms.component"),
        import("../../features/settings/settings.component"),
      ]);
    const idleCallback = (
      globalThis as typeof globalThis & {
        requestIdleCallback?: (
          callback: () => void,
          options?: { timeout: number },
        ) => number;
      }
    ).requestIdleCallback;

    if (idleCallback) {
      idleCallback(() => void warm(), { timeout: 2200 });
      return;
    }

    globalThis.setTimeout(() => void warm(), 700);
  }

  private restoreUser(): AuthUser | null {
    try {
      const raw = sessionStorage.getItem(this.userKey);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  }
}
