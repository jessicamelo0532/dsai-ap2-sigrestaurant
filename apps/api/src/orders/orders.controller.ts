import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CloseOrderDto, UpdateOrderItemDto } from '../dto';
import { OrdersService } from './orders.service';

// Rotas das comandas (SPEC/2026-11-18-modulos-da-api.md, RF-03).
// `orders/open` precisa vir antes de `orders/:id`.
@Controller('api')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders/open') open() {
    return this.orders.listOpenOrders();
  }

  @Get('orders/:id') get(@Param('id', ParseIntPipe) id: number) {
    return this.orders.getOrder(id);
  }

  @Patch('orders/:id/items/:itemId') updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.orders.updateOrderItem(id, itemId, dto);
  }

  @Delete('orders/:id/items/:itemId') removeItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.orders.removeOrderItem(id, itemId);
  }

  @Post('orders/:id/close') close(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseOrderDto) {
    return this.orders.closeOrder(id, dto);
  }

  @Post('orders/:id/cancel') cancel(@Param('id', ParseIntPipe) id: number) {
    return this.orders.cancelOrder(id);
  }
}
