import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';
import { Teacher } from './entities/teacher.entity';
import { TeacherClassSubject } from './entities/teacher-class-subject.entity';
import { Class } from '../students/entities/class.entity';
import { Subject } from '../students/entities/subject.entity';
import { Student } from '../students/entities/student.entity';
// import { Teacher } from './entities/teacher.entity';


@Module({
  imports: [TypeOrmModule.forFeature([
    Teacher,
    // ===== START: NEW ENTITIES =====
    TeacherClassSubject,
    Class,
    Subject,
    Student,
    // ===== END: NEW ENTITIES =====
  ])],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule { }