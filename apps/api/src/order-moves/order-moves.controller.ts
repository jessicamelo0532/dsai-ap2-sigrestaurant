import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { MergeOrderDto, TransferOrderDto } from './order-moves.dto';
import { OrderMovesService } from './order-moves.service';

// Rotas de transferência e junção (SPEC/2026-11-16-transferencia-e-juncao-de-comandas.md, RF-01 a RF-03).
@Controller('api/orders')
export class OrderMovesController {
  constructor(private readonly moves: OrderMovesService) {}

  @Post(':id/transfer') transfer(@Param('id', ParseIntPipe) id: number, @Body() dto: TransferOrderDto) {
    return this.moves.transfer(id, dto);
  }

  @Post(':id/merge') merge(@Param('id', ParseIntPipe) id: number, @Body() dto: MergeOrderDto) {
    return this.moves.merge(id, dto);
  }

  @Get(':id/history') history(@Param('id', ParseIntPipe) id: number) {
    return this.moves.history(id);
  }
}
