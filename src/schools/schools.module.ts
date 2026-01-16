// src/schools/school.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from './entities/school.entity';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
// import { School } from '../entities/school.entity';
// import { SchoolService } from './school.service';
// import { SchoolController } from './school.controller';

@Module({
  imports: [TypeOrmModule.forFeature([School])],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule { }