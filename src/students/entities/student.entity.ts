// src/students/entities/student.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { Assessment } from './assessment.entity';
import { ReportCard } from './report-card.entity';
import { Class } from './class.entity';
import { School } from '../../schools/entities/school.entity';


@Entity('students')
export class Student {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    examNumber: string;

    @Column()
    name: string;

    // CLASS RELATION
    @ManyToOne(() => Class, (cls) => cls.students, { nullable: true })
    @JoinColumn({ name: 'class_id' })
    class?: Class; // Make optional

    // @Column({ nullable: true })
    // classId?: string; // ADD THIS COLUMN

    @Column({ nullable: true })
    photoUrl: string;

    // SCHOOL RELATION - ADD THIS
    @ManyToOne(() => School, school => school.students, { nullable: true })
    @JoinColumn({ name: 'schoolId' })
    school?: School;

    @Column({ nullable: true })
    schoolId?: string;

    @OneToMany(() => Assessment, (assessment) => assessment.student)
    assessments: Assessment[];

    @OneToMany(() => ReportCard, (reportCard) => reportCard.student)
    reportCards: ReportCard[];

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}


// // src/students/entities/student.entity.ts
// import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
// import { Assessment } from './assessment.entity';
// import { ReportCard } from './report-card.entity';
// import { Class } from './class.entity';  // ADD THIS IMPORT

// @Entity('students')
// export class Student {
//     @PrimaryGeneratedColumn('uuid')
//     id: string;

//     @Column({ unique: true })
//     examNumber: string;

//     @Column()
//     name: string;

//     // REMOVE THESE 2 COLUMNS:
//     // @Column()
//     // class: string;

//     // @Column()
//     // term: string;

//     // ADD THIS INSTEAD:
//     @ManyToOne(() => Class, (cls) => cls.students)
//     @JoinColumn({ name: 'class_id' })
//     class: Class;

//     @Column({ nullable: true })
//     photoUrl: string;

//     @OneToMany(() => Assessment, (assessment) => assessment.student)
//     assessments: Assessment[];

//     @OneToMany(() => ReportCard, (reportCard) => reportCard.student)
//     reportCards: ReportCard[];

//     @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
//     createdAt: Date;

//     @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
//     updatedAt: Date;
// }

// // src/students/entities/student.entity.ts
// import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
// import { Assessment } from './assessment.entity';
// import { ReportCard } from './report-card.entity';

// @Entity('students')
// export class Student {
//     @PrimaryGeneratedColumn('uuid')
//     id: string;

//     @Column({ unique: true })
//     examNumber: string;

//     @Column()
//     name: string;

//     @Column()
//     class: string;

//     @Column()
//     term: string;

//     @Column({ nullable: true })
//     photoUrl: string;

//     @OneToMany(() => Assessment, (assessment) => assessment.student)
//     assessments: Assessment[];

//     @OneToMany(() => ReportCard, (reportCard) => reportCard.student)
//     reportCards: ReportCard[];

//     @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
//     createdAt: Date;

//     @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
//     updatedAt: Date;
// }




// // src/students/entities/student.entity.ts
// import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
// import { Assessment } from './assessment.entity';

// @Entity('students')
// export class Student {
//     @PrimaryGeneratedColumn('uuid')
//     id: string;

//     @Column({ unique: true })
//     examNumber: string;

//     @Column()
//     name: string;

//     @Column()
//     class: string;

//     @Column()
//     term: string;

//     @Column({ nullable: true })
//     photoUrl: string;

//     // --- ADD THESE NEW COLUMNS ---
//     @Column({ default: 0 })
//     daysPresent: number;

//     @Column({ default: 0 })
//     daysAbsent: number;

//     @Column({ default: 0 })
//     daysLate: number;

//     @Column({ default: 0 })
//     classRank: number;

//     @Column({ default: 0 })
//     totalStudents: number;

//     @Column({ type: 'text', nullable: true })
//     teacherRemarks: string;
//     // -----------------------------

//     @OneToMany(() => Assessment, (assessment) => assessment.student)
//     assessments: Assessment[];
// }