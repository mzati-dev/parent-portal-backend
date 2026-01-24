import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { TeacherClassSubject } from './teacher-class-subject.entity';

@Entity('teachers')
export class Teacher {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column()
    school_id: string;

    @Column({ default: true })
    is_active: boolean;

    // ADD THIS - The relationship to the link table
    @OneToMany(() => TeacherClassSubject, teacherClassSubject => teacherClassSubject.teacher,)
    classSubjects: TeacherClassSubject[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}