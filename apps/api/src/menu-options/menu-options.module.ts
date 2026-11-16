import { Module } from '@nestjs/common';
import { MenuOptionsController } from './menu-options.controller';
import { MenuOptionsService } from './menu-options.service';

@Module({
  controllers: [MenuOptionsController],
  providers: [MenuOptionsService],
})
export class MenuOptionsModule {}
