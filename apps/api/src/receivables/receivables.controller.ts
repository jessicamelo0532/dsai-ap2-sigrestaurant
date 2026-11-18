import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ReceiveDto, SellOnAccountDto } from './receivables.dto';
import { ReceivablesService } from './receivables.service';

// Rotas das contas a receber (SPEC/2026-11-17-contas-a-receber.md, RF-01 a RF-03).
@Controller('api')
export class ReceivablesController {
  constructor(private readonly receivables: ReceivablesService) {}

  @Post('orders/:id/on-account') sellOnAccount(@Param('id', ParseIntPipe) id: number, @Body() dto: SellOnAccountDto) {
    return this.receivables.sellOnAccount(id, dto);
  }

  @Get('receivables') list(@Query('status') status?: string) {
    return this.receivables.list(status);
  }

  @Post('receivables/:id/receive') receive(@Param('id', ParseIntPipe) id: number, @Body() dto: ReceiveDto) {
    return this.receivables.receive(id, dto);
  }
}
