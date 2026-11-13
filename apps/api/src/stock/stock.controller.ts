import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import {
  CreateIngredientDto,
  SetRecipeDto,
  StockCountDto,
  StockEntryDto,
  StockLossDto,
  UpdateIngredientDto,
} from './stock.dto';
import { StockService } from './stock.service';

// Rotas do estoque (SPEC/2026-11-13-estoque-de-ingredientes.md, RF-01 a RF-07).
@Controller('api')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('stock/ingredients') list() {
    return this.stock.listIngredients();
  }

  @Get('stock/alerts') alerts() {
    return this.stock.alerts();
  }

  @Get('stock/ingredients/:id') get(@Param('id', ParseIntPipe) id: number) {
    return this.stock.getIngredient(id);
  }

  @Post('stock/ingredients') create(@Body() dto: CreateIngredientDto) {
    return this.stock.createIngredient(dto);
  }

  @Patch('stock/ingredients/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIngredientDto) {
    return this.stock.updateIngredient(id, dto);
  }

  @Delete('stock/ingredients/:id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.stock.deleteIngredient(id);
  }

  @Get('stock/ingredients/:id/movements') movements(@Param('id', ParseIntPipe) id: number) {
    return this.stock.listMovements(id);
  }

  @Post('stock/ingredients/:id/entries') entry(@Param('id', ParseIntPipe) id: number, @Body() dto: StockEntryDto) {
    return this.stock.registerEntry(id, dto);
  }

  @Post('stock/ingredients/:id/losses') loss(@Param('id', ParseIntPipe) id: number, @Body() dto: StockLossDto) {
    return this.stock.registerLoss(id, dto);
  }

  @Post('stock/ingredients/:id/count') count(@Param('id', ParseIntPipe) id: number, @Body() dto: StockCountDto) {
    return this.stock.registerCount(id, dto);
  }

  @Get('menu-items/:id/recipe') recipe(@Param('id', ParseIntPipe) id: number) {
    return this.stock.getRecipe(id);
  }

  @Put('menu-items/:id/recipe') setRecipe(@Param('id', ParseIntPipe) id: number, @Body() dto: SetRecipeDto) {
    return this.stock.setRecipe(id, dto);
  }
}
