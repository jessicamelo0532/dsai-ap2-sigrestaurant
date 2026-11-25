import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { AddOrderItemDto, CreateTableDto } from '../dto';
import { OrdersService } from '../orders/orders.service';
import { TablesService } from './tables.service';

// Rotas das mesas (SPEC/2026-11-18-modulos-da-api.md, RF-01).
@Controller('api')
export class TablesController {
  constructor(
    private readonly tables: TablesService,
    private readonly orders: OrdersService,
  ) {}

  @Get('tables') list() {
    return this.tables.listTables();
  }

  @Post('tables') create(@Body() dto: CreateTableDto) {
    return this.tables.createTable(dto);
  }

  @Delete('tables/:id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.tables.deleteTable(id);
  }

  @Post('tables/:id/items') addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: AddOrderItemDto) {
    return this.orders.addOrderItem(id, dto);
  }
}
