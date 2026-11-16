import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ClosingsModule } from './closings/closings.module';
import { PrismaModule } from './prisma.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SalesReportsModule } from './sales-reports/sales-reports.module';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [PrismaModule, ReservationsModule, StockModule, PurchasingModule, ClosingsModule, SalesReportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
