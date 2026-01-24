// src/entities/school.entity.ts
// import { Class } from 'src/students/entities/class.entity';
// import { GradeConfig } from 'src/students/entities/grade-config.entity';
// import { Student } from 'src/students/entities/student.entity';
// import { Subject } from 'src/students/entities/subject.entity';
// import { User } from 'src/users/user.entity';
import { Class } from '../../students/entities/class.entity';
import { GradeConfig } from '../../students/entities/grade-config.entity';
import { Student } from '../../students/entities/student.entity';
import { Subject } from '../../students/entities/subject.entity';
import { User } from '../../users/user.entity';

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';





@Entity('schools')
export class School {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    email: string;

    // Add these 3 new fields:
    @Column({ unique: true, nullable: true })
    adminEmail: string;           // School admin's login email

    @Column({ nullable: true })
    adminPassword: string;        // Hashed password for login

    @Column({ nullable: true })
    adminName: string;            // Admin's full name

    @Column({ nullable: true })
    phone?: string;

    @Column({ type: 'text', nullable: true })
    address?: string;

    @Column({ default: true })
    isActive: boolean;

    // Add this role field for school admin
    @Column({ default: 'school_admin' })
    role: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relations
    @OneToMany(() => User, user => user.school)
    users: User[];

    @OneToMany(() => Class, classEntity => classEntity.school)
    classes: Class[];

    @OneToMany(() => Student, student => student.school)
    students: Student[];

    @OneToMany(() => Subject, subject => subject.school)
    subjects: Subject[];

    @OneToMany(() => GradeConfig, gradeConfig => gradeConfig.school)
    gradeConfigs: GradeConfig[];
}