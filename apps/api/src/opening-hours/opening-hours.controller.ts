import { Body, Controller, Get, Put } from '@nestjs/common';
import { SetAvailabilityDto } from '../menu-availability/menu-availability.dto';
import { OpeningHoursService } from './opening-hours.service';

// Rotas do horário de funcionamento (SPEC/2026-11-17-horario-de-funcionamento.md, RF-01).
@Controller('api/opening-hours')
export class OpeningHoursController {
  constructor(private readonly hours: OpeningHoursService) {}

  @Get() get() {
    return this.hours.get();
  }

  @Put() replace(@Body() dto: SetAvailabilityDto) {
    return this.hours.replace(dto);
  }
}
