import { Module } from '@nestjs/common';
import { MenuAvailabilityController } from './menu-availability.controller';
import { MenuAvailabilityService } from './menu-availability.service';

@Module({
  controllers: [MenuAvailabilityController],
  providers: [MenuAvailabilityService],
})
export class MenuAvailabilityModule {}
