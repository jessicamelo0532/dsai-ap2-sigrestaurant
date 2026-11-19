import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { dateRange } from '../common/period';
import { CreateExpenseDto, UpdateExpenseDto } from '../dto';
import { ExpensesService } from './expenses.service';

// Rotas das despesas (SPEC/2026-11-18-modulos-da-api.md, RF-04).
@Controller('api')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get('expenses') expenses(@Query('from') from?: string, @Query('to') to?: string) {
    const [start, end] = dateRange(from, to);
    return this.expensesService.listExpenses(start, end);
  }

  @Post('expenses') createExpense(@Body() dto: CreateExpenseDto) {
    return this.expensesService.createExpense(dto);
  }

  @Patch('expenses/:id') updateExpense(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.updateExpense(id, dto);
  }

  @Delete('expenses/:id') deleteExpense(@Param('id', ParseIntPipe) id: number) {
    return this.expensesService.deleteExpense(id);
  }
}
