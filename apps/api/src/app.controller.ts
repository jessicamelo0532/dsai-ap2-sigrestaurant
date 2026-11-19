import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { dateRange } from './common/period';

@Controller('api')
export class AppController {
  constructor(private readonly app: AppService) {}

  @Get('health') health() { return { status: 'ok' }; }

  @Get('reports/financial') report(@Query('from') from?: string, @Query('to') to?: string) {
    const [start, end] = dateRange(from, to);
    return this.app.report(start, end);
  }
}
