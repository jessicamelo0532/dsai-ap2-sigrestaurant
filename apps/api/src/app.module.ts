import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CashModule } from './cash/cash.module';
import { ClosingsModule } from './closings/closings.module';
import { CustomersModule } from './customers/customers.module';
import { DeliveryModule } from './delivery/delivery.module';
import { ExpensesModule } from './expenses/expenses.module';
import { GoalsModule } from './goals/goals.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { MenuAvailabilityModule } from './menu-availability/menu-availability.module';
import { MenuCategoriesModule } from './menu-categories/menu-categories.module';
import { MenuModule } from './menu/menu.module';
import { MenuOptionsModule } from './menu-options/menu-options.module';
import { OrderMovesModule } from './order-moves/order-moves.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { ReportsModule } from './reports/reports.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SalesReportsModule } from './sales-reports/sales-reports.module';
import { StockModule } from './stock/stock.module';
import { TablesModule } from './tables/tables.module';
import { WaitersModule } from './waiters/waiters.module';

import { OpeningHoursModule } from './opening-hours/opening-hours.module';
import { ReceivablesModule } from './receivables/receivables.module';
import { ZonesModule } from './zones/zones.module';

@Module({
  imports: [PrismaModule, ReservationsModule, StockModule, PurchasingModule, ClosingsModule, SalesReportsModule, CashModule, WaitersModule, OrderMovesModule, KitchenModule, CustomersModule, LoyaltyModule, MenuAvailabilityModule, MenuCategoriesModule, MenuOptionsModule, GoalsModule, DeliveryModule, OpeningHoursModule, ReceivablesModule, ZonesModule, OrdersModule, TablesModule, MenuModule, ExpensesModule, ReportsModule],
  controllers: [AppController],
})
export class AppModule {}
