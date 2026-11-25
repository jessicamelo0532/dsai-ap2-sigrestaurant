import { Controller, Get, Query } from '@nestjs/common';
import { dateRange } from '../common/period';
import { ReportsService } from './reports.service';

// Relatório financeiro (SPEC/2026-11-18-modulos-da-api.md, RF-04).
@Controller('api')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/financial') report(@Query('from') from?: string, @Query('to') to?: string) {
    const [start, end] = dateRange(from, to);
    return this.reports.report(start, end);
  }
}
