import { Module } from '@nestjs/common';
import { MenuCategoriesController } from './menu-categories.controller';
import { MenuCategoriesService } from './menu-categories.service';

@Module({
  controllers: [MenuCategoriesController],
  providers: [MenuCategoriesService],
})
export class MenuCategoriesModule {}
