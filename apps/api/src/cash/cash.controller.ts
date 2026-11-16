import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { dateRange } from '../common/period';
import { CashMovementDto, CloseCashDto, OpenCashDto } from './cash.dto';
import { CashService } from './cash.service';

// Rotas do caixa por turno (SPEC/2026-11-16-caixa-por-turno.md, RF-01 a RF-05).
@Controller('api/cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('current') current() {
    return this.cash.current();
  }

  @Post('open') open(@Body() dto: OpenCashDto) {
    return this.cash.open(dto);
  }

  @Post('withdrawals') withdraw(@Body() dto: CashMovementDto) {
    return this.cash.withdraw(dto);
  }

  @Post('deposits') deposit(@Body() dto: CashMovementDto) {
    return this.cash.deposit(dto);
  }

  @Post('close') close(@Body() dto: CloseCashDto) {
    return this.cash.close(dto);
  }

  @Get('sessions') sessions(@Query('from') from?: string, @Query('to') to?: string) {
    const [start, end] = dateRange(from, to);
    return this.cash.list(start, end);
  }

  @Get('sessions/:id') session(@Param('id', ParseIntPipe) id: number) {
    return this.cash.get(id);
  }
}
