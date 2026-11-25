import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { dateRange } from './common/period';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';

@Controller('api')
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get('health') health() { return { status: 'ok' }; }

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
