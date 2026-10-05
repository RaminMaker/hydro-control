import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { LanguageService } from "../../core/i18n/language.service";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { TagModule } from "primeng/tag";

@Component({
  selector: "app-settings",
  standalone: true,
  imports: [CardModule, InputTextModule, TagModule],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  readonly i18n = inject(LanguageService);
}
