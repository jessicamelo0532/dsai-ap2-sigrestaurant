import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { KitchenPriorityDto, SendToKitchenDto } from './kitchen.dto';
import { KitchenService } from './kitchen.service';

// Rotas da cozinha (SPEC/2026-11-16-cozinha-kds.md, RF-01 a RF-06).
@Controller('api')
export class KitchenController {
  constructor(private readonly kitchen: KitchenService) {}

  @Post('orders/:id/kitchen') send(@Param('id', ParseIntPipe) id: number, @Body() dto: SendToKitchenDto) {
    return this.kitchen.send(id, dto);
  }

  @Get('orders/:id/kitchen') listForOrder(@Param('id', ParseIntPipe) id: number) {
    return this.kitchen.listForOrder(id);
  }

  @Get('kitchen/queue') queue() {
    return this.kitchen.queue();
  }

  @Get('kitchen/tickets/:id') get(@Param('id', ParseIntPipe) id: number) {
    return this.kitchen.get(id);
  }

  @Post('kitchen/tickets/:id/start') start(@Param('id', ParseIntPipe) id: number) {
    return this.kitchen.advance(id, 'start');
  }

  @Post('kitchen/tickets/:id/ready') ready(@Param('id', ParseIntPipe) id: number) {
    return this.kitchen.advance(id, 'ready');
  }

  @Post('kitchen/tickets/:id/deliver') deliver(@Param('id', ParseIntPipe) id: number) {
    return this.kitchen.advance(id, 'deliver');
  }

  @Put('kitchen/tickets/:id/priority') priority(@Param('id', ParseIntPipe) id: number, @Body() dto: KitchenPriorityDto) {
    return this.kitchen.setPriority(id, dto);
  }
}
