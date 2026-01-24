// src/students/entities/assessment.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';
import { Student } from './student.entity';
import { Subject } from './subject.entity';
import { Class } from './class.entity';

@Entity('assessments')
@Unique(['student', 'subject', 'assessmentType', 'class']) // Add class to unique constraint
export class Assessment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    assessmentType: 'qa1' | 'qa2' | 'end_of_term';

    @Column('int')
    score: number;

    @Column()
    grade: string;

    @ManyToOne(() => Student, (student) => student.assessments, { onDelete: 'CASCADE' })
    student: Student;

    @ManyToOne(() => Subject, (subject) => subject.assessments, { onDelete: 'CASCADE' })
    subject: Subject;

    @ManyToOne(() => Class, (cls) => cls.assessments, { onDelete: 'CASCADE' })
    class: Class; // ADD THIS LINE

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;
}


// // src/students/entities/assessment.entity.ts
// import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';
// import { Student } from './student.entity';
// import { Subject } from './subject.entity';

// @Entity('assessments')
// @Unique(['student', 'subject', 'assessmentType']) // Prevent duplicate assessments
// export class Assessment {
//     @PrimaryGeneratedColumn('uuid')
//     id: string;

//     @Column()
//     assessmentType: 'qa1' | 'qa2' | 'end_of_term';

//     @Column('int')
//     score: number;

//     @Column()
//     grade: string;

//     @ManyToOne(() => Student, (student) => student.assessments, { onDelete: 'CASCADE' })
//     student: Student;

//     @ManyToOne(() => Subject, (subject) => subject.assessments, { onDelete: 'CASCADE' })
//     subject: Subject;

//     @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
//     createdAt: Date;

//     @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
//     updatedAt: Date;
// }

// // src/students/entities/assessment.entity.ts
// import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
// import { Student } from './student.entity';

// @Entity('assessments')
// export class Assessment {
//     @PrimaryGeneratedColumn('uuid')
//     id: string;

//     @Column()
//     subjectName: string;

//     @Column()
//     assessmentType: 'qa1' | 'qa2' | 'end_of_term';

//     @Column('int')
//     score: number;

//     @Column()
//     grade: string;

//     @ManyToOne(() => Student, (student) => student.assessments)
//     student: Student;
// }