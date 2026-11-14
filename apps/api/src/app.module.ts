import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { ReservationsModule } from './reservations/reservations.module';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [PrismaModule, ReservationsModule, StockModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
