import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CloseMonthDto, ReopenMonthDto } from './closings.dto';
import { ClosingsService } from './closings.service';

// Rotas do fechamento mensal (SPEC/2026-11-16-fechamento-mensal.md, RF-01 a RF-04).
@Controller('api/closings')
export class ClosingsController {
  constructor(private readonly closings: ClosingsService) {}

  @Get() list() {
    return this.closings.list();
  }

  @Get(':month') month(@Param('month') month: string) {
    return this.closings.getMonth(month);
  }

  @Post() close(@Body() dto: CloseMonthDto) {
    return this.closings.close(dto);
  }

  @Post(':month/reopen') reopen(@Param('month') month: string, @Body() dto: ReopenMonthDto) {
    return this.closings.reopen(month, dto);
  }
}
