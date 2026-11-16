import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { SetAvailabilityDto } from './menu-availability.dto';
import { MenuAvailabilityService } from './menu-availability.service';

// Rotas das janelas de horário (SPEC/2026-11-16-cardapio-por-horario.md, RF-01 e RF-02).
@Controller('api/menu-items/:id/availability')
export class MenuAvailabilityController {
  constructor(private readonly availability: MenuAvailabilityService) {}

  @Get() get(@Param('id', ParseIntPipe) id: number) {
    return this.availability.get(id);
  }

  @Put() replace(@Param('id', ParseIntPipe) id: number, @Body() dto: SetAvailabilityDto) {
    return this.availability.replace(id, dto);
  }
}
