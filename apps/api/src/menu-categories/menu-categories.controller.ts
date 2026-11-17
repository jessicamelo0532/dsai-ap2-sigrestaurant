import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { AssignMenuCategoryDto, CreateMenuCategoryDto, ReorderMenuCategoriesDto, UpdateMenuCategoryDto } from './menu-categories.dto';
import { MenuCategoriesService } from './menu-categories.service';

// Rotas das categorias do cardápio (SPEC/2026-11-16-categorias-do-cardapio.md, RF-01 a RF-07).
@Controller('api')
export class MenuCategoriesController {
  constructor(private readonly categories: MenuCategoriesService) {}

  @Get('menu-categories') list() {
    return this.categories.list();
  }

  @Post('menu-categories') create(@Body() dto: CreateMenuCategoryDto) {
    return this.categories.create(dto);
  }

  @Put('menu-categories/order') reorder(@Body() dto: ReorderMenuCategoriesDto) {
    return this.categories.reorder(dto);
  }

  @Post('menu-categories/import') importFromItems() {
    return this.categories.importFromItems();
  }

  @Patch('menu-categories/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete('menu-categories/:id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.categories.remove(id);
  }

  @Put('menu-items/:id/category') assignItem(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignMenuCategoryDto) {
    return this.categories.assignItem(id, dto);
  }
}
