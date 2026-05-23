import { Module } from '@nestjs/common';

import { PrismaModule } from '~/prisma/prisma.module';
import { SubcategoryController } from './subcategory.controller';
import { SubcategoryService } from './subcategory.service';

@Module({
  controllers: [SubcategoryController],
  exports: [SubcategoryService],
  imports: [PrismaModule],
  providers: [SubcategoryService],
})
export class SubcategoryModule {}
