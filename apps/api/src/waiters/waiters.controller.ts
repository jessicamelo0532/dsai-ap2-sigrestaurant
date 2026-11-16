import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { dateRange } from '../common/period';
import { AssignWaiterDto, CreateWaiterDto, UpdateWaiterDto } from './waiters.dto';
import { WaitersService } from './waiters.service';

// Rotas de garçons (SPEC/2026-11-16-garcons-e-comissao.md, RF-01 a RF-03).
@Controller('api')
export class WaitersController {
  constructor(private readonly waiters: WaitersService) {}

  @Get('waiters') list(@Query('all') all?: string) {
    return this.waiters.list(all === 'true');
  }

  @Get('waiters/:id') get(@Param('id', ParseIntPipe) id: number) {
    return this.waiters.get(id);
  }

  @Post('waiters') create(@Body() dto: CreateWaiterDto) {
    return this.waiters.create(dto);
  }

  @Patch('waiters/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWaiterDto) {
    return this.waiters.update(id, dto);
  }

  @Delete('waiters/:id') remove(@Param('id', ParseIntPipe) id: number) {
    return this.waiters.remove(id);
  }

  @Put('orders/:id/waiter') assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignWaiterDto) {
    return this.waiters.assign(id, dto);
  }

  @Get('reports/waiters') report(@Query('from') from?: string, @Query('to') to?: string) {
    const [start, end] = dateRange(from, to);
    return this.waiters.report(start, end);
  }
}
