import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { AddOrderItemDto, CloseOrderDto, CreateExpenseDto, CreateMenuItemDto, CreateTableDto, UpdateExpenseDto, UpdateMenuItemDto, UpdateOrderItemDto } from './dto';

function dateRange(from?: string, to?: string) {
  const valid = (value?: string) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!valid(from) || !valid(to)) throw new BadRequestException('Informe datas válidas no formato AAAA-MM-DD.');
  const start = new Date(`${from}T00:00:00.000Z`);
  const endInclusive = new Date(`${to}T00:00:00.000Z`);
  if (start > endInclusive) throw new BadRequestException('A data inicial deve ser anterior ou igual à data final.');
  endInclusive.setUTCDate(endInclusive.getUTCDate() + 1);
  return [start, endInclusive] as const;
}

@Controller('api')
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get('health') health() { return { status: 'ok' }; }

  @Get('tables') tables() { return this.app.listTables(); }
  @Post('tables') createTable(@Body() dto: CreateTableDto) { return this.app.createTable(dto); }
  @Delete('tables/:id') deleteTable(@Param('id', ParseIntPipe) id: number) { return this.app.deleteTable(id); }
  @Post('tables/:id/items') addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: AddOrderItemDto) { return this.app.addOrderItem(id, dto); }

  @Get('menu-items') menu(@Query('all') all?: string) { return this.app.listMenu(all === 'true'); }
  @Get('menu-items/:id') menuItem(@Param('id', ParseIntPipe) id: number) { return this.app.getMenuItem(id); }
  @Post('menu-items') createMenu(@Body() dto: CreateMenuItemDto) { return this.app.createMenuItem(dto); }
  @Patch('menu-items/:id') updateMenu(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuItemDto) { return this.app.updateMenuItem(id, dto); }
  @Delete('menu-items/:id') deleteMenu(@Param('id', ParseIntPipe) id: number) { return this.app.deleteMenuItem(id); }

  @Get('orders/open') openOrders() { return this.app.listOpenOrders(); }
  @Get('orders/:id') order(@Param('id', ParseIntPipe) id: number) { return this.app.getOrder(id); }
  @Patch('orders/:id/items/:itemId') updateOrderItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number, @Body() dto: UpdateOrderItemDto) {
    return this.app.updateOrderItem(id, itemId, dto);
  }
  @Delete('orders/:id/items/:itemId') removeOrderItem(@Param('id', ParseIntPipe) id: number, @Param('itemId', ParseIntPipe) itemId: number) {
    return this.app.removeOrderItem(id, itemId);
  }
  @Post('orders/:id/close') closeOrder(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseOrderDto) { return this.app.closeOrder(id, dto); }
  @Post('orders/:id/cancel') cancelOrder(@Param('id', ParseIntPipe) id: number) { return this.app.cancelOrder(id); }

  @Get('expenses') expenses(@Query('from') from?: string, @Query('to') to?: string) {
    const [start, end] = dateRange(from, to);
    return this.app.listExpenses(start, end);
  }
  @Post('expenses') createExpense(@Body() dto: CreateExpenseDto) { return this.app.createExpense(dto); }
  @Patch('expenses/:id') updateExpense(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) { return this.app.updateExpense(id, dto); }
  @Delete('expenses/:id') deleteExpense(@Param('id', ParseIntPipe) id: number) { return this.app.deleteExpense(id); }

  @Get('reports/financial') report(@Query('from') from?: string, @Query('to') to?: string) {
    const [start, end] = dateRange(from, to);
    return this.app.report(start, end);
  }
}
