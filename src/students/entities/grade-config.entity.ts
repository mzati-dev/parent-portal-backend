// src/students/entities/grade-config.entity.ts
import { School } from '../../schools/entities/school.entity';
import { Entity, PrimaryGeneratedColumn, Column, Unique, ManyToOne, JoinColumn } from 'typeorm';

@Entity('grade_configs')
@Unique(['school_id', 'configuration_name'])
export class GradeConfig {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // @Column({ default: 'school-1' })
    // school_id: string;

    // ADD SCHOOL RELATION HERE
    @ManyToOne(() => School, school => school.gradeConfigs, { nullable: true })
    @JoinColumn({ name: 'school_id' })
    school?: School;

    @Column({ nullable: true })
    school_id: string; // ADD THIS LINE BACK

    @Column()
    configuration_name: string;

    @Column({
        type: 'enum',
        enum: ['average_all', 'end_of_term_only', 'weighted_average'],
        default: 'weighted_average'
    })
    calculation_method: 'average_all' | 'end_of_term_only' | 'weighted_average';

    @Column({ type: 'int', default: 30 })
    weight_qa1: number;

    @Column({ type: 'int', default: 30 })
    weight_qa2: number;

    @Column({ type: 'int', default: 40 })
    weight_end_of_term: number;

    @Column({ type: 'int', default: 50 })
    pass_mark: number;

    @Column({ default: false })
    is_active: boolean;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updated_at: Date;
}