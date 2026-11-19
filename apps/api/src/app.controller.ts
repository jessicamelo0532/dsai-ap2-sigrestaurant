import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { dateRange } from './common/period';
import { CreateExpenseDto, CreateMenuItemDto, UpdateExpenseDto, UpdateMenuItemDto } from './dto';

@Controller('api')
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get('health') health() { return { status: 'ok' }; }

  @Get('menu-items') menu(@Query('all') all?: string) { return this.app.listMenu(all === 'true'); }
  @Get('menu-items/:id') menuItem(@Param('id', ParseIntPipe) id: number) { return this.app.getMenuItem(id); }
  @Post('menu-items') createMenu(@Body() dto: CreateMenuItemDto) { return this.app.createMenuItem(dto); }
  @Patch('menu-items/:id') updateMenu(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuItemDto) { return this.app.updateMenuItem(id, dto); }
  @Delete('menu-items/:id') deleteMenu(@Param('id', ParseIntPipe) id: number) { return this.app.deleteMenuItem(id); }

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
