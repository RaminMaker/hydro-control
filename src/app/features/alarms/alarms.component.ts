import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LanguageService } from '../../core/i18n/language.service';
import { PumpSocketService } from '../../core/services/pump-socket.service';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-alarms',
  standalone: true,
  imports: [DatePipe, TableModule, ButtonModule, CardModule],
  templateUrl: './alarms.component.html',
  styleUrl: './alarms.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlarmsComponent {
  readonly pump = inject(PumpSocketService);
  readonly i18n = inject(LanguageService);
}
