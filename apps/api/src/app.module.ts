import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CashModule } from './cash/cash.module';
import { ClosingsModule } from './closings/closings.module';
import { CustomersModule } from './customers/customers.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { MenuAvailabilityModule } from './menu-availability/menu-availability.module';
import { MenuCategoriesModule } from './menu-categories/menu-categories.module';
import { OrderMovesModule } from './order-moves/order-moves.module';
import { PrismaModule } from './prisma.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SalesReportsModule } from './sales-reports/sales-reports.module';
import { StockModule } from './stock/stock.module';
import { WaitersModule } from './waiters/waiters.module';

@Module({
  imports: [PrismaModule, ReservationsModule, StockModule, PurchasingModule, ClosingsModule, SalesReportsModule, CashModule, WaitersModule, OrderMovesModule, KitchenModule, CustomersModule, LoyaltyModule, MenuAvailabilityModule, MenuCategoriesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
