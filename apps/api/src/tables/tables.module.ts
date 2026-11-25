import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  imports: [OrdersModule],
  controllers: [TablesController],
  providers: [TablesService],
})
export class TablesModule {}
