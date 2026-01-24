// src/teachers/entities/teacher-class-subject.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Teacher } from './teacher.entity';
import { Class } from '../../students/entities/class.entity';
import { Subject } from '../../students/entities/subject.entity';
// import { Class } from '../../classes/entities/class.entity';
// import { Subject } from '../../subjects/entities/subject.entity';

@Entity('teacher_class_subjects')
export class TeacherClassSubject {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'teacher_id' })
    teacherId: string;

    @Column({ name: 'class_id' })
    classId: string;

    @Column({ name: 'subject_id' })
    subjectId: string;

    @ManyToOne(() => Teacher, teacher => teacher.classSubjects)
    @JoinColumn({ name: 'teacher_id' })
    teacher: Teacher;

    @ManyToOne(() => Class)
    @JoinColumn({ name: 'class_id' })
    class: Class;

    @ManyToOne(() => Subject)
    @JoinColumn({ name: 'subject_id' })
    subject: Subject;

    @CreateDateColumn()
    createdAt: Date;
}