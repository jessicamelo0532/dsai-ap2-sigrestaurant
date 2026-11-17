import { Controller, Get, Query } from '@nestjs/common';
import { dateRange } from '../common/period';
import { parseLimit } from './sales-rules';
import { SalesReportsService } from './sales-reports.service';

// Rota dos relatórios de vendas (SPEC/2026-11-16-relatorios-de-vendas.md, RF-01).
@Controller('api/reports')
export class SalesReportsController {
  constructor(private readonly reports: SalesReportsService) {}

  @Get('sales') sales(@Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit?: string) {
    const [start, end] = dateRange(from, to);
    return this.reports.report(start, end, parseLimit(limit));
  }
}
