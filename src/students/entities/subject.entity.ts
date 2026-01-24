// src/students/entities/subject.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Assessment } from './assessment.entity';
import { School } from '../../schools/entities/school.entity';

@Entity('subjects')
export class Subject {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column({ nullable: true })
    description: string;

    // ADD SCHOOL RELATION
    @ManyToOne(() => School, school => school.subjects, { nullable: true })
    @JoinColumn({ name: 'schoolId' })
    school?: School;

    @Column({ nullable: true })
    schoolId?: string;

    @OneToMany(() => Assessment, (assessment) => assessment.subject)
    assessments: Assessment[];
}