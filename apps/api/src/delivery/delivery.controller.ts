import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AddOrderItemDto } from '../dto';
import { CreateDeliveryDto, UpdateDeliveryDto } from './delivery.dto';
import { DeliveryService } from './delivery.service';

// Rotas do delivery (SPEC/2026-11-16-delivery.md, RF-01 a RF-04).
@Controller('api/delivery-orders')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post() create(@Body() dto: CreateDeliveryDto) {
    return this.delivery.create(dto);
  }

  @Get() list(@Query('status') status?: string) {
    return this.delivery.list(status);
  }

  @Get(':id') get(@Param('id', ParseIntPipe) id: number) {
    return this.delivery.get(id);
  }

  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDeliveryDto) {
    return this.delivery.update(id, dto);
  }

  @Post(':id/items') addItem(@Param('id', ParseIntPipe) id: number, @Body() dto: AddOrderItemDto) {
    return this.delivery.addItem(id, dto);
  }

  @Post(':id/dispatch') dispatch(@Param('id', ParseIntPipe) id: number) {
    return this.delivery.advance(id, 'dispatch');
  }

  @Post(':id/delivered') delivered(@Param('id', ParseIntPipe) id: number) {
    return this.delivery.advance(id, 'deliver');
  }
}
