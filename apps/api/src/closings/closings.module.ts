import { Module } from '@nestjs/common';
import { ClosingsController } from './closings.controller';
import { ClosingsService } from './closings.service';

@Module({
  controllers: [ClosingsController],
  providers: [ClosingsService],
})
export class ClosingsModule {}
