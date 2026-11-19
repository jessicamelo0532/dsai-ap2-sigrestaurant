import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { CreateMenuItemDto, UpdateMenuItemDto } from '../dto';
import { MenuService } from './menu.service';

// Rotas do cardápio (SPEC/2026-11-18-modulos-da-api.md, RF-02).
@Controller('api')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  @Get('menu-items') list(@Query('all') all?: string) {
    return this.menu.listMenu(all === 'true');
  }

  @Get('menu-items/:id') get(@Param('id', ParseIntPipe) id: number) {
    return this.menu.getMenuItem(id);
  }

  @Post('menu-items') create(@Body() dto: CreateMenuItemDto) {
    return this.menu.createMenuItem(dto);
  }

  @Patch('menu-items/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuItemDto) {
    return this.menu.updateMenuItem(id, dto);
  }

  @Delete('menu-items/:id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.menu.deleteMenuItem(id);
  }
}
