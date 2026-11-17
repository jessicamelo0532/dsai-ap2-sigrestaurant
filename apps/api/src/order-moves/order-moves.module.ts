import { Module } from '@nestjs/common';
import { OrderMovesController } from './order-moves.controller';
import { OrderMovesService } from './order-moves.service';

@Module({
  controllers: [OrderMovesController],
  providers: [OrderMovesService],
})
export class OrderMovesModule {}
