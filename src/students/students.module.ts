import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import {
  StudentsController,
  AssessmentsController,
  ReportCardsController,
  SubjectsController,
  GradeConfigsController,
  ClassesController  // ADD THIS
} from './students.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from './entities/student.entity';
import { Assessment } from './entities/assessment.entity';
import { Subject } from './entities/subject.entity';
import { ReportCard } from './entities/report-card.entity';
import { GradeConfig } from './entities/grade-config.entity';
import { Class } from './entities/class.entity'; // ADD THIS
import { TeachersModule } from 'src/teachers/teachers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Student,
      Assessment,
      Subject,
      ReportCard,
      GradeConfig,
      Class // ADD THIS HERE,

    ]),
    TeachersModule,
  ],
  controllers: [
    StudentsController,
    AssessmentsController,
    ReportCardsController,
    SubjectsController,
    GradeConfigsController,
    ClassesController  // ADD THIS
  ],
  providers: [StudentsService],
})
export class StudentsModule { }

// import { Module } from '@nestjs/common';
// import { StudentsService } from './students.service';
// import {
//   StudentsController,
//   AssessmentsController,
//   ReportCardsController,
//   SubjectsController,
//   GradeConfigsController  // ADD THIS
// } from './students.controller';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { Student } from './entities/student.entity';
// import { Assessment } from './entities/assessment.entity';
// import { Subject } from './entities/subject.entity';
// import { ReportCard } from './entities/report-card.entity';
// import { GradeConfig } from './entities/grade-config.entity'; // ADD THIS

// @Module({
//   imports: [
//     TypeOrmModule.forFeature([
//       Student,
//       Assessment,
//       Subject,
//       ReportCard,
//       GradeConfig  // ADD THIS HERE
//     ])
//   ],
//   controllers: [
//     StudentsController,
//     AssessmentsController,
//     ReportCardsController,
//     SubjectsController,
//     GradeConfigsController  // ADD THIS
//   ],
//   providers: [StudentsService],
// })
// export class StudentsModule { }
