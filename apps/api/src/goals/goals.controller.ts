import { Body, Controller, Delete, Get, Param, Put, Query } from '@nestjs/common';
import { SetGoalDto } from './goals.dto';
import { GoalsService } from './goals.service';

// Rotas de metas e comparativo (SPEC/2026-11-16-metas-de-vendas.md, RF-01 a RF-03).
@Controller('api')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('goals') list(@Query('year') year?: string) {
    return this.goals.list(year);
  }

  @Put('goals/:month') set(@Param('month') month: string, @Body() dto: SetGoalDto) {
    return this.goals.set(month, dto);
  }

  @Delete('goals/:month') remove(@Param('month') month: string) {
    return this.goals.remove(month);
  }

  @Get('goals/:month/progress') progress(@Param('month') month: string) {
    return this.goals.progress(month);
  }

  @Get('reports/compare') compare(@Query('from') from?: string, @Query('to') to?: string) {
    return this.goals.compare(from, to);
  }
}
