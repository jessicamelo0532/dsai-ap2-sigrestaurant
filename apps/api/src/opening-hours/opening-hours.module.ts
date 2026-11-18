import { Module } from '@nestjs/common';
import { OpeningHoursController } from './opening-hours.controller';
import { OpeningHoursService } from './opening-hours.service';

@Module({
  controllers: [OpeningHoursController],
  providers: [OpeningHoursService],
})
export class OpeningHoursModule {}
