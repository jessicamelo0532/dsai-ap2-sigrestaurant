import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { AssignCustomerDto, CreateCustomerDto, UpdateCustomerDto } from './customers.dto';
import { CustomersService } from './customers.service';

// Rotas de clientes (SPEC/2026-11-16-clientes-e-historico.md, RF-01 a RF-05).
@Controller('api')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('customers') list(@Query('search') search?: string, @Query('all') all?: string) {
    return this.customers.list(search, all === 'true');
  }

  @Get('customers/:id') get(@Param('id', ParseIntPipe) id: number) {
    return this.customers.get(id);
  }

  @Post('customers') create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch('customers/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Get('customers/:id/history') history(
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.customers.history(id, from, to);
  }

  @Put('orders/:id/customer') assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignCustomerDto) {
    return this.customers.assignToOrder(id, dto);
  }
}
