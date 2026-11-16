import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { LoyaltySettingsDto, RedeemPointsDto } from './loyalty.dto';
import { LoyaltyService } from './loyalty.service';

// Rotas da fidelidade (SPEC/2026-11-16-programa-de-fidelidade.md, RF-01 a RF-04).
@Controller('api')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get('loyalty/settings') settings() {
    return this.loyalty.getSettings();
  }

  @Put('loyalty/settings') updateSettings(@Body() dto: LoyaltySettingsDto) {
    return this.loyalty.updateSettings(dto);
  }

  @Get('customers/:id/loyalty') customer(@Param('id', ParseIntPipe) id: number) {
    return this.loyalty.customerLoyalty(id);
  }

  @Post('orders/:id/loyalty') redeem(@Param('id', ParseIntPipe) id: number, @Body() dto: RedeemPointsDto) {
    return this.loyalty.redeem(id, dto);
  }

  @Delete('orders/:id/loyalty') undo(@Param('id', ParseIntPipe) id: number) {
    return this.loyalty.undo(id);
  }
}
