import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { MoveTableDto, ZoneNameDto } from './zones.dto';
import { ZonesService } from './zones.service';

// Rotas das zonas do salão (SPEC/2026-11-17-zonas-do-salao.md, RF-01, RF-02 e RF-04).
@Controller('api')
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Get('zones') list() {
    return this.zones.list();
  }

  @Post('zones') create(@Body() dto: ZoneNameDto) {
    return this.zones.create(dto);
  }

  @Patch('zones/:id') rename(@Param('id', ParseIntPipe) id: number, @Body() dto: ZoneNameDto) {
    return this.zones.rename(id, dto);
  }

  @Delete('zones/:id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.zones.remove(id);
  }

  @Patch('tables/:id') moveTable(@Param('id', ParseIntPipe) id: number, @Body() dto: MoveTableDto) {
    return this.zones.moveTable(id, dto);
  }
}
