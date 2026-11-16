import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { SetMenuOptionsDto } from './menu-options.dto';
import { MenuOptionsService } from './menu-options.service';

// Rotas de variações e adicionais (SPEC/2026-11-16-variacoes-e-adicionais.md, RF-01 e RF-02).
@Controller('api/menu-items/:id/options')
export class MenuOptionsController {
  constructor(private readonly options: MenuOptionsService) {}

  @Get() get(@Param('id', ParseIntPipe) id: number) {
    return this.options.get(id);
  }

  @Put() replace(@Param('id', ParseIntPipe) id: number, @Body() dto: SetMenuOptionsDto) {
    return this.options.replace(id, dto);
  }
}
