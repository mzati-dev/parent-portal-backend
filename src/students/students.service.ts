import { ConflictException, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { Assessment } from './entities/assessment.entity';
import { ReportCard } from './entities/report-card.entity';
import { Subject } from './entities/subject.entity';
import { GradeConfig } from './entities/grade-config.entity';
import { Class } from './entities/class.entity';
import { TeacherClassSubject } from 'src/teachers/entities/teacher-class-subject.entity';
import { TeachersService } from 'src/teachers/teachers.service';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private studentRepository: Repository<Student>,
    @InjectRepository(Assessment)
    private assessmentRepository: Repository<Assessment>,
    @InjectRepository(ReportCard)
    private reportCardRepository: Repository<ReportCard>,
    @InjectRepository(Subject)
    private subjectRepository: Repository<Subject>,
    @InjectRepository(GradeConfig)
    private gradeConfigRepository: Repository<GradeConfig>,
    @InjectRepository(Class)
    private classRepository: Repository<Class>,
    private teachersService: TeachersService,
  ) { }

  // ===== START MODIFIED: Added schoolId parameter =====
  async findByExamNumber(examNumber: string, schoolId?: string) {
    const query = this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.assessments', 'assessments')
      .leftJoinAndSelect('assessments.subject', 'subject')
      .leftJoinAndSelect('student.reportCards', 'reportCards')
      .leftJoinAndSelect('student.class', 'class')
      .where('student.examNumber = :examNumber', { examNumber: examNumber })
    // .where('student.examNumber = :examNumber', { examNumber: examNumber.toUpperCase() });

    // if (schoolId) {
    //   query.andWhere('student.schoolId = :schoolId', { schoolId });
    // }

    const student = await query.getOne();

    if (!student) {
      throw new NotFoundException(`Student ${examNumber} not found`);
    }

    // const activeGradeConfig = await this.getActiveGradeConfiguration(schoolId);
    const activeGradeConfig = await this.getActiveGradeConfiguration(student.schoolId);
    return this.formatStudentData(student, activeGradeConfig);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async getActiveGradeConfiguration(schoolId?: string) {
    const query = this.gradeConfigRepository
      .createQueryBuilder('config')
      .where('config.is_active = true');

    if (schoolId) {
      query.andWhere('config.school_id = :schoolId', { schoolId });
    }

    const config = await query.getOne();

    if (!config) {
      return {
        id: 'default',
        configuration_name: 'Default (End of Term Only)',  // Updated name
        calculation_method: 'end_of_term_only',  // ← NEW DEFAULT
        weight_qa1: 0,  // Can set to 0 since they're not used
        weight_qa2: 0,
        weight_end_of_term: 100,  // Only end term matters
        pass_mark: 50,
        is_active: true,
        school_id: schoolId || null,
      };
    }

    return config;
  }
  // ===== END MODIFIED =====

  // ===== NO CHANGES =====
  private formatStudentData(student: Student, gradeConfig: any) {
    const subjectMap = {};

    student.assessments?.forEach((asm) => {
      const subjectName = asm.subject?.name || 'Unknown';
      if (!subjectMap[subjectName]) {
        subjectMap[subjectName] = {
          name: subjectName,
          qa1: 0,
          qa2: 0,
          endOfTerm: 0,
          grade: 'N/A',
        };
      }

      if (asm.assessmentType === 'qa1') {
        subjectMap[subjectName].qa1 = asm.score;
      } else if (asm.assessmentType === 'qa2') {
        subjectMap[subjectName].qa2 = asm.score;
      } else if (asm.assessmentType === 'end_of_term') {
        subjectMap[subjectName].endOfTerm = asm.score;
        subjectMap[subjectName].grade = this.calculateGrade(asm.score, gradeConfig);
      }
    });

    Object.values(subjectMap).forEach((subject: any) => {
      subject.finalScore = this.calculateFinalScore(subject, gradeConfig, student.assessments);
      subject.grade = this.calculateGrade(subject.finalScore, gradeConfig);
    });

    const activeReport = student.reportCards?.[0] || {};

    const className = student.class ? student.class.name : 'Unknown';
    const term = student.class ? student.class.term : 'Term 1, 2024/2025';
    const academicYear = student.class ? student.class.academic_year : '2024/2025';

    const response: any = {
      id: student.id,
      name: student.name,
      examNumber: student.examNumber,
      class: className,
      term: term,
      academicYear: academicYear,
      photo: student.photoUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
      subjects: Object.values(subjectMap),
      attendance: {
        present: activeReport.daysPresent || 0,
        absent: activeReport.daysAbsent || 0,
        late: activeReport.daysLate || 0,
      },
      classRank: activeReport.classRank || 0,
      qa1Rank: activeReport.qa1Rank || 0,
      qa2Rank: activeReport.qa2Rank || 0,
      totalStudents: activeReport.totalStudents || 0,
      teacherRemarks: activeReport.teacherRemarks || 'No remarks available.',
      gradeConfiguration: gradeConfig,
    };

    response.assessmentStats = this.calculateAssessmentStats(response, gradeConfig);

    return response;
  }
  // ===== END NO CHANGES =====

  // ===== NO CHANGES =====
  private calculateFinalScore(subject: any, gradeConfig: any, studentAssessments?: any[]): number {
    const qa1 = subject.qa1 || 0;
    const qa2 = subject.qa2 || 0;
    const endOfTerm = subject.endOfTerm || 0;

    if (studentAssessments) {
      const hasQA1 = studentAssessments.some(a => a.assessmentType === 'qa1' && a.score > 0);
      const hasQA2 = studentAssessments.some(a => a.assessmentType === 'qa2' && a.score > 0);
      const hasEndOfTerm = studentAssessments.some(a => a.assessmentType === 'end_of_term' && a.score > 0);

      if ((hasQA1 || hasQA2) && !hasEndOfTerm) {
        return endOfTerm;
      }
    }

    switch (gradeConfig.calculation_method) {
      case 'average_all':
        return (qa1 + qa2 + endOfTerm) / 3;
      case 'end_of_term_only':
        return endOfTerm;
      case 'weighted_average':
        return (qa1 * gradeConfig.weight_qa1 +
          qa2 * gradeConfig.weight_qa2 +
          endOfTerm * gradeConfig.weight_end_of_term) / 100;
      default:
        return (qa1 + qa2 + endOfTerm) / 3;
    }
  }
  // ===== END NO CHANGES =====

  // ===== NO CHANGES =====
  private calculateAssessmentStats(studentData: any, gradeConfig: any) {
    const subjects = studentData.subjects;

    const qa1Average = subjects.reduce((sum, s) => sum + s.qa1, 0) / subjects.length;
    const qa2Average = subjects.reduce((sum, s) => sum + s.qa2, 0) / subjects.length;
    const endOfTermAverage = subjects.reduce((sum, s) => sum + s.endOfTerm, 0) / subjects.length;

    const qa1Grade = this.calculateGrade(qa1Average, gradeConfig);
    const qa2Grade = this.calculateGrade(qa2Average, gradeConfig);
    const endOfTermGrade = this.calculateGrade(endOfTermAverage, gradeConfig);

    let overallAverage = (qa1Average + qa2Average + endOfTermAverage) / 3;
    if (gradeConfig) {
      overallAverage = this.calculateFinalScore(
        { qa1: qa1Average, qa2: qa2Average, endOfTerm: endOfTermAverage },
        gradeConfig
      );
    }

    return {
      qa1: {
        classRank: studentData.qa1Rank || 0,
        termAverage: parseFloat(qa1Average.toFixed(1)),
        overallGrade: qa1Grade,
      },
      qa2: {
        classRank: studentData.qa2Rank || 0,
        termAverage: parseFloat(qa2Average.toFixed(1)),
        overallGrade: qa2Grade,
      },
      endOfTerm: {
        classRank: studentData.classRank,
        termAverage: parseFloat(endOfTermAverage.toFixed(1)),
        overallGrade: endOfTermGrade,
        attendance: studentData.attendance
      },
      overall: {
        termAverage: parseFloat(overallAverage.toFixed(1)),
        calculationMethod: gradeConfig?.calculation_method || 'average_all'
      }
    };
  }
  // ===== END NO CHANGES =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async findAll(schoolId?: string) {
    const query = this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.class', 'class')
      .orderBy('student.examNumber', 'ASC');

    if (schoolId) {
      query.where('student.schoolId = :schoolId', { schoolId });
    }

    return query.getMany();
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async findAllSubjects(schoolId?: string) {
    const query = this.subjectRepository
      .createQueryBuilder('subject')
      .select(['subject.id', 'subject.name'])
      .orderBy('subject.name', 'ASC');

    if (schoolId) {
      query.where('subject.schoolId = :schoolId', { schoolId });
    }

    return query.getMany();
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async create(studentData: any, schoolId?: string) {
    const classEntity = await this.classRepository.findOne({
      where: {
        id: studentData.class_id,
        ...(schoolId && { schoolId })
      }
    });

    if (!classEntity) {
      throw new NotFoundException(`Class ${studentData.class_id} not found in your school`);
    }

    const currentYear = new Date().getFullYear().toString().slice(-2);
    const classNumberMatch = classEntity.name.match(/\d+/);
    const classNumber = classNumberMatch ? classNumberMatch[0] : '0';
    const prefix = `${schoolId ? schoolId.substring(0, 3) : 'SCH'}-${currentYear}-${classNumber}`;

    const allStudents = await this.studentRepository.find({
      select: ['examNumber'],
      where: {
        examNumber: Like(`${prefix}%`),
        ...(schoolId && { schoolId })
      },
      order: { examNumber: 'DESC' },
      take: 1
    });

    let nextNumber = 1;
    if (allStudents.length > 0 && allStudents[0].examNumber) {
      const lastExamNumber = allStudents[0].examNumber;
      const lastNumberStr = lastExamNumber.slice(prefix.length);
      const lastNumber = parseInt(lastNumberStr) || 0;
      nextNumber = lastNumber + 1;
    }

    const examNumber = `${schoolId ? schoolId.substring(0, 3) : 'SCH'}-${currentYear}-${classNumber}${nextNumber.toString().padStart(3, '0')}`;

    const student = this.studentRepository.create({
      name: studentData.name,
      examNumber: examNumber,
      class: classEntity,
      photoUrl: studentData.photo_url,
      schoolId: schoolId,
    });

    return this.studentRepository.save(student);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async update(id: string, updates: any, schoolId?: string) {
    const query = this.studentRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.class', 'class')
      .where('student.id = :id', { id });

    if (schoolId) {
      query.andWhere('student.schoolId = :schoolId', { schoolId });
    }

    const student = await query.getOne();

    if (!student) {
      throw new NotFoundException(`Student ${id} not found`);
    }

    const allowedUpdates = ['name', 'photoUrl'];

    if (updates.class_id) {
      const classEntity = await this.classRepository.findOne({
        where: {
          id: updates.class_id,
          ...(schoolId && { schoolId })
        }
      });

      if (!classEntity) {
        throw new NotFoundException(`Class ${updates.class_id} not found in your school`);
      }
      student.class = classEntity;
    }

    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        student[field] = updates[field];
      }
    });

    return this.studentRepository.save(student);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async remove(id: string, schoolId?: string) {
    const query = this.studentRepository
      .createQueryBuilder('student')
      .where('student.id = :id', { id });

    if (schoolId) {
      query.andWhere('student.schoolId = :schoolId', { schoolId });
    }

    const student = await query.getOne();

    if (!student) {
      throw new NotFoundException(`Student ${id} not found`);
    }
    return this.studentRepository.remove(student);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async getStudentAssessments(studentId: string, schoolId?: string) {
    const query = this.assessmentRepository
      .createQueryBuilder('assessment')
      .leftJoinAndSelect('assessment.subject', 'subject')
      .leftJoin('assessment.student', 'student')
      .where('student.id = :studentId', { studentId });

    if (schoolId) {
      query.andWhere('student.schoolId = :schoolId', { schoolId });
    }

    return query
      .orderBy('subject.name', 'ASC')
      .getMany();
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async getStudentReportCard(studentId: string, term: string, schoolId?: string) {
    const query = this.reportCardRepository
      .createQueryBuilder('reportCard')
      .leftJoin('reportCard.student', 'student')
      .where('student.id = :studentId', { studentId })
      .andWhere('reportCard.term = :term', { term });

    if (schoolId) {
      query.andWhere('student.schoolId = :schoolId', { schoolId });
    }

    return query.getOne();
  }
  // ===== END MODIFIED =====

  // // ===== START MODIFIED: Added schoolId parameter =====
  // async upsertAssessment(assessmentData: any, schoolId?: string) {
  //   if (schoolId) {
  //     const student = await this.studentRepository.findOne({
  //       where: {
  //         id: assessmentData.student_id || assessmentData.studentId,
  //         schoolId
  //       }
  //     });
  //     if (!student) {
  //       throw new NotFoundException('Student not found in your school');
  //     }
  //   }

  //   if (assessmentData.score === 0) {
  //     const existing = await this.assessmentRepository.findOne({
  //       where: {
  //         student: { id: assessmentData.student_id || assessmentData.studentId },
  //         subject: { id: assessmentData.subject_id || assessmentData.subjectId },
  //         assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
  //       },
  //     });

  //     if (existing) {
  //       await this.assessmentRepository.remove(existing);
  //       return { deleted: true };
  //     }
  //     return { deleted: true };
  //   }

  //   const activeConfig = await this.getActiveGradeConfiguration(schoolId);
  //   const data = {
  //     student: { id: assessmentData.student_id || assessmentData.studentId },
  //     subject: { id: assessmentData.subject_id || assessmentData.subjectId },
  //     assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
  //     score: assessmentData.score,
  //     grade: this.calculateGrade(assessmentData.score, activeConfig),
  //   };

  //   const existing = await this.assessmentRepository.findOne({
  //     where: {
  //       student: { id: data.student.id },
  //       subject: { id: data.subject.id },
  //       assessmentType: data.assessmentType,
  //     },
  //   });

  //   if (existing) {
  //     Object.assign(existing, {
  //       score: data.score,
  //       grade: data.grade,
  //     });
  //     return this.assessmentRepository.save(existing);
  //   } else {
  //     const assessment = this.assessmentRepository.create(data);
  //     return this.assessmentRepository.save(assessment);
  //   }
  // }
  // // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async upsertAssessment(assessmentData: any, schoolId?: string) {
    if (schoolId) {
      const student = await this.studentRepository.findOne({
        where: {
          id: assessmentData.student_id || assessmentData.studentId,
          schoolId
        },
        relations: ['class'] // CHANGE 1: Add this to load class relation
      });
      if (!student) {
        throw new NotFoundException('Student not found in your school');
      }
    }

    // CHANGE 2: Get student with class relation (needed for class ID)
    const student = await this.studentRepository.findOne({
      where: { id: assessmentData.student_id || assessmentData.studentId },
      relations: ['class'] // Load class relation
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // ADD THIS CHECK:
    if (!student.class) {
      throw new NotFoundException('Student is not assigned to any class');
    }

    if (assessmentData.score === 0) {
      const existing = await this.assessmentRepository.findOne({
        where: {
          student: { id: assessmentData.student_id || assessmentData.studentId },
          subject: { id: assessmentData.subject_id || assessmentData.subjectId },
          assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
          class: { id: student.class.id } // CHANGE 3: Add class filter
        },
      });

      if (existing) {
        await this.assessmentRepository.remove(existing);
        return { deleted: true };
      }
      return { deleted: true };
    }

    const activeConfig = await this.getActiveGradeConfiguration(schoolId);
    const data = {
      student: { id: assessmentData.student_id || assessmentData.studentId },
      subject: { id: assessmentData.subject_id || assessmentData.subjectId },
      assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
      score: assessmentData.score,
      grade: this.calculateGrade(assessmentData.score, activeConfig),
      class: { id: student.class.id } // CHANGE 4: Add class to data
    };

    const existing = await this.assessmentRepository.findOne({
      where: {
        student: { id: data.student.id },
        subject: { id: data.subject.id },
        assessmentType: data.assessmentType,
        class: { id: student.class.id } // CHANGE 5: Add class filter
      },
    });

    if (existing) {
      Object.assign(existing, {
        score: data.score,
        grade: data.grade,
      });
      return this.assessmentRepository.save(existing);
    } else {
      const assessment = this.assessmentRepository.create(data); // NO CHANGE
      return this.assessmentRepository.save(assessment);
    }
  }
  // ===== END MODIFIED =====

  // ===== MODIFIED: Added permission check for class teacher =====
  async upsertReportCard(reportCardData: any, schoolId?: string, requestingTeacherId?: string) {
    // Get student with class relation for permission check
    const student = await this.studentRepository.findOne({
      where: {
        id: reportCardData.student_id || reportCardData.studentId,
        ...(schoolId && { schoolId })
      },
      relations: ['class'] // IMPORTANT: Get class to check class teacher
    });

    if (!student) {
      throw new NotFoundException('Student not found in your school');
    }

    // PERMISSION CHECK: Only class teacher can update attendance and remarks
    if (requestingTeacherId) {
      const isClassTeacher = student.class &&
        student.class.classTeacherId === requestingTeacherId;

      if (!isClassTeacher) {
        throw new ForbiddenException('Only class teacher can update attendance and remarks');
      }
    }

    const data = {
      student: { id: reportCardData.student_id || reportCardData.studentId },
      term: reportCardData.term,
      daysPresent: reportCardData.days_present || reportCardData.daysPresent || 0,
      daysAbsent: reportCardData.days_absent || reportCardData.daysAbsent || 0,
      daysLate: reportCardData.days_late || reportCardData.daysLate || 0,
      teacherRemarks: reportCardData.teacher_remarks || reportCardData.teacherRemarks || '',
    };

    if (reportCardData.class_rank !== undefined) {
      data['classRank'] = reportCardData.class_rank;
    }
    if (reportCardData.qa1_rank !== undefined) {
      data['qa1Rank'] = reportCardData.qa1_rank;
    }
    if (reportCardData.qa2_rank !== undefined) {
      data['qa2Rank'] = reportCardData.qa2_rank;
    }
    if (reportCardData.total_students !== undefined) {
      data['totalStudents'] = reportCardData.total_students;
    }

    const existing = await this.reportCardRepository.findOne({
      where: {
        student: { id: data.student.id },
        term: data.term,
      },
    });

    if (existing) {
      Object.assign(existing, data);
      return this.reportCardRepository.save(existing);
    } else {
      const reportCard = this.reportCardRepository.create(data);
      return this.reportCardRepository.save(reportCard);
    }
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async createSubject(subjectData: { name: string }, schoolId?: string) {
    const subject = this.subjectRepository.create({
      ...subjectData,
      schoolId: schoolId,
    });
    return this.subjectRepository.save(subject);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async deleteSubject(id: string, schoolId?: string) {
    const query = this.subjectRepository
      .createQueryBuilder('subject')
      .where('subject.id = :id', { id });

    if (schoolId) {
      query.andWhere('subject.schoolId = :schoolId', { schoolId });
    }

    const subject = await query.getOne();

    if (!subject) {
      throw new NotFoundException(`Subject ${id} not found`);
    }
    return this.subjectRepository.remove(subject);
  }
  // ===== END MODIFIED =====

  // ===== NO CHANGES =====
  calculateGrade(score: number, gradeConfig?: any): string {
    const passMark = gradeConfig?.pass_mark || 50;
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= passMark) return 'D';
    return 'F';
  }
  // ===== END NO CHANGES =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async getAllGradeConfigurations(schoolId?: string) {
    const query = this.gradeConfigRepository
      .createQueryBuilder('config')
      .orderBy('config.is_active', 'DESC')
      .addOrderBy('config.created_at', 'DESC');

    if (schoolId) {
      query.where('config.school_id = :schoolId', { schoolId });
    }

    return query.getMany();
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async createGradeConfiguration(data: Partial<GradeConfig>, schoolId?: string) {
    const config = this.gradeConfigRepository.create({
      ...data,
      school_id: schoolId,
    });
    return this.gradeConfigRepository.save(config);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async updateGradeConfiguration(id: string, updates: Partial<GradeConfig>, schoolId?: string) {
    const query = this.gradeConfigRepository
      .createQueryBuilder('config')
      .where('config.id = :id', { id });

    if (schoolId) {
      query.andWhere('config.school_id = :schoolId', { schoolId });
    }

    const config = await query.getOne();

    if (!config) {
      throw new NotFoundException(`Grade configuration ${id} not found`);
    }

    Object.assign(config, updates);
    return this.gradeConfigRepository.save(config);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async setActiveConfiguration(id: string, schoolId?: string) {
    const deactivateQuery = this.gradeConfigRepository
      .createQueryBuilder()
      .update(GradeConfig)
      .set({ is_active: false })
      .where('is_active = true');

    if (schoolId) {
      deactivateQuery.andWhere('school_id = :schoolId', { schoolId });
    }

    await deactivateQuery.execute();

    const query = this.gradeConfigRepository
      .createQueryBuilder('config')
      .where('config.id = :id', { id });

    if (schoolId) {
      query.andWhere('config.school_id = :schoolId', { schoolId });
    }

    const config = await query.getOne();

    if (!config) {
      throw new NotFoundException(`Grade configuration ${id} not found`);
    }

    config.is_active = true;
    await this.gradeConfigRepository.save(config);
    await this.updateAllReportCardsWithNewGrades(schoolId);

    return config;
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async findAllClasses(schoolId?: string) {
    const query = this.classRepository
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.students', 'students')
      .leftJoinAndSelect('class.classTeacher', 'classTeacher') // ADDED: Include class teacher
      .orderBy('class.created_at', 'DESC');

    if (schoolId) {
      query.where('class.schoolId = :schoolId', { schoolId });
    }

    return query.getMany();
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async createClass(classData: { name: string; academic_year: string; term: string }, schoolId?: string) {
    const existingClass = await this.classRepository.findOne({
      where: {
        name: classData.name,
        academic_year: classData.academic_year,
        term: classData.term,
        ...(schoolId && { schoolId })
      }
    });

    if (existingClass) {
      throw new ConflictException(
        `Class "${classData.name}" already exists for ${classData.academic_year} ${classData.term}`
      );
    }

    const nameCode = classData.name
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .substring(0, 4);

    const classNumber = classData.name.match(/\d+/)?.[0] || '00';
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();

    const classCode = `${nameCode}${classNumber}-${classData.academic_year.replace('/', '-')}-${classData.term.substring(0, 2).toUpperCase()}-${randomSuffix}`;

    const classEntity = this.classRepository.create({
      ...classData,
      class_code: classCode,
      schoolId: schoolId,
    });

    return this.classRepository.save(classEntity);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async deleteClass(id: string, schoolId?: string) {
    const query = this.classRepository
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.students', 'students')
      .where('class.id = :id', { id });

    if (schoolId) {
      query.andWhere('class.schoolId = :schoolId', { schoolId });
    }

    const classEntity = await query.getOne();

    if (!classEntity) {
      throw new NotFoundException(`Class ${id} not found`);
    }

    if (classEntity.students && classEntity.students.length > 0) {
      throw new NotFoundException(`Cannot delete class with students. Delete students first.`);
    }

    return this.classRepository.remove(classEntity);
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async getClassStudents(classId: string, schoolId?: string) {
    const query = this.classRepository
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.students', 'students')
      .leftJoinAndSelect('class.classTeacher', 'classTeacher') // ADDED
      .where('class.id = :classId', { classId });

    if (schoolId) {
      query.andWhere('class.schoolId = :schoolId', { schoolId });
    }

    const classEntity = await query.getOne();

    if (!classEntity) {
      throw new NotFoundException(`Class ${classId} not found`);
    }

    return classEntity.students || [];
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async calculateAndUpdateRanks(classId: string, term: string, schoolId?: string) {
    const query = this.classRepository
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.students', 'students')
      .where('class.id = :classId', { classId });

    if (schoolId) {
      query.andWhere('class.schoolId = :schoolId', { schoolId });
    }

    const classEntity = await query.getOne();

    if (!classEntity) {
      throw new NotFoundException(`Class ${classId} not found`);
    }

    const studentIds = classEntity.students.map(s => s.id);
    const results: any[] = [];

    for (const studentId of studentIds) {
      const assessments = await this.assessmentRepository.find({
        where: {
          student: { id: studentId },
          assessmentType: In(['qa1', 'qa2', 'end_of_term'])
        },
        relations: ['subject']
      });

      const qa1Total = assessments
        .filter(a => a.assessmentType === 'qa1')
        .reduce((sum, a) => sum + a.score, 0);

      const qa2Total = assessments
        .filter(a => a.assessmentType === 'qa2')
        .reduce((sum, a) => sum + a.score, 0);

      const endTermTotal = assessments
        .filter(a => a.assessmentType === 'end_of_term')
        .reduce((sum, a) => sum + a.score, 0);

      const qa1Subjects = assessments.filter(a => a.assessmentType === 'qa1' && a.score > 0).length;
      const qa2Subjects = assessments.filter(a => a.assessmentType === 'qa2' && a.score > 0).length;
      const endTermSubjects = assessments.filter(a => a.assessmentType === 'end_of_term' && a.score > 0).length;

      const qa1Avg = qa1Subjects > 0 ? qa1Total / qa1Subjects : 0;
      const qa2Avg = qa2Subjects > 0 ? qa2Total / qa2Subjects : 0;
      const endTermAvg = endTermSubjects > 0 ? endTermTotal / endTermSubjects : 0;

      results.push({
        studentId,
        qa1Avg,
        qa2Avg,
        endTermAvg,
      });
    }

    const qa1Ranked = [...results]
      .filter(r => r.qa1Avg > 0)
      .sort((a, b) => b.qa1Avg - a.qa1Avg);

    const qa2Ranked = [...results]
      .filter(r => r.qa2Avg > 0)
      .sort((a, b) => b.qa2Avg - a.qa2Avg);

    const endTermRanked = [...results]
      .filter(r => r.endTermAvg > 0)
      .sort((a, b) => b.endTermAvg - a.endTermAvg);

    for (const studentId of studentIds) {
      let reportCard = await this.reportCardRepository.findOne({
        where: {
          student: { id: studentId },
          term,
        },
      });

      if (!reportCard) {
        reportCard = this.reportCardRepository.create({
          student: { id: studentId },
          term,
          totalStudents: studentIds.length,
        });
      }

      const studentResult = results.find(r => r.studentId === studentId);
      if (studentResult) {
        const qa1Index = qa1Ranked.findIndex(r => r.studentId === studentId);
        reportCard.qa1Rank = qa1Index >= 0 ? qa1Index + 1 : 0;

        const qa2Index = qa2Ranked.findIndex(r => r.studentId === studentId);
        reportCard.qa2Rank = qa2Index >= 0 ? qa2Index + 1 : 0;

        const endTermIndex = endTermRanked.findIndex(r => r.studentId === studentId);
        reportCard.classRank = endTermIndex >= 0 ? endTermIndex + 1 : 0;

        reportCard.totalStudents = studentIds.length;
      }

      await this.reportCardRepository.save(reportCard);
    }

    return { message: 'Ranks calculated and updated successfully' };
  }
  // ===== END MODIFIED =====

  // // ===== START MODIFIED: Added schoolId parameter =====
  // async getClassResults(classId: string, schoolId?: string) {
  //   const query = this.classRepository
  //     .createQueryBuilder('class')
  //     .leftJoinAndSelect('class.students', 'students')
  //     .leftJoinAndSelect('class.classTeacher', 'classTeacher') // ADDED
  //     .where('class.id = :classId', { classId });

  //   if (schoolId) {
  //     query.andWhere('class.schoolId = :schoolId', { schoolId });
  //   }

  //   const classEntity = await query.getOne();

  //   if (!classEntity) {
  //     throw new NotFoundException(`Class ${classId} not found`);
  //   }

  //   const activeGradeConfig = await this.getActiveGradeConfiguration(schoolId);
  //   const results: any[] = [];

  //   for (const student of classEntity.students) {
  //     const studentData = await this.findByExamNumber(student.examNumber, schoolId);

  //     if (studentData && studentData.subjects && studentData.subjects.length > 0) {
  //       results.push({
  //         id: student.id,
  //         name: student.name,
  //         examNumber: student.examNumber,
  //         classRank: studentData.classRank || 0,
  //         totalScore: studentData.subjects.reduce((sum, subject) => {
  //           const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
  //           return sum + finalScore;
  //         }, 0),
  //         average: studentData.subjects.reduce((sum, subject) => {
  //           const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
  //           return sum + finalScore;
  //         }, 0) / studentData.subjects.length,
  //         overallGrade: this.calculateGrade(
  //           studentData.subjects.reduce((sum, subject) => {
  //             const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
  //             return sum + finalScore;
  //           }, 0) / studentData.subjects.length,
  //           activeGradeConfig
  //         ),
  //         subjects: studentData.subjects.map(subject => ({
  //           name: subject.name,
  //           qa1: subject.qa1,
  //           qa2: subject.qa2,
  //           endOfTerm: subject.endOfTerm,
  //           finalScore: subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3),
  //           grade: subject.grade
  //         }))
  //       });
  //     }
  //   }

  //   results.sort((a, b) => b.average - a.average);
  //   results.forEach((result, index) => {
  //     result.rank = index + 1;
  //   });

  //   return results;
  // }
  // // ===== END MODIFIED =====
  // ===== START MODIFIED: Added schoolId parameter =====
  async getClassResults(classId: string, schoolId?: string, teacherId?: string) { // ADD teacherId parameter
    const query = this.classRepository
      .createQueryBuilder('class')
      .leftJoinAndSelect('class.students', 'students')
      .leftJoinAndSelect('class.classTeacher', 'classTeacher')
      .where('class.id = :classId', { classId });

    if (schoolId) {
      query.andWhere('class.schoolId = :schoolId', { schoolId });
    }

    const classEntity = await query.getOne();

    if (!classEntity) {
      throw new NotFoundException(`Class ${classId} not found`);
    }

    const activeGradeConfig = await this.getActiveGradeConfiguration(schoolId);
    const results: any[] = [];

    // ===== ADD THIS: Get teacher's subjects for this class =====
    let teacherSubjectIds: string[] = [];
    // Get teacher's subjects for this class
    if (teacherId) {
      const teacherAssignments = await this.teachersService.getTeacherAssignments(teacherId);
      const assignmentsForThisClass = teacherAssignments.filter(a => a.classId === classId);
      teacherSubjectIds = assignmentsForThisClass.map(a => a.subjectId);
    }
    // ===== END ADD =====

    for (const student of classEntity.students) {
      // CHANGE 1: Get assessments filtered by class instead of using findByExamNumber
      let assessments = await this.assessmentRepository // ADD "let" not "const"
        .createQueryBuilder('assessment')
        .leftJoinAndSelect('assessment.subject', 'subject')
        .leftJoinAndSelect('assessment.student', 'student')
        .innerJoin('assessment.class', 'class')
        .where('student.id = :studentId', { studentId: student.id })
        .andWhere('class.id = :classId', { classId })
        .getMany();

      // ===== ADD THIS: Filter by teacher's subjects =====
      if (teacherId && teacherSubjectIds.length > 0) {
        assessments = assessments.filter(asm =>
          teacherSubjectIds.includes(asm.subject.id)
        );
      }
      // ===== END ADD =====

      // CHANGE 2: Get report card for rankings
      const reportCard = await this.reportCardRepository.findOne({
        where: {
          student: { id: student.id },
          term: classEntity.term
        }
      });

      // CHANGE 3: Build subjects from filtered assessments
      const subjectMap = new Map<string, any>();

      assessments.forEach(asm => {
        const subjectName = asm.subject?.name || 'Unknown';

        if (!subjectMap.has(subjectName)) {
          subjectMap.set(subjectName, {
            name: subjectName,
            qa1: 0,
            qa2: 0,
            endOfTerm: 0,
          });
        }

        const subjectData = subjectMap.get(subjectName);
        if (asm.assessmentType === 'qa1') {
          subjectData.qa1 = asm.score || 0;
        } else if (asm.assessmentType === 'qa2') {
          subjectData.qa2 = asm.score || 0;
        } else if (asm.assessmentType === 'end_of_term') {
          subjectData.endOfTerm = asm.score || 0;
        }
      });

      const subjects = Array.from(subjectMap.values());

      if (subjects.length > 0) {
        // CHANGE 4: Calculate final scores and grades
        const enhancedSubjects = subjects.map(subject => {
          const finalScore = this.calculateFinalScore(subject, activeGradeConfig);
          const grade = this.calculateGrade(finalScore, activeGradeConfig);
          return {
            ...subject,
            finalScore,
            grade
          };
        });

        // CHANGE 5: Calculate totals and average
        const totalScore = enhancedSubjects.reduce((sum, subject) => sum + subject.finalScore, 0);
        const average = enhancedSubjects.length > 0 ? totalScore / enhancedSubjects.length : 0;

        results.push({
          id: student.id,
          name: student.name,
          examNumber: student.examNumber,
          classRank: reportCard?.classRank || 0,
          totalScore: totalScore,
          average: average,
          overallGrade: this.calculateGrade(average, activeGradeConfig),
          subjects: enhancedSubjects.map(subject => ({
            name: subject.name,
            qa1: subject.qa1,
            qa2: subject.qa2,
            endOfTerm: subject.endOfTerm,
            finalScore: subject.finalScore,
            grade: subject.grade
          }))
        });
      }
    }

    results.sort((a, b) => b.average - a.average);
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    return results;
  }
  // ===== END MODIFIED =====

  // ===== START MODIFIED: Added schoolId parameter =====
  async updateAllReportCardsWithNewGrades(schoolId?: string) {
    const query = this.reportCardRepository
      .createQueryBuilder('reportCard')
      .leftJoinAndSelect('reportCard.student', 'student')
      .leftJoinAndSelect('student.assessments', 'assessments')
      .leftJoinAndSelect('assessments.subject', 'subject');

    if (schoolId) {
      query.where('student.schoolId = :schoolId', { schoolId });
    }

    const reportCards = await query.getMany();

    const gradeConfig = await this.getActiveGradeConfiguration(schoolId);

    for (const reportCard of reportCards) {
      const student = reportCard.student;
      const subjectMap = {};

      student.assessments?.forEach((asm) => {
        const subjectName = asm.subject?.name || 'Unknown';
        if (!subjectMap[subjectName]) {
          subjectMap[subjectName] = {
            qa1: 0,
            qa2: 0,
            endOfTerm: 0,
          };
        }

        if (asm.assessmentType === 'qa1') {
          subjectMap[subjectName].qa1 = asm.score || 0;
        } else if (asm.assessmentType === 'qa2') {
          subjectMap[subjectName].qa2 = asm.score || 0;
        } else if (asm.assessmentType === 'end_of_term') {
          subjectMap[subjectName].endOfTerm = asm.score || 0;
        }
      });

      let totalScore = 0;
      let subjectCount = 0;

      Object.values(subjectMap).forEach((subject: any) => {
        const finalScore = this.calculateFinalScore(subject, gradeConfig);
        if (finalScore > 0) {
          totalScore += finalScore;
          subjectCount++;
        }
      });

      const overallAverage = subjectCount > 0 ? totalScore / subjectCount : 0;

      reportCard.overallAverage = overallAverage;
      reportCard.overallGrade = this.calculateGrade(overallAverage, gradeConfig);

      await this.reportCardRepository.save(reportCard);
    }

    return { message: `Updated ${reportCards.length} report cards with new grade calculations` };
  }
  // ===== END MODIFIED =====
}


// import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { In, Like, Repository } from 'typeorm';
// import { Student } from './entities/student.entity';
// import { Assessment } from './entities/assessment.entity';
// import { ReportCard } from './entities/report-card.entity';
// import { Subject } from './entities/subject.entity';
// import { GradeConfig } from './entities/grade-config.entity';
// import { Class } from './entities/class.entity';

// @Injectable()
// export class StudentsService {
//   constructor(
//     @InjectRepository(Student)
//     private studentRepository: Repository<Student>,
//     @InjectRepository(Assessment)
//     private assessmentRepository: Repository<Assessment>,
//     @InjectRepository(ReportCard)
//     private reportCardRepository: Repository<ReportCard>,
//     @InjectRepository(Subject)
//     private subjectRepository: Repository<Subject>,
//     @InjectRepository(GradeConfig)
//     private gradeConfigRepository: Repository<GradeConfig>,
//     @InjectRepository(Class)
//     private classRepository: Repository<Class>,
//   ) { }

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async findByExamNumber(examNumber: string, schoolId?: string) {
//     const query = this.studentRepository
//       .createQueryBuilder('student')
//       .leftJoinAndSelect('student.assessments', 'assessments')
//       .leftJoinAndSelect('assessments.subject', 'subject')
//       .leftJoinAndSelect('student.reportCards', 'reportCards')
//       .leftJoinAndSelect('student.class', 'class')
//       .where('student.examNumber = :examNumber', { examNumber: examNumber })
//     // .where('student.examNumber = :examNumber', { examNumber: examNumber.toUpperCase() });

//     if (schoolId) {
//       query.andWhere('student.schoolId = :schoolId', { schoolId });
//     }

//     const student = await query.getOne();

//     if (!student) {
//       throw new NotFoundException(`Student ${examNumber} not found`);
//     }

//     const activeGradeConfig = await this.getActiveGradeConfiguration(schoolId);
//     return this.formatStudentData(student, activeGradeConfig);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async getActiveGradeConfiguration(schoolId?: string) {
//     const query = this.gradeConfigRepository
//       .createQueryBuilder('config')
//       .where('config.is_active = true');

//     if (schoolId) {
//       query.andWhere('config.school_id = :schoolId', { schoolId });
//     }

//     const config = await query.getOne();

//     // if (!config) {
//     //   return {
//     //     id: 'default',
//     //     configuration_name: 'Default (Average All)',
//     //     calculation_method: 'average_all',
//     //     weight_qa1: 33.33,
//     //     weight_qa2: 33.33,
//     //     weight_end_of_term: 33.34,
//     //     pass_mark: 50,
//     //     is_active: true,
//     //     school_id: schoolId || null,
//     //   };
//     // }

//     if (!config) {
//       return {
//         id: 'default',
//         configuration_name: 'Default (End of Term Only)',  // Updated name
//         calculation_method: 'end_of_term_only',  // ← NEW DEFAULT
//         weight_qa1: 0,  // Can set to 0 since they're not used
//         weight_qa2: 0,
//         weight_end_of_term: 100,  // Only end term matters
//         pass_mark: 50,
//         is_active: true,
//         school_id: schoolId || null,
//       };
//     }

//     return config;
//   }
//   // ===== END MODIFIED =====

//   // ===== NO CHANGES =====
//   private formatStudentData(student: Student, gradeConfig: any) {
//     const subjectMap = {};

//     student.assessments?.forEach((asm) => {
//       const subjectName = asm.subject?.name || 'Unknown';
//       if (!subjectMap[subjectName]) {
//         subjectMap[subjectName] = {
//           name: subjectName,
//           qa1: 0,
//           qa2: 0,
//           endOfTerm: 0,
//           grade: 'N/A',
//         };
//       }

//       if (asm.assessmentType === 'qa1') {
//         subjectMap[subjectName].qa1 = asm.score;
//       } else if (asm.assessmentType === 'qa2') {
//         subjectMap[subjectName].qa2 = asm.score;
//       } else if (asm.assessmentType === 'end_of_term') {
//         subjectMap[subjectName].endOfTerm = asm.score;
//         subjectMap[subjectName].grade = this.calculateGrade(asm.score, gradeConfig);
//       }
//     });

//     Object.values(subjectMap).forEach((subject: any) => {
//       subject.finalScore = this.calculateFinalScore(subject, gradeConfig, student.assessments);
//       subject.grade = this.calculateGrade(subject.finalScore, gradeConfig);
//     });

//     const activeReport = student.reportCards?.[0] || {};

//     const className = student.class ? student.class.name : 'Unknown';
//     const term = student.class ? student.class.term : 'Term 1, 2024/2025';
//     const academicYear = student.class ? student.class.academic_year : '2024/2025';

//     const response: any = {
//       id: student.id,
//       name: student.name,
//       examNumber: student.examNumber,
//       class: className,
//       term: term,
//       academicYear: academicYear,
//       photo: student.photoUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
//       subjects: Object.values(subjectMap),
//       attendance: {
//         present: activeReport.daysPresent || 0,
//         absent: activeReport.daysAbsent || 0,
//         late: activeReport.daysLate || 0,
//       },
//       classRank: activeReport.classRank || 0,
//       qa1Rank: activeReport.qa1Rank || 0,
//       qa2Rank: activeReport.qa2Rank || 0,
//       totalStudents: activeReport.totalStudents || 0,
//       teacherRemarks: activeReport.teacherRemarks || 'No remarks available.',
//       gradeConfiguration: gradeConfig,
//     };

//     response.assessmentStats = this.calculateAssessmentStats(response, gradeConfig);

//     return response;
//   }
//   // ===== END NO CHANGES =====

//   // ===== NO CHANGES =====
//   private calculateFinalScore(subject: any, gradeConfig: any, studentAssessments?: any[]): number {
//     const qa1 = subject.qa1 || 0;
//     const qa2 = subject.qa2 || 0;
//     const endOfTerm = subject.endOfTerm || 0;

//     // if (studentAssessments) {
//     //   const hasQA1 = studentAssessments.some(a => a.assessmentType === 'qa1' && a.score > 0);
//     //   const hasQA2 = studentAssessments.some(a => a.assessmentType === 'qa2' && a.score > 0);
//     //   const hasEndOfTerm = studentAssessments.some(a => a.assessmentType === 'end_of_term' && a.score > 0);

//     //   if ((hasQA1 || hasQA2) && !hasEndOfTerm) {
//     //     return endOfTerm;
//     //   }
//     // }

//     // ========== ADD THESE 10 LINES ==========
//     if (studentAssessments) {
//       const hasQA1 = studentAssessments.some(a => a.assessmentType === 'qa1' && a.score > 0);
//       const hasQA2 = studentAssessments.some(a => a.assessmentType === 'qa2' && a.score > 0);
//       const hasEndOfTerm = studentAssessments.some(a => a.assessmentType === 'end_of_term' && a.score > 0);

//       // Force end_of_term_only if only QA1/QA2 are entered
//       if ((hasQA1 || hasQA2) && !hasEndOfTerm) {
//         return endOfTerm; // This will be 0 until End of Term is entered
//       }
//     }
//     // ========== END OF ADDITION ==========

//     switch (gradeConfig.calculation_method) {
//       case 'average_all':
//         return (qa1 + qa2 + endOfTerm) / 3;
//       case 'end_of_term_only':
//         return endOfTerm;
//       case 'weighted_average':
//         return (qa1 * gradeConfig.weight_qa1 +
//           qa2 * gradeConfig.weight_qa2 +
//           endOfTerm * gradeConfig.weight_end_of_term) / 100;
//       default:
//         return (qa1 + qa2 + endOfTerm) / 3;
//     }
//   }
//   // ===== END NO CHANGES =====

//   // ===== NO CHANGES =====
//   private calculateAssessmentStats(studentData: any, gradeConfig: any) {
//     const subjects = studentData.subjects;

//     const qa1Average = subjects.reduce((sum, s) => sum + s.qa1, 0) / subjects.length;
//     const qa2Average = subjects.reduce((sum, s) => sum + s.qa2, 0) / subjects.length;
//     const endOfTermAverage = subjects.reduce((sum, s) => sum + s.endOfTerm, 0) / subjects.length;

//     const qa1Grade = this.calculateGrade(qa1Average, gradeConfig);
//     const qa2Grade = this.calculateGrade(qa2Average, gradeConfig);
//     const endOfTermGrade = this.calculateGrade(endOfTermAverage, gradeConfig);

//     let overallAverage = (qa1Average + qa2Average + endOfTermAverage) / 3;
//     if (gradeConfig) {
//       overallAverage = this.calculateFinalScore(
//         { qa1: qa1Average, qa2: qa2Average, endOfTerm: endOfTermAverage },
//         gradeConfig
//       );
//     }

//     return {
//       qa1: {
//         classRank: studentData.qa1Rank || 0,
//         termAverage: parseFloat(qa1Average.toFixed(1)),
//         overallGrade: qa1Grade,
//       },
//       qa2: {
//         classRank: studentData.qa2Rank || 0,
//         termAverage: parseFloat(qa2Average.toFixed(1)),
//         overallGrade: qa2Grade,
//       },
//       endOfTerm: {
//         classRank: studentData.classRank,
//         termAverage: parseFloat(endOfTermAverage.toFixed(1)),
//         overallGrade: endOfTermGrade,
//         attendance: studentData.attendance
//       },
//       overall: {
//         termAverage: parseFloat(overallAverage.toFixed(1)),
//         calculationMethod: gradeConfig?.calculation_method || 'average_all'
//       }
//     };
//   }
//   // ===== END NO CHANGES =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async findAll(schoolId?: string) {
//     const query = this.studentRepository
//       .createQueryBuilder('student')
//       .leftJoinAndSelect('student.class', 'class')
//       .orderBy('student.examNumber', 'ASC');

//     if (schoolId) {
//       query.where('student.schoolId = :schoolId', { schoolId });
//     }

//     return query.getMany();
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async findAllSubjects(schoolId?: string) {
//     const query = this.subjectRepository
//       .createQueryBuilder('subject')
//       .select(['subject.id', 'subject.name'])
//       .orderBy('subject.name', 'ASC');

//     if (schoolId) {
//       query.where('subject.schoolId = :schoolId', { schoolId });
//     }

//     return query.getMany();
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async create(studentData: any, schoolId?: string) {
//     const classEntity = await this.classRepository.findOne({
//       where: {
//         id: studentData.class_id,
//         ...(schoolId && { schoolId })
//       }
//     });

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${studentData.class_id} not found in your school`);
//     }

//     const currentYear = new Date().getFullYear().toString().slice(-2);
//     const classNumberMatch = classEntity.name.match(/\d+/);
//     const classNumber = classNumberMatch ? classNumberMatch[0] : '0';
//     // const prefix = `${currentYear}-${classNumber}`;
//     // const prefix = `${schoolId}-${currentYear}-${classNumber}`;
//     const prefix = `${schoolId ? schoolId.substring(0, 3) : 'SCH'}-${currentYear}-${classNumber}`;

//     const allStudents = await this.studentRepository.find({
//       select: ['examNumber'],
//       where: {
//         examNumber: Like(`${prefix}%`),
//         ...(schoolId && { schoolId })
//       },
//       order: { examNumber: 'DESC' },
//       take: 1
//     });

//     let nextNumber = 1;
//     if (allStudents.length > 0 && allStudents[0].examNumber) {
//       const lastExamNumber = allStudents[0].examNumber;
//       const lastNumberStr = lastExamNumber.slice(prefix.length);
//       const lastNumber = parseInt(lastNumberStr) || 0;
//       nextNumber = lastNumber + 1;
//     }

//     // const examNumber = `${prefix}${nextNumber.toString().padStart(3, '0')}`;
//     // const examNumber = `${schoolId}-${currentYear}-${classNumber}${nextNumber.toString().padStart(3, '0')}`;
//     const examNumber = `${schoolId ? schoolId.substring(0, 3) : 'SCH'}-${currentYear}-${classNumber}${nextNumber.toString().padStart(3, '0')}`;

//     const student = this.studentRepository.create({
//       name: studentData.name,
//       examNumber: examNumber,
//       class: classEntity,
//       photoUrl: studentData.photo_url,
//       schoolId: schoolId, // ADD SCHOOL ID
//     });

//     return this.studentRepository.save(student);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async update(id: string, updates: any, schoolId?: string) {
//     const query = this.studentRepository
//       .createQueryBuilder('student')
//       .leftJoinAndSelect('student.class', 'class')
//       .where('student.id = :id', { id });

//     if (schoolId) {
//       query.andWhere('student.schoolId = :schoolId', { schoolId });
//     }

//     const student = await query.getOne();

//     if (!student) {
//       throw new NotFoundException(`Student ${id} not found`);
//     }

//     const allowedUpdates = ['name', 'photoUrl'];

//     if (updates.class_id) {
//       const classEntity = await this.classRepository.findOne({
//         where: {
//           id: updates.class_id,
//           ...(schoolId && { schoolId })
//         }
//       });

//       if (!classEntity) {
//         throw new NotFoundException(`Class ${updates.class_id} not found in your school`);
//       }
//       student.class = classEntity;
//     }

//     allowedUpdates.forEach(field => {
//       if (updates[field] !== undefined) {
//         student[field] = updates[field];
//       }
//     });

//     return this.studentRepository.save(student);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async remove(id: string, schoolId?: string) {
//     const query = this.studentRepository
//       .createQueryBuilder('student')
//       .where('student.id = :id', { id });

//     if (schoolId) {
//       query.andWhere('student.schoolId = :schoolId', { schoolId });
//     }

//     const student = await query.getOne();

//     if (!student) {
//       throw new NotFoundException(`Student ${id} not found`);
//     }
//     return this.studentRepository.remove(student);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async getStudentAssessments(studentId: string, schoolId?: string) {
//     const query = this.assessmentRepository
//       .createQueryBuilder('assessment')
//       .leftJoinAndSelect('assessment.subject', 'subject')
//       .leftJoin('assessment.student', 'student')
//       .where('student.id = :studentId', { studentId });

//     if (schoolId) {
//       query.andWhere('student.schoolId = :schoolId', { schoolId });
//     }

//     return query
//       .orderBy('subject.name', 'ASC')
//       .getMany();
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async getStudentReportCard(studentId: string, term: string, schoolId?: string) {
//     const query = this.reportCardRepository
//       .createQueryBuilder('reportCard')
//       .leftJoin('reportCard.student', 'student')
//       .where('student.id = :studentId', { studentId })
//       .andWhere('reportCard.term = :term', { term });

//     if (schoolId) {
//       query.andWhere('student.schoolId = :schoolId', { schoolId });
//     }

//     return query.getOne();
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async upsertAssessment(assessmentData: any, schoolId?: string) {
//     if (schoolId) {
//       const student = await this.studentRepository.findOne({
//         where: {
//           id: assessmentData.student_id || assessmentData.studentId,
//           schoolId
//         }
//       });
//       if (!student) {
//         throw new NotFoundException('Student not found in your school');
//       }
//     }

//     if (assessmentData.score === 0) {
//       const existing = await this.assessmentRepository.findOne({
//         where: {
//           student: { id: assessmentData.student_id || assessmentData.studentId },
//           subject: { id: assessmentData.subject_id || assessmentData.subjectId },
//           assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
//         },
//       });

//       if (existing) {
//         await this.assessmentRepository.remove(existing);
//         return { deleted: true };
//       }
//       return { deleted: true };
//     }

//     const activeConfig = await this.getActiveGradeConfiguration(schoolId);
//     const data = {
//       student: { id: assessmentData.student_id || assessmentData.studentId },
//       subject: { id: assessmentData.subject_id || assessmentData.subjectId },
//       assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
//       score: assessmentData.score,
//       grade: this.calculateGrade(assessmentData.score, activeConfig),
//     };

//     const existing = await this.assessmentRepository.findOne({
//       where: {
//         student: { id: data.student.id },
//         subject: { id: data.subject.id },
//         assessmentType: data.assessmentType,
//       },
//     });

//     if (existing) {
//       Object.assign(existing, {
//         score: data.score,
//         grade: data.grade,
//       });
//       return this.assessmentRepository.save(existing);
//     } else {
//       const assessment = this.assessmentRepository.create(data);
//       return this.assessmentRepository.save(assessment);
//     }
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async upsertReportCard(reportCardData: any, schoolId?: string) {
//     if (schoolId) {
//       const student = await this.studentRepository.findOne({
//         where: {
//           id: reportCardData.student_id || reportCardData.studentId,
//           schoolId
//         }
//       });
//       if (!student) {
//         throw new NotFoundException('Student not found in your school');
//       }
//     }

//     const data = {
//       student: { id: reportCardData.student_id || reportCardData.studentId },
//       term: reportCardData.term,
//       daysPresent: reportCardData.days_present || reportCardData.daysPresent || 0,
//       daysAbsent: reportCardData.days_absent || reportCardData.daysAbsent || 0,
//       daysLate: reportCardData.days_late || reportCardData.daysLate || 0,
//       teacherRemarks: reportCardData.teacher_remarks || reportCardData.teacherRemarks || '',
//     };

//     if (reportCardData.class_rank !== undefined) {
//       data['classRank'] = reportCardData.class_rank;
//     }
//     if (reportCardData.qa1_rank !== undefined) {
//       data['qa1Rank'] = reportCardData.qa1_rank;
//     }
//     if (reportCardData.qa2_rank !== undefined) {
//       data['qa2Rank'] = reportCardData.qa2_rank;
//     }
//     if (reportCardData.total_students !== undefined) {
//       data['totalStudents'] = reportCardData.total_students;
//     }

//     const existing = await this.reportCardRepository.findOne({
//       where: {
//         student: { id: data.student.id },
//         term: data.term,
//       },
//     });

//     if (existing) {
//       Object.assign(existing, data);
//       return this.reportCardRepository.save(existing);
//     } else {
//       const reportCard = this.reportCardRepository.create(data);
//       return this.reportCardRepository.save(reportCard);
//     }
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async createSubject(subjectData: { name: string }, schoolId?: string) {
//     const subject = this.subjectRepository.create({
//       ...subjectData,
//       schoolId: schoolId,
//     });
//     return this.subjectRepository.save(subject);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async deleteSubject(id: string, schoolId?: string) {
//     const query = this.subjectRepository
//       .createQueryBuilder('subject')
//       .where('subject.id = :id', { id });

//     if (schoolId) {
//       query.andWhere('subject.schoolId = :schoolId', { schoolId });
//     }

//     const subject = await query.getOne();

//     if (!subject) {
//       throw new NotFoundException(`Subject ${id} not found`);
//     }
//     return this.subjectRepository.remove(subject);
//   }
//   // ===== END MODIFIED =====

//   // ===== NO CHANGES =====
//   calculateGrade(score: number, gradeConfig?: any): string {
//     const passMark = gradeConfig?.pass_mark || 50;
//     if (score >= 80) return 'A';
//     if (score >= 70) return 'B';
//     if (score >= 60) return 'C';
//     if (score >= passMark) return 'D';
//     return 'F';
//   }
//   // ===== END NO CHANGES =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async getAllGradeConfigurations(schoolId?: string) {
//     const query = this.gradeConfigRepository
//       .createQueryBuilder('config')
//       .orderBy('config.is_active', 'DESC')
//       .addOrderBy('config.created_at', 'DESC');

//     if (schoolId) {
//       query.where('config.school_id = :schoolId', { schoolId });
//     }

//     return query.getMany();
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async createGradeConfiguration(data: Partial<GradeConfig>, schoolId?: string) {
//     const config = this.gradeConfigRepository.create({
//       ...data,
//       school_id: schoolId,
//     });
//     return this.gradeConfigRepository.save(config);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async updateGradeConfiguration(id: string, updates: Partial<GradeConfig>, schoolId?: string) {
//     const query = this.gradeConfigRepository
//       .createQueryBuilder('config')
//       .where('config.id = :id', { id });

//     if (schoolId) {
//       query.andWhere('config.school_id = :schoolId', { schoolId });
//     }

//     const config = await query.getOne();

//     if (!config) {
//       throw new NotFoundException(`Grade configuration ${id} not found`);
//     }

//     Object.assign(config, updates);
//     return this.gradeConfigRepository.save(config);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async setActiveConfiguration(id: string, schoolId?: string) {
//     const deactivateQuery = this.gradeConfigRepository
//       .createQueryBuilder()
//       .update(GradeConfig)
//       .set({ is_active: false })
//       .where('is_active = true');

//     if (schoolId) {
//       deactivateQuery.andWhere('school_id = :schoolId', { schoolId });
//     }

//     await deactivateQuery.execute();

//     const query = this.gradeConfigRepository
//       .createQueryBuilder('config')
//       .where('config.id = :id', { id });

//     if (schoolId) {
//       query.andWhere('config.school_id = :schoolId', { schoolId });
//     }

//     const config = await query.getOne();

//     if (!config) {
//       throw new NotFoundException(`Grade configuration ${id} not found`);
//     }

//     config.is_active = true;
//     await this.gradeConfigRepository.save(config);
//     await this.updateAllReportCardsWithNewGrades(schoolId);

//     return config;
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async findAllClasses(schoolId?: string) {
//     const query = this.classRepository
//       .createQueryBuilder('class')
//       .leftJoinAndSelect('class.students', 'students')
//       .orderBy('class.created_at', 'DESC');

//     if (schoolId) {
//       query.where('class.schoolId = :schoolId', { schoolId });
//     }

//     return query.getMany();
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async createClass(classData: { name: string; academic_year: string; term: string }, schoolId?: string) {
//     const existingClass = await this.classRepository.findOne({
//       where: {
//         name: classData.name,
//         academic_year: classData.academic_year,
//         term: classData.term,
//         ...(schoolId && { schoolId })
//       }
//     });

//     if (existingClass) {
//       throw new ConflictException(
//         `Class "${classData.name}" already exists for ${classData.academic_year} ${classData.term}`
//       );
//     }

//     const nameCode = classData.name
//       .replace(/[^a-zA-Z0-9]/g, '')
//       .toUpperCase()
//       .substring(0, 4);

//     const classNumber = classData.name.match(/\d+/)?.[0] || '00';
//     const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();

//     const classCode = `${nameCode}${classNumber}-${classData.academic_year.replace('/', '-')}-${classData.term.substring(0, 2).toUpperCase()}-${randomSuffix}`;

//     const classEntity = this.classRepository.create({
//       ...classData,
//       class_code: classCode,
//       schoolId: schoolId,
//     });

//     return this.classRepository.save(classEntity);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async deleteClass(id: string, schoolId?: string) {
//     const query = this.classRepository
//       .createQueryBuilder('class')
//       .leftJoinAndSelect('class.students', 'students')
//       .where('class.id = :id', { id });

//     if (schoolId) {
//       query.andWhere('class.schoolId = :schoolId', { schoolId });
//     }

//     const classEntity = await query.getOne();

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${id} not found`);
//     }

//     if (classEntity.students && classEntity.students.length > 0) {
//       throw new NotFoundException(`Cannot delete class with students. Delete students first.`);
//     }

//     return this.classRepository.remove(classEntity);
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async getClassStudents(classId: string, schoolId?: string) {
//     const query = this.classRepository
//       .createQueryBuilder('class')
//       .leftJoinAndSelect('class.students', 'students')
//       .where('class.id = :classId', { classId });

//     if (schoolId) {
//       query.andWhere('class.schoolId = :schoolId', { schoolId });
//     }

//     const classEntity = await query.getOne();

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${classId} not found`);
//     }

//     return classEntity.students || [];
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async calculateAndUpdateRanks(classId: string, term: string, schoolId?: string) {
//     const query = this.classRepository
//       .createQueryBuilder('class')
//       .leftJoinAndSelect('class.students', 'students')
//       .where('class.id = :classId', { classId });

//     if (schoolId) {
//       query.andWhere('class.schoolId = :schoolId', { schoolId });
//     }

//     const classEntity = await query.getOne();

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${classId} not found`);
//     }

//     const studentIds = classEntity.students.map(s => s.id);
//     const results: any[] = [];

//     for (const studentId of studentIds) {
//       const assessments = await this.assessmentRepository.find({
//         where: {
//           student: { id: studentId },
//           assessmentType: In(['qa1', 'qa2', 'end_of_term'])
//         },
//         relations: ['subject']
//       });

//       const qa1Total = assessments
//         .filter(a => a.assessmentType === 'qa1')
//         .reduce((sum, a) => sum + a.score, 0);

//       const qa2Total = assessments
//         .filter(a => a.assessmentType === 'qa2')
//         .reduce((sum, a) => sum + a.score, 0);

//       const endTermTotal = assessments
//         .filter(a => a.assessmentType === 'end_of_term')
//         .reduce((sum, a) => sum + a.score, 0);

//       const qa1Subjects = assessments.filter(a => a.assessmentType === 'qa1' && a.score > 0).length;
//       const qa2Subjects = assessments.filter(a => a.assessmentType === 'qa2' && a.score > 0).length;
//       const endTermSubjects = assessments.filter(a => a.assessmentType === 'end_of_term' && a.score > 0).length;

//       const qa1Avg = qa1Subjects > 0 ? qa1Total / qa1Subjects : 0;
//       const qa2Avg = qa2Subjects > 0 ? qa2Total / qa2Subjects : 0;
//       const endTermAvg = endTermSubjects > 0 ? endTermTotal / endTermSubjects : 0;

//       results.push({
//         studentId,
//         qa1Avg,
//         qa2Avg,
//         endTermAvg,
//       });
//     }

//     const qa1Ranked = [...results]
//       .filter(r => r.qa1Avg > 0)
//       .sort((a, b) => b.qa1Avg - a.qa1Avg);

//     const qa2Ranked = [...results]
//       .filter(r => r.qa2Avg > 0)
//       .sort((a, b) => b.qa2Avg - a.qa2Avg);

//     const endTermRanked = [...results]
//       .filter(r => r.endTermAvg > 0)
//       .sort((a, b) => b.endTermAvg - a.endTermAvg);

//     for (const studentId of studentIds) {
//       let reportCard = await this.reportCardRepository.findOne({
//         where: {
//           student: { id: studentId },
//           term,
//         },
//       });

//       if (!reportCard) {
//         reportCard = this.reportCardRepository.create({
//           student: { id: studentId },
//           term,
//           totalStudents: studentIds.length,
//         });
//       }

//       const studentResult = results.find(r => r.studentId === studentId);
//       if (studentResult) {
//         const qa1Index = qa1Ranked.findIndex(r => r.studentId === studentId);
//         reportCard.qa1Rank = qa1Index >= 0 ? qa1Index + 1 : 0;

//         const qa2Index = qa2Ranked.findIndex(r => r.studentId === studentId);
//         reportCard.qa2Rank = qa2Index >= 0 ? qa2Index + 1 : 0;

//         const endTermIndex = endTermRanked.findIndex(r => r.studentId === studentId);
//         reportCard.classRank = endTermIndex >= 0 ? endTermIndex + 1 : 0;

//         reportCard.totalStudents = studentIds.length;
//       }

//       await this.reportCardRepository.save(reportCard);
//     }

//     return { message: 'Ranks calculated and updated successfully' };
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async getClassResults(classId: string, schoolId?: string) {
//     const query = this.classRepository
//       .createQueryBuilder('class')
//       .leftJoinAndSelect('class.students', 'students')
//       .where('class.id = :classId', { classId });

//     if (schoolId) {
//       query.andWhere('class.schoolId = :schoolId', { schoolId });
//     }

//     const classEntity = await query.getOne();

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${classId} not found`);
//     }

//     const activeGradeConfig = await this.getActiveGradeConfiguration(schoolId);
//     const results: any[] = [];

//     for (const student of classEntity.students) {
//       const studentData = await this.findByExamNumber(student.examNumber, schoolId);
//       // const studentData = await this.findByExamNumber(student.examNumber, student.schoolId);

//       if (studentData && studentData.subjects && studentData.subjects.length > 0) {
//         results.push({
//           id: student.id,
//           name: student.name,
//           examNumber: student.examNumber,
//           classRank: studentData.classRank || 0,
//           totalScore: studentData.subjects.reduce((sum, subject) => {
//             const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
//             return sum + finalScore;
//           }, 0),
//           average: studentData.subjects.reduce((sum, subject) => {
//             const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
//             return sum + finalScore;
//           }, 0) / studentData.subjects.length,
//           overallGrade: this.calculateGrade(
//             studentData.subjects.reduce((sum, subject) => {
//               const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
//               return sum + finalScore;
//             }, 0) / studentData.subjects.length,
//             activeGradeConfig
//           ),
//           subjects: studentData.subjects.map(subject => ({
//             name: subject.name,
//             qa1: subject.qa1,
//             qa2: subject.qa2,
//             endOfTerm: subject.endOfTerm,
//             finalScore: subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3),
//             grade: subject.grade
//           }))
//         });
//       }
//     }

//     results.sort((a, b) => b.average - a.average);
//     results.forEach((result, index) => {
//       result.rank = index + 1;
//     });

//     return results;
//   }
//   // ===== END MODIFIED =====

//   // ===== START MODIFIED: Added schoolId parameter =====
//   async updateAllReportCardsWithNewGrades(schoolId?: string) {
//     const query = this.reportCardRepository
//       .createQueryBuilder('reportCard')
//       .leftJoinAndSelect('reportCard.student', 'student')
//       .leftJoinAndSelect('student.assessments', 'assessments')
//       .leftJoinAndSelect('assessments.subject', 'subject');

//     if (schoolId) {
//       query.where('student.schoolId = :schoolId', { schoolId });
//     }

//     const reportCards = await query.getMany();

//     const gradeConfig = await this.getActiveGradeConfiguration(schoolId);

//     for (const reportCard of reportCards) {
//       const student = reportCard.student;
//       const subjectMap = {};

//       student.assessments?.forEach((asm) => {
//         const subjectName = asm.subject?.name || 'Unknown';
//         if (!subjectMap[subjectName]) {
//           subjectMap[subjectName] = {
//             qa1: 0,
//             qa2: 0,
//             endOfTerm: 0,
//           };
//         }

//         if (asm.assessmentType === 'qa1') {
//           subjectMap[subjectName].qa1 = asm.score || 0;
//         } else if (asm.assessmentType === 'qa2') {
//           subjectMap[subjectName].qa2 = asm.score || 0;
//         } else if (asm.assessmentType === 'end_of_term') {
//           subjectMap[subjectName].endOfTerm = asm.score || 0;
//         }
//       });

//       let totalScore = 0;
//       let subjectCount = 0;

//       Object.values(subjectMap).forEach((subject: any) => {
//         const finalScore = this.calculateFinalScore(subject, gradeConfig);
//         if (finalScore > 0) {
//           totalScore += finalScore;
//           subjectCount++;
//         }
//       });

//       const overallAverage = subjectCount > 0 ? totalScore / subjectCount : 0;

//       reportCard.overallAverage = overallAverage;
//       reportCard.overallGrade = this.calculateGrade(overallAverage, gradeConfig);

//       await this.reportCardRepository.save(reportCard);
//     }

//     return { message: `Updated ${reportCards.length} report cards with new grade calculations` };
//   }
//   // ===== END MODIFIED =====
// }

// import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { In, Like, Repository } from 'typeorm';
// import { Student } from './entities/student.entity';
// import { Assessment } from './entities/assessment.entity';
// import { ReportCard } from './entities/report-card.entity';
// import { Subject } from './entities/subject.entity';
// import { GradeConfig } from './entities/grade-config.entity';
// import { Class } from './entities/class.entity';

// @Injectable()
// export class StudentsService {
//   constructor(
//     @InjectRepository(Student)
//     private studentRepository: Repository<Student>,
//     @InjectRepository(Assessment)
//     private assessmentRepository: Repository<Assessment>,
//     @InjectRepository(ReportCard)
//     private reportCardRepository: Repository<ReportCard>,
//     @InjectRepository(Subject)
//     private subjectRepository: Repository<Subject>,
//     @InjectRepository(GradeConfig)
//     private gradeConfigRepository: Repository<GradeConfig>,
//     @InjectRepository(Class)
//     private classRepository: Repository<Class>,
//   ) { }

//   async findByExamNumber(examNumber: string) {
//     const student = await this.studentRepository.findOne({
//       where: { examNumber: examNumber.toUpperCase() },
//       relations: ['assessments', 'assessments.subject', 'reportCards', 'class'],
//     });

//     if (!student) {
//       throw new NotFoundException(`Student ${examNumber} not found`);
//     }

//     const activeGradeConfig = await this.getActiveGradeConfiguration();

//     return this.formatStudentData(student, activeGradeConfig);
//   }

//   // async getActiveGradeConfiguration() {
//   //   const config = await this.gradeConfigRepository.findOne({
//   //     where: { is_active: true }
//   //   });

//   //   if (!config) {
//   //     return {
//   //       id: 'default',
//   //       configuration_name: 'Default (Average All)',
//   //       calculation_method: 'average_all',
//   //       weight_qa1: 33.33,
//   //       weight_qa2: 33.33,
//   //       weight_end_of_term: 33.34,
//   //       is_active: true,
//   //     };
//   //   }

//   //   return config;
//   // }

//   async getActiveGradeConfiguration() {
//     const config = await this.gradeConfigRepository.findOne({
//       where: { is_active: true }
//     });

//     if (!config) {
//       return {
//         id: 'default',
//         configuration_name: 'Default (Average All)',
//         calculation_method: 'average_all',
//         weight_qa1: 33.33,
//         weight_qa2: 33.33,
//         weight_end_of_term: 33.34,
//         pass_mark: 50,  // Add this line
//         is_active: true,
//       };
//     }

//     return config;
//   }

//   private formatStudentData(student: Student, gradeConfig: any) {
//     const subjectMap = {};

//     student.assessments?.forEach((asm) => {
//       const subjectName = asm.subject?.name || 'Unknown';
//       if (!subjectMap[subjectName]) {
//         subjectMap[subjectName] = {
//           name: subjectName,
//           qa1: 0,
//           qa2: 0,
//           endOfTerm: 0,
//           grade: 'N/A',
//         };
//       }

//       if (asm.assessmentType === 'qa1') {
//         subjectMap[subjectName].qa1 = asm.score;
//       } else if (asm.assessmentType === 'qa2') {
//         subjectMap[subjectName].qa2 = asm.score;
//       } else if (asm.assessmentType === 'end_of_term') {
//         subjectMap[subjectName].endOfTerm = asm.score;
//         // subjectMap[subjectName].grade = asm.grade;
//         subjectMap[subjectName].grade = this.calculateGrade(asm.score, gradeConfig);
//       }
//     });

//     // Object.values(subjectMap).forEach((subject: any) => {
//     //   subject.finalScore = this.calculateFinalScore(subject, gradeConfig);
//     //   // subject.grade = this.calculateGrade(subject.finalScore);
//     //   subject.grade = this.calculateGrade(subject.finalScore, gradeConfig);
//     // });

//     Object.values(subjectMap).forEach((subject: any) => {
//       // Pass student.assessments to calculateFinalScore
//       subject.finalScore = this.calculateFinalScore(subject, gradeConfig, student.assessments);
//       subject.grade = this.calculateGrade(subject.finalScore, gradeConfig);
//     });

//     const activeReport = student.reportCards?.[0] || {};

//     const className = student.class ? student.class.name : 'Unknown';
//     const term = student.class ? student.class.term : 'Term 1, 2024/2025';
//     const academicYear = student.class ? student.class.academic_year : '2024/2025';

//     const response: any = {
//       id: student.id,
//       name: student.name,
//       examNumber: student.examNumber,
//       class: className,
//       term: term,
//       academicYear: academicYear,
//       photo: student.photoUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
//       subjects: Object.values(subjectMap),
//       attendance: {
//         present: activeReport.daysPresent || 0,
//         absent: activeReport.daysAbsent || 0,
//         late: activeReport.daysLate || 0,
//       },
//       classRank: activeReport.classRank || 0,
//       qa1Rank: activeReport.qa1Rank || 0,
//       qa2Rank: activeReport.qa2Rank || 0,
//       totalStudents: activeReport.totalStudents || 0,
//       teacherRemarks: activeReport.teacherRemarks || 'No remarks available.',
//       gradeConfiguration: gradeConfig,
//     };

//     response.assessmentStats = this.calculateAssessmentStats(response, gradeConfig);

//     return response;
//   }

//   // private formatStudentData(student: Student, gradeConfig: any) {
//   //   const subjectMap = {};

//   //   student.assessments?.forEach((asm) => {
//   //     const subjectName = asm.subject?.name || 'Unknown';
//   //     if (!subjectMap[subjectName]) {
//   //       subjectMap[subjectName] = {
//   //         name: subjectName,
//   //         qa1: null,        // ← CHANGE FROM 0 TO null
//   //         qa2: null,        // ← CHANGE FROM 0 TO null
//   //         endOfTerm: null,  // ← CHANGE FROM 0 TO null
//   //         grade: 'N/A',
//   //       };
//   //     }

//   //     if (asm.assessmentType === 'qa1') {
//   //       subjectMap[subjectName].qa1 = asm.score;
//   //     } else if (asm.assessmentType === 'qa2') {
//   //       subjectMap[subjectName].qa2 = asm.score;
//   //     } else if (asm.assessmentType === 'end_of_term') {
//   //       subjectMap[subjectName].endOfTerm = asm.score;
//   //     }
//   //   });

//   //   Object.values(subjectMap).forEach((subject: any) => {
//   //     // Only calculate if we have valid scores
//   //     const hasScores = [subject.qa1, subject.qa2, subject.endOfTerm].some(score => score !== null && score > 0);

//   //     if (hasScores) {
//   //       subject.finalScore = this.calculateFinalScore(subject, gradeConfig);
//   //       subject.grade = this.calculateGrade(subject.finalScore, gradeConfig);
//   //     } else {
//   //       subject.finalScore = null;
//   //       subject.grade = 'N/A';
//   //     }
//   //   });

//   //   const subjects = Object.values(subjectMap);

//   //   // Filter out subjects with no scores at all
//   //   const subjectsWithScores = subjects.filter((s: any) =>
//   //     s.qa1 !== null || s.qa2 !== null || s.endOfTerm !== null
//   //   );

//   //   const activeReport = student.reportCards?.[0] || {};
//   //   const className = student.class ? student.class.name : 'Unknown';
//   //   const term = student.class ? student.class.term : 'Term 1, 2024/2025';
//   //   const academicYear = student.class ? student.class.academic_year : '2024/2025';

//   //   const response: any = {
//   //     id: student.id,
//   //     name: student.name,
//   //     examNumber: student.examNumber,
//   //     class: className,
//   //     term: term,
//   //     academicYear: academicYear,
//   //     photo: student.photoUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
//   //     subjects: subjectsWithScores, // ← USE FILTERED SUBJECTS
//   //     attendance: {
//   //       present: activeReport.daysPresent || 0,
//   //       absent: activeReport.daysAbsent || 0,
//   //       late: activeReport.daysLate || 0,
//   //     },
//   //     classRank: activeReport.classRank || 0,
//   //     qa1Rank: activeReport.qa1Rank || 0,
//   //     qa2Rank: activeReport.qa2Rank || 0,
//   //     totalStudents: activeReport.totalStudents || 0,
//   //     teacherRemarks: activeReport.teacherRemarks || 'No remarks available.',
//   //     gradeConfiguration: gradeConfig,
//   //   };

//   //   response.assessmentStats = this.calculateAssessmentStats(response, gradeConfig);
//   //   return response;
//   // }

//   // private calculateFinalScore(subject: any, gradeConfig: any): number {
//   //   switch (gradeConfig.calculation_method) {
//   //     case 'average_all':
//   //       return (subject.qa1 + subject.qa2 + subject.endOfTerm) / 3;

//   //     case 'end_of_term_only':
//   //       return subject.endOfTerm;

//   //     case 'weighted_average':
//   //       return (subject.qa1 * gradeConfig.weight_qa1 +
//   //         subject.qa2 * gradeConfig.weight_qa2 +
//   //         subject.endOfTerm * gradeConfig.weight_end_of_term) / 100;

//   //     default:
//   //       return (subject.qa1 + subject.qa2 + subject.endOfTerm) / 3;
//   //   }
//   // }


//   // private calculateFinalScore(subject: any, gradeConfig: any): number {
//   //   const qa1 = subject.qa1 || 0;
//   //   const qa2 = subject.qa2 || 0;
//   //   const endOfTerm = subject.endOfTerm || 0;

//   //   switch (gradeConfig.calculation_method) {
//   //     case 'average_all':
//   //       return (qa1 + qa2 + endOfTerm) / 3;

//   //     case 'end_of_term_only':
//   //       return endOfTerm;

//   //     case 'weighted_average':
//   //       return (qa1 * gradeConfig.weight_qa1 +
//   //         qa2 * gradeConfig.weight_qa2 +
//   //         endOfTerm * gradeConfig.weight_end_of_term) / 100;

//   //     default:
//   //       return (qa1 + qa2 + endOfTerm) / 3;
//   //   }
//   // }

//   private calculateFinalScore(subject: any, gradeConfig: any, studentAssessments?: any[]): number {
//     const qa1 = subject.qa1 || 0;
//     const qa2 = subject.qa2 || 0;
//     const endOfTerm = subject.endOfTerm || 0;

//     // CHECK: If student has QA1/QA2 but NO End of Term → force end_of_term_only
//     if (studentAssessments) {
//       const hasQA1 = studentAssessments.some(a => a.assessmentType === 'qa1' && a.score > 0);
//       const hasQA2 = studentAssessments.some(a => a.assessmentType === 'qa2' && a.score > 0);
//       const hasEndOfTerm = studentAssessments.some(a => a.assessmentType === 'end_of_term' && a.score > 0);

//       // Force end_of_term_only if only QA1/QA2 are entered
//       if ((hasQA1 || hasQA2) && !hasEndOfTerm) {
//         return endOfTerm; // This will be 0 until End of Term is entered
//       }
//     }

//     // Original calculation
//     switch (gradeConfig.calculation_method) {
//       case 'average_all':
//         return (qa1 + qa2 + endOfTerm) / 3;
//       case 'end_of_term_only':
//         return endOfTerm;
//       case 'weighted_average':
//         return (qa1 * gradeConfig.weight_qa1 +
//           qa2 * gradeConfig.weight_qa2 +
//           endOfTerm * gradeConfig.weight_end_of_term) / 100;
//       default:
//         return (qa1 + qa2 + endOfTerm) / 3;
//     }
//   }

//   // private calculateFinalScore(subject: any, gradeConfig: any): number {
//   //   // Convert null to 0 for calculations
//   //   const qa1 = subject.qa1 || 0;
//   //   const qa2 = subject.qa2 || 0;
//   //   const endOfTerm = subject.endOfTerm || 0;

//   //   switch (gradeConfig.calculation_method) {
//   //     case 'average_all':
//   //       // Count actual assessments (with scores > 0)
//   //       const assessments = [qa1, qa2, endOfTerm].filter(score => score > 0);
//   //       if (assessments.length === 0) return 0;
//   //       return assessments.reduce((sum, score) => sum + score, 0) / assessments.length;

//   //     case 'end_of_term_only':
//   //       return endOfTerm > 0 ? endOfTerm : 0;

//   //     case 'weighted_average':
//   //       // Only include assessments with scores
//   //       let totalWeight = 0;
//   //       let weightedSum = 0;

//   //       if (qa1 > 0) {
//   //         weightedSum += qa1 * gradeConfig.weight_qa1;
//   //         totalWeight += gradeConfig.weight_qa1;
//   //       }
//   //       if (qa2 > 0) {
//   //         weightedSum += qa2 * gradeConfig.weight_qa2;
//   //         totalWeight += gradeConfig.weight_qa2;
//   //       }
//   //       if (endOfTerm > 0) {
//   //         weightedSum += endOfTerm * gradeConfig.weight_end_of_term;
//   //         totalWeight += gradeConfig.weight_end_of_term;
//   //       }

//   //       return totalWeight > 0 ? weightedSum / totalWeight : 0;

//   //     default:
//   //       const defaultAssessments = [qa1, qa2, endOfTerm].filter(score => score > 0);
//   //       if (defaultAssessments.length === 0) return 0;
//   //       return defaultAssessments.reduce((sum, score) => sum + score, 0) / defaultAssessments.length;
//   //   }
//   // }

//   private calculateAssessmentStats(studentData: any, gradeConfig: any) {
//     const subjects = studentData.subjects;

//     const qa1Average = subjects.reduce((sum, s) => sum + s.qa1, 0) / subjects.length;
//     const qa2Average = subjects.reduce((sum, s) => sum + s.qa2, 0) / subjects.length;
//     const endOfTermAverage = subjects.reduce((sum, s) => sum + s.endOfTerm, 0) / subjects.length;

//     // const qa1Grade = this.calculateGrade(qa1Average);
//     // const qa2Grade = this.calculateGrade(qa2Average);
//     // const endOfTermGrade = this.calculateGrade(endOfTermAverage);

//     const qa1Grade = this.calculateGrade(qa1Average, gradeConfig);
//     const qa2Grade = this.calculateGrade(qa2Average, gradeConfig);
//     const endOfTermGrade = this.calculateGrade(endOfTermAverage, gradeConfig);

//     let overallAverage = (qa1Average + qa2Average + endOfTermAverage) / 3;
//     if (gradeConfig) {
//       overallAverage = this.calculateFinalScore(
//         { qa1: qa1Average, qa2: qa2Average, endOfTerm: endOfTermAverage },
//         gradeConfig
//       );
//     }

//     return {
//       qa1: {
//         classRank: studentData.qa1Rank || 0,
//         termAverage: parseFloat(qa1Average.toFixed(1)),
//         overallGrade: qa1Grade,
//       },
//       qa2: {
//         classRank: studentData.qa2Rank || 0,
//         termAverage: parseFloat(qa2Average.toFixed(1)),
//         overallGrade: qa2Grade,
//       },
//       endOfTerm: {
//         classRank: studentData.classRank,
//         termAverage: parseFloat(endOfTermAverage.toFixed(1)),
//         overallGrade: endOfTermGrade,
//         attendance: studentData.attendance
//       },
//       overall: {
//         termAverage: parseFloat(overallAverage.toFixed(1)),
//         calculationMethod: gradeConfig?.calculation_method || 'average_all'
//       }
//     };
//   }

//   // private calculateAssessmentStats(studentData: any, gradeConfig: any) {
//   //   const subjects = studentData.subjects;

//   //   // Only include subjects with actual scores (> 0 and not null)
//   //   const subjectsWithQa1 = subjects.filter(s => s.qa1 > 0);
//   //   const subjectsWithQa2 = subjects.filter(s => s.qa2 > 0);
//   //   const subjectsWithEndOfTerm = subjects.filter(s => s.endOfTerm > 0);

//   //   const qa1Average = subjectsWithQa1.length > 0
//   //     ? subjectsWithQa1.reduce((sum, s) => sum + s.qa1, 0) / subjectsWithQa1.length
//   //     : 0;

//   //   const qa2Average = subjectsWithQa2.length > 0
//   //     ? subjectsWithQa2.reduce((sum, s) => sum + s.qa2, 0) / subjectsWithQa2.length
//   //     : 0;

//   //   const endOfTermAverage = subjectsWithEndOfTerm.length > 0
//   //     ? subjectsWithEndOfTerm.reduce((sum, s) => sum + s.endOfTerm, 0) / subjectsWithEndOfTerm.length
//   //     : 0;

//   //   const qa1Grade = qa1Average > 0 ? this.calculateGrade(qa1Average, gradeConfig) : 'N/A';
//   //   const qa2Grade = qa2Average > 0 ? this.calculateGrade(qa2Average, gradeConfig) : 'N/A';
//   //   const endOfTermGrade = endOfTermAverage > 0 ? this.calculateGrade(endOfTermAverage, gradeConfig) : 'N/A';

//   //   let overallAverage = 0;
//   //   const validAverages = [qa1Average, qa2Average, endOfTermAverage].filter(avg => avg > 0);
//   //   if (validAverages.length > 0) {
//   //     if (gradeConfig) {
//   //       overallAverage = this.calculateFinalScore(
//   //         { qa1: qa1Average, qa2: qa2Average, endOfTerm: endOfTermAverage },
//   //         gradeConfig
//   //       );
//   //     } else {
//   //       overallAverage = validAverages.reduce((sum, avg) => sum + avg, 0) / validAverages.length;
//   //     }
//   //   }

//   //   return {
//   //     qa1: {
//   //       classRank: studentData.qa1Rank || 0,
//   //       termAverage: parseFloat(qa1Average.toFixed(1)),
//   //       overallGrade: qa1Grade,
//   //     },
//   //     qa2: {
//   //       classRank: studentData.qa2Rank || 0,
//   //       termAverage: parseFloat(qa2Average.toFixed(1)),
//   //       overallGrade: qa2Grade,
//   //     },
//   //     endOfTerm: {
//   //       classRank: studentData.classRank,
//   //       termAverage: parseFloat(endOfTermAverage.toFixed(1)),
//   //       overallGrade: endOfTermGrade,
//   //       attendance: studentData.attendance
//   //     },
//   //     overall: {
//   //       termAverage: parseFloat(overallAverage.toFixed(1)),
//   //       calculationMethod: gradeConfig?.calculation_method || 'average_all'
//   //     }
//   //   };
//   // }

//   async findAll() {
//     return this.studentRepository.find({
//       relations: ['class'],
//       order: { examNumber: 'ASC' },
//     });
//   }

//   async findAllSubjects() {
//     return this.subjectRepository.find({
//       order: { name: 'ASC' },
//       select: ['id', 'name'],
//     });
//   }

//   // async create(studentData: any) {
//   //   const classEntity = await this.classRepository.findOne({
//   //     where: { id: studentData.class_id }
//   //   });

//   //   if (!classEntity) {
//   //     throw new NotFoundException(`Class ${studentData.class_id} not found`);
//   //   }

//   //   const studentCount = await this.studentRepository.count({
//   //     where: { class: { id: studentData.class_id } }
//   //   });

//   //   const classCode = classEntity.name
//   //     .replace(/[^a-zA-Z0-9]/g, '')
//   //     .toUpperCase()
//   //     .substring(0, 6);
//   //   const nextNumber = studentCount + 1;
//   //   const examNumber = `${classCode}-${nextNumber.toString().padStart(3, '0')}`;

//   //   const student = this.studentRepository.create({
//   //     name: studentData.name,
//   //     examNumber: examNumber,
//   //     class: classEntity,
//   //     photoUrl: studentData.photo_url,
//   //   });

//   //   return this.studentRepository.save(student);
//   // }


//   async create(studentData: any) {
//     const classEntity = await this.classRepository.findOne({
//       where: { id: studentData.class_id }
//     });

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${studentData.class_id} not found`);
//     }

//     const currentYear = new Date().getFullYear().toString().slice(-2);
//     const classNumberMatch = classEntity.name.match(/\d+/);
//     const classNumber = classNumberMatch ? classNumberMatch[0] : '0';
//     const prefix = `${currentYear}-${classNumber}`;

//     const allStudents = await this.studentRepository.find({
//       select: ['examNumber'],
//       where: {
//         examNumber: Like(`${prefix}%`)
//       },
//       order: { examNumber: 'DESC' },
//       take: 1
//     });

//     let nextNumber = 1;
//     if (allStudents.length > 0 && allStudents[0].examNumber) {
//       const lastExamNumber = allStudents[0].examNumber;
//       const lastNumberStr = lastExamNumber.slice(prefix.length); // FIXED: Removed +1
//       const lastNumber = parseInt(lastNumberStr) || 0;
//       nextNumber = lastNumber + 1;
//     }

//     const examNumber = `${prefix}${nextNumber.toString().padStart(3, '0')}`;

//     const student = this.studentRepository.create({
//       name: studentData.name,
//       examNumber: examNumber,
//       class: classEntity,
//       photoUrl: studentData.photo_url,
//     });

//     return this.studentRepository.save(student);
//   }

//   // async create(studentData: any) {
//   //   const classEntity = await this.classRepository.findOne({
//   //     where: { id: studentData.class_id }
//   //   });

//   //   if (!classEntity) {
//   //     throw new NotFoundException(`Class ${studentData.class_id} not found`);
//   //   }

//   //   // Get current year (e.g., 2025)
//   //   const currentYear = new Date().getFullYear().toString().slice(-2); // "25"

//   //   // Find highest exam number starting with this year
//   //   const allStudents = await this.studentRepository.find({
//   //     select: ['examNumber'],
//   //     where: {
//   //       examNumber: Like(`${currentYear}%`) // Find exam numbers starting with current year
//   //     },
//   //     order: { examNumber: 'DESC' },
//   //     take: 1
//   //   });

//   //   let nextNumber = 1;
//   //   if (allStudents.length > 0 && allStudents[0].examNumber) {
//   //     // Extract the number part (e.g., "001" from "25001")
//   //     const lastExamNumber = allStudents[0].examNumber;
//   //     const lastNumberStr = lastExamNumber.slice(2); // Remove "25" from "25001" -> "001"
//   //     const lastNumber = parseInt(lastNumberStr) || 0;
//   //     nextNumber = lastNumber + 1;
//   //   }

//   //   // Format: YY + 3-digit number (e.g., "25001", "25002")
//   //   const examNumber = `${currentYear}${nextNumber.toString().padStart(3, '0')}`;

//   //   const student = this.studentRepository.create({
//   //     name: studentData.name,
//   //     examNumber: examNumber,
//   //     class: classEntity,
//   //     photoUrl: studentData.photo_url,
//   //   });

//   //   return this.studentRepository.save(student);
//   // }

//   // async create(studentData: any) {
//   //   const classEntity = await this.classRepository.findOne({
//   //     where: { id: studentData.class_id }
//   //   });

//   //   if (!classEntity) {
//   //     throw new NotFoundException(`Class ${studentData.class_id} not found`);
//   //   }

//   //   // Get current year (e.g., 2025 -> "25")
//   //   const currentYear = new Date().getFullYear().toString().slice(-2);

//   //   // Extract class number from class name (e.g., "Standard 8" -> "8")
//   //   const classNumberMatch = classEntity.name.match(/\d+/);
//   //   const classNumber = classNumberMatch ? classNumberMatch[0] : '0';

//   //   // Find highest exam number for this year-class combination
//   //   const prefix = `${currentYear}-${classNumber}`; // e.g., "25-8"

//   //   const allStudents = await this.studentRepository.find({
//   //     select: ['examNumber'],
//   //     where: {
//   //       examNumber: Like(`${prefix}%`) // Find "25-8XXX"
//   //     },
//   //     order: { examNumber: 'DESC' },
//   //     take: 1
//   //   });

//   //   let nextNumber = 1;
//   //   if (allStudents.length > 0 && allStudents[0].examNumber) {
//   //     // Extract number from "25-8001" -> "001"
//   //     const lastExamNumber = allStudents[0].examNumber;
//   //     const lastNumberStr = lastExamNumber.slice(prefix.length + 1); // Remove "25-8"
//   //     const lastNumber = parseInt(lastNumberStr) || 0;
//   //     nextNumber = lastNumber + 1;
//   //   }

//   //   // Format: YY-CLASS-3DIGIT (e.g., "25-8001", "25-8002")
//   //   const examNumber = `${prefix}${nextNumber.toString().padStart(3, '0')}`;

//   //   const student = this.studentRepository.create({
//   //     name: studentData.name,
//   //     examNumber: examNumber,
//   //     class: classEntity,
//   //     photoUrl: studentData.photo_url,
//   //   });

//   //   return this.studentRepository.save(student);
//   // }

//   async update(id: string, updates: any) {
//     const student = await this.studentRepository.findOne({
//       where: { id },
//       relations: ['class']
//     });

//     if (!student) {
//       throw new NotFoundException(`Student ${id} not found`);
//     }

//     const allowedUpdates = ['name', 'photoUrl'];

//     if (updates.class_id) {
//       const classEntity = await this.classRepository.findOne({
//         where: { id: updates.class_id }
//       });

//       if (!classEntity) {
//         throw new NotFoundException(`Class ${updates.class_id} not found`);
//       }
//       student.class = classEntity;
//     }

//     allowedUpdates.forEach(field => {
//       if (updates[field] !== undefined) {
//         student[field] = updates[field];
//       }
//     });

//     return this.studentRepository.save(student);
//   }

//   async remove(id: string) {
//     const student = await this.studentRepository.findOne({ where: { id } });
//     if (!student) {
//       throw new NotFoundException(`Student ${id} not found`);
//     }
//     return this.studentRepository.remove(student);
//   }

//   async getStudentAssessments(studentId: string) {
//     return this.assessmentRepository.find({
//       where: { student: { id: studentId } },
//       relations: ['subject'],
//       order: { subject: { name: 'ASC' } },
//     });
//   }

//   async getStudentReportCard(studentId: string, term: string) {
//     return this.reportCardRepository.findOne({
//       where: {
//         student: { id: studentId },
//         term,
//       },
//     });
//   }

//   // async upsertAssessment(assessmentData: any) {
//   //   const activeConfig = await this.getActiveGradeConfiguration();
//   //   const data = {
//   //     student: { id: assessmentData.student_id || assessmentData.studentId },
//   //     subject: { id: assessmentData.subject_id || assessmentData.subjectId },
//   //     assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
//   //     score: assessmentData.score,
//   //     // grade: assessmentData.grade,

//   //     grade: this.calculateGrade(assessmentData.score, activeConfig),
//   //   };

//   //   const existing = await this.assessmentRepository.findOne({
//   //     where: {
//   //       student: { id: data.student.id },
//   //       subject: { id: data.subject.id },
//   //       assessmentType: data.assessmentType,
//   //     },
//   //   });

//   //   if (existing) {
//   //     Object.assign(existing, {
//   //       score: data.score,
//   //       grade: data.grade,
//   //     });
//   //     return this.assessmentRepository.save(existing);
//   //   } else {
//   //     const assessment = this.assessmentRepository.create(data);
//   //     return this.assessmentRepository.save(assessment);
//   //   }
//   // }

//   async upsertAssessment(assessmentData: any) {
//     // ADD THIS AT THE START - deletes if score is 0
//     if (assessmentData.score === 0) {
//       const existing = await this.assessmentRepository.findOne({
//         where: {
//           student: { id: assessmentData.student_id || assessmentData.studentId },
//           subject: { id: assessmentData.subject_id || assessmentData.subjectId },
//           assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
//         },
//       });

//       if (existing) {
//         await this.assessmentRepository.remove(existing);
//         return { deleted: true };
//       }
//       return { deleted: true };
//     }

//     // KEEP EVERYTHING ELSE EXACTLY THE SAME
//     const activeConfig = await this.getActiveGradeConfiguration();
//     const data = {
//       student: { id: assessmentData.student_id || assessmentData.studentId },
//       subject: { id: assessmentData.subject_id || assessmentData.subjectId },
//       assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
//       score: assessmentData.score,
//       grade: this.calculateGrade(assessmentData.score, activeConfig),
//     };

//     const existing = await this.assessmentRepository.findOne({
//       where: {
//         student: { id: data.student.id },
//         subject: { id: data.subject.id },
//         assessmentType: data.assessmentType,
//       },
//     });

//     if (existing) {
//       Object.assign(existing, {
//         score: data.score,
//         grade: data.grade,
//       });
//       return this.assessmentRepository.save(existing);
//     } else {
//       const assessment = this.assessmentRepository.create(data);
//       return this.assessmentRepository.save(assessment);
//     }
//   }

//   // async upsertReportCard(reportCardData: any) {
//   //   const data = {
//   //     student: { id: reportCardData.student_id || reportCardData.studentId },
//   //     term: reportCardData.term,
//   //     classRank: reportCardData.class_rank || reportCardData.classRank || 0,
//   //     qa1Rank: reportCardData.qa1_rank || reportCardData.qa1Rank || 0,
//   //     qa2Rank: reportCardData.qa2_rank || reportCardData.qa2Rank || 0,
//   //     totalStudents: reportCardData.total_students || reportCardData.totalStudents || 0,
//   //     daysPresent: reportCardData.days_present || reportCardData.daysPresent || 0,
//   //     daysAbsent: reportCardData.days_absent || reportCardData.daysAbsent || 0,
//   //     daysLate: reportCardData.days_late || reportCardData.daysLate || 0,
//   //     teacherRemarks: reportCardData.teacher_remarks || reportCardData.teacherRemarks || '',
//   //   };

//   //   const existing = await this.reportCardRepository.findOne({
//   //     where: {
//   //       student: { id: data.student.id },
//   //       term: data.term,
//   //     },
//   //   });

//   //   if (existing) {
//   //     Object.assign(existing, data);
//   //     return this.reportCardRepository.save(existing);
//   //   } else {
//   //     const reportCard = this.reportCardRepository.create(data);
//   //     return this.reportCardRepository.save(reportCard);
//   //   }
//   // }


//   async upsertReportCard(reportCardData: any) {
//     const data = {
//       student: { id: reportCardData.student_id || reportCardData.studentId },
//       term: reportCardData.term,
//       daysPresent: reportCardData.days_present || reportCardData.daysPresent || 0,
//       daysAbsent: reportCardData.days_absent || reportCardData.daysAbsent || 0,
//       daysLate: reportCardData.days_late || reportCardData.daysLate || 0,
//       teacherRemarks: reportCardData.teacher_remarks || reportCardData.teacherRemarks || '',
//     };

//     // Only set ranks if provided (for auto-ranking, don't send them)
//     if (reportCardData.class_rank !== undefined) {
//       data['classRank'] = reportCardData.class_rank;
//     }
//     if (reportCardData.qa1_rank !== undefined) {
//       data['qa1Rank'] = reportCardData.qa1_rank;
//     }
//     if (reportCardData.qa2_rank !== undefined) {
//       data['qa2Rank'] = reportCardData.qa2_rank;
//     }
//     if (reportCardData.total_students !== undefined) {
//       data['totalStudents'] = reportCardData.total_students;
//     }

//     const existing = await this.reportCardRepository.findOne({
//       where: {
//         student: { id: data.student.id },
//         term: data.term,
//       },
//     });

//     if (existing) {
//       Object.assign(existing, data);
//       return this.reportCardRepository.save(existing);
//     } else {
//       const reportCard = this.reportCardRepository.create(data);
//       return this.reportCardRepository.save(reportCard);
//     }
//   }

//   async createSubject(subjectData: { name: string }) {
//     const subject = this.subjectRepository.create(subjectData);
//     return this.subjectRepository.save(subject);
//   }

//   async deleteSubject(id: string) {
//     const subject = await this.subjectRepository.findOne({ where: { id } });
//     if (!subject) {
//       throw new NotFoundException(`Subject ${id} not found`);
//     }
//     return this.subjectRepository.remove(subject);
//   }

//   // calculateGrade(score: number): string {

//   //   if (score >= 80) return 'A';
//   //   if (score >= 70) return 'B';
//   //   if (score >= 60) return 'C';
//   //   if (score >= 50) return 'D';

//   //   return 'F';
//   // }

//   calculateGrade(score: number, gradeConfig?: any): string {
//     const passMark = gradeConfig?.pass_mark || 50;  // Now gradeConfig exists as a parameter
//     if (score >= 80) return 'A';
//     if (score >= 70) return 'B';
//     if (score >= 60) return 'C';
//     if (score >= passMark) return 'D';
//     return 'F';
//   }

//   async getAllGradeConfigurations() {
//     return this.gradeConfigRepository.find({
//       order: { is_active: 'DESC', created_at: 'DESC' }
//     });
//   }

//   async createGradeConfiguration(data: Partial<GradeConfig>) {
//     const config = this.gradeConfigRepository.create(data);
//     return this.gradeConfigRepository.save(config);
//   }

//   async updateGradeConfiguration(id: string, updates: Partial<GradeConfig>) {
//     const config = await this.gradeConfigRepository.findOne({ where: { id } });
//     if (!config) {
//       throw new NotFoundException(`Grade configuration ${id} not found`);
//     }

//     Object.assign(config, updates);
//     return this.gradeConfigRepository.save(config);
//   }

//   // async setActiveConfiguration(id: string) {
//   //   await this.gradeConfigRepository.update({ is_active: true }, { is_active: false });

//   //   const config = await this.gradeConfigRepository.findOne({ where: { id } });
//   //   if (!config) {
//   //     throw new NotFoundException(`Grade configuration ${id} not found`);
//   //   }

//   //   config.is_active = true;
//   //   return this.gradeConfigRepository.save(config);
//   // }

//   async setActiveConfiguration(id: string) {
//     await this.gradeConfigRepository.update({ is_active: true }, { is_active: false });

//     const config = await this.gradeConfigRepository.findOne({ where: { id } });
//     if (!config) {
//       throw new NotFoundException(`Grade configuration ${id} not found`);
//     }

//     config.is_active = true;
//     await this.gradeConfigRepository.save(config);

//     // ADD THIS ONE LINE HERE ▼
//     await this.updateAllReportCardsWithNewGrades();

//     return config;
//   }

//   // --- NEW CLASS METHODS ---
//   async findAllClasses() {
//     return this.classRepository.find({
//       order: { created_at: 'DESC' },
//       relations: ['students'],
//     });
//   }

//   // async createClass(classData: { name: string; academic_year: string; term: string }) {
//   //   const classCode = classData.name
//   //     .replace(/[^a-zA-Z0-9]/g, '')
//   //     .toUpperCase()
//   //     .substring(0, 6) +
//   //     '-' +
//   //     classData.academic_year.replace('/', '-') +
//   //     '-' +
//   //     classData.term.replace(' ', '').substring(0, 2).toUpperCase();

//   //   const classEntity = this.classRepository.create({
//   //     ...classData,
//   //     class_code: classCode,
//   //   });

//   //   return this.classRepository.save(classEntity);
//   // }

//   async createClass(classData: { name: string; academic_year: string; term: string }) {
//     // First, check if a class with same name, year, and term already exists
//     const existingClass = await this.classRepository.findOne({
//       where: {
//         name: classData.name,
//         academic_year: classData.academic_year,
//         term: classData.term
//       }
//     });

//     if (existingClass) {
//       throw new ConflictException(
//         `Class "${classData.name}" already exists for ${classData.academic_year} ${classData.term}`
//       );
//     }

//     // Generate unique code with a random suffix
//     const nameCode = classData.name
//       .replace(/[^a-zA-Z0-9]/g, '')
//       .toUpperCase()
//       .substring(0, 4);

//     const classNumber = classData.name.match(/\d+/)?.[0] || '00';
//     const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();

//     const classCode = `${nameCode}${classNumber}-${classData.academic_year.replace('/', '-')}-${classData.term.substring(0, 2).toUpperCase()}-${randomSuffix}`;

//     const classEntity = this.classRepository.create({
//       ...classData,
//       class_code: classCode,
//     });

//     return this.classRepository.save(classEntity);
//   }

//   async deleteClass(id: string) {
//     const classEntity = await this.classRepository.findOne({
//       where: { id },
//       relations: ['students']
//     });

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${id} not found`);
//     }

//     if (classEntity.students && classEntity.students.length > 0) {
//       throw new NotFoundException(`Cannot delete class with students. Delete students first.`);
//     }

//     return this.classRepository.remove(classEntity);
//   }

//   async getClassStudents(classId: string) {
//     const classEntity = await this.classRepository.findOne({
//       where: { id: classId },
//       relations: ['students'],
//     });

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${classId} not found`);
//     }

//     return classEntity.students || [];
//   }
//   //NEW CODE
//   async calculateAndUpdateRanks(classId: string, term: string) {
//     const classEntity = await this.classRepository.findOne({
//       where: { id: classId },
//       relations: ['students'],
//     });

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${classId} not found`);
//     }

//     const studentIds = classEntity.students.map(s => s.id);
//     const results: any[] = [];

//     for (const studentId of studentIds) {
//       const assessments = await this.assessmentRepository.find({
//         where: {
//           student: { id: studentId },
//           assessmentType: In(['qa1', 'qa2', 'end_of_term'])
//         },
//         relations: ['subject']
//       });

//       const qa1Total = assessments
//         .filter(a => a.assessmentType === 'qa1')
//         .reduce((sum, a) => sum + a.score, 0);

//       const qa2Total = assessments
//         .filter(a => a.assessmentType === 'qa2')
//         .reduce((sum, a) => sum + a.score, 0);

//       const endTermTotal = assessments
//         .filter(a => a.assessmentType === 'end_of_term')
//         .reduce((sum, a) => sum + a.score, 0);

//       const qa1Subjects = assessments.filter(a => a.assessmentType === 'qa1' && a.score > 0).length;
//       const qa2Subjects = assessments.filter(a => a.assessmentType === 'qa2' && a.score > 0).length;
//       const endTermSubjects = assessments.filter(a => a.assessmentType === 'end_of_term' && a.score > 0).length;

//       const qa1Avg = qa1Subjects > 0 ? qa1Total / qa1Subjects : 0;
//       const qa2Avg = qa2Subjects > 0 ? qa2Total / qa2Subjects : 0;
//       const endTermAvg = endTermSubjects > 0 ? endTermTotal / endTermSubjects : 0;

//       results.push({
//         studentId,
//         qa1Avg,
//         qa2Avg,
//         endTermAvg,
//       });
//     }

//     const qa1Ranked = [...results]
//       .filter(r => r.qa1Avg > 0)
//       .sort((a, b) => b.qa1Avg - a.qa1Avg);

//     const qa2Ranked = [...results]
//       .filter(r => r.qa2Avg > 0)
//       .sort((a, b) => b.qa2Avg - a.qa2Avg);

//     const endTermRanked = [...results]
//       .filter(r => r.endTermAvg > 0)
//       .sort((a, b) => b.endTermAvg - a.endTermAvg);

//     for (const studentId of studentIds) {
//       let reportCard = await this.reportCardRepository.findOne({
//         where: {
//           student: { id: studentId },
//           term,
//         },
//       });

//       if (!reportCard) {
//         reportCard = this.reportCardRepository.create({
//           student: { id: studentId },
//           term,
//           totalStudents: studentIds.length,
//         });
//       }

//       const studentResult = results.find(r => r.studentId === studentId);
//       if (studentResult) {
//         const qa1Index = qa1Ranked.findIndex(r => r.studentId === studentId);
//         reportCard.qa1Rank = qa1Index >= 0 ? qa1Index + 1 : 0;

//         const qa2Index = qa2Ranked.findIndex(r => r.studentId === studentId);
//         reportCard.qa2Rank = qa2Index >= 0 ? qa2Index + 1 : 0;

//         const endTermIndex = endTermRanked.findIndex(r => r.studentId === studentId);
//         reportCard.classRank = endTermIndex >= 0 ? endTermIndex + 1 : 0;

//         reportCard.totalStudents = studentIds.length;
//       }

//       await this.reportCardRepository.save(reportCard);
//     }

//     return { message: 'Ranks calculated and updated successfully' };
//   }

//   async getClassResults(classId: string) {
//     const classEntity = await this.classRepository.findOne({
//       where: { id: classId },
//       relations: ['students'],
//     });

//     if (!classEntity) {
//       throw new NotFoundException(`Class ${classId} not found`);
//     }

//     const activeGradeConfig = await this.getActiveGradeConfiguration();
//     const results: any[] = []; // FIXED: Add type annotation

//     for (const student of classEntity.students) {
//       // Get student data with assessments
//       const studentData = await this.findByExamNumber(student.examNumber);

//       if (studentData && studentData.subjects && studentData.subjects.length > 0) {
//         results.push({
//           id: student.id,
//           name: student.name,
//           examNumber: student.examNumber,
//           classRank: studentData.classRank || 0,
//           totalScore: studentData.subjects.reduce((sum, subject) => {
//             const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
//             return sum + finalScore;
//           }, 0),
//           average: studentData.subjects.reduce((sum, subject) => {
//             const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
//             return sum + finalScore;
//           }, 0) / studentData.subjects.length,
//           overallGrade: this.calculateGrade(
//             studentData.subjects.reduce((sum, subject) => {
//               const finalScore = subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3);
//               return sum + finalScore;
//             }, 0) / studentData.subjects.length,
//             activeGradeConfig
//           ),
//           subjects: studentData.subjects.map(subject => ({
//             name: subject.name,
//             qa1: subject.qa1,
//             qa2: subject.qa2,
//             endOfTerm: subject.endOfTerm,
//             finalScore: subject.finalScore || ((subject.qa1 + subject.qa2 + subject.endOfTerm) / 3),
//             grade: subject.grade
//           }))
//         });
//       }
//     }

//     // Sort by average (descending) and assign ranks
//     results.sort((a, b) => b.average - a.average);
//     results.forEach((result, index) => {
//       result.rank = index + 1;
//     });

//     return results;
//   }

//   async updateAllReportCardsWithNewGrades() {
//     // 1. Get all report cards
//     const reportCards = await this.reportCardRepository.find({
//       relations: ['student', 'student.assessments', 'student.assessments.subject']
//     });

//     // 2. Get active grade config
//     const gradeConfig = await this.getActiveGradeConfiguration();

//     // 3. Update each report card
//     for (const reportCard of reportCards) {
//       const student = reportCard.student;

//       // Group assessments by subject
//       const subjectMap = {};

//       student.assessments?.forEach((asm) => {
//         const subjectName = asm.subject?.name || 'Unknown';
//         if (!subjectMap[subjectName]) {
//           subjectMap[subjectName] = {
//             qa1: 0,
//             qa2: 0,
//             endOfTerm: 0,
//           };
//         }

//         if (asm.assessmentType === 'qa1') {
//           subjectMap[subjectName].qa1 = asm.score || 0;
//         } else if (asm.assessmentType === 'qa2') {
//           subjectMap[subjectName].qa2 = asm.score || 0;
//         } else if (asm.assessmentType === 'end_of_term') {
//           subjectMap[subjectName].endOfTerm = asm.score || 0;
//         }
//       });

//       // Calculate overall average
//       let totalScore = 0;
//       let subjectCount = 0;

//       Object.values(subjectMap).forEach((subject: any) => {
//         const finalScore = this.calculateFinalScore(subject, gradeConfig);
//         if (finalScore > 0) {
//           totalScore += finalScore;
//           subjectCount++;
//         }
//       });

//       const overallAverage = subjectCount > 0 ? totalScore / subjectCount : 0;

//       // Save to report card
//       reportCard.overallAverage = overallAverage;
//       reportCard.overallGrade = this.calculateGrade(overallAverage, gradeConfig);

//       await this.reportCardRepository.save(reportCard);
//     }

//     return { message: `Updated ${reportCards.length} report cards with new grade calculations` };
//   }
// }


// import { Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Student } from './entities/student.entity';
// import { Assessment } from './entities/assessment.entity';
// import { ReportCard } from './entities/report-card.entity';
// import { Subject } from './entities/subject.entity';
// import { GradeConfig } from './entities/grade-config.entity';

// @Injectable()
// export class StudentsService {
//   constructor(
//     @InjectRepository(Student)
//     private studentRepository: Repository<Student>,
//     @InjectRepository(Assessment)
//     private assessmentRepository: Repository<Assessment>,
//     @InjectRepository(ReportCard)
//     private reportCardRepository: Repository<ReportCard>,
//     @InjectRepository(Subject)
//     private subjectRepository: Repository<Subject>,
//     @InjectRepository(GradeConfig)
//     private gradeConfigRepository: Repository<GradeConfig>,
//   ) { }

//   async findByExamNumber(examNumber: string) {
//     const student = await this.studentRepository.findOne({
//       where: { examNumber: examNumber.toUpperCase() },
//       relations: ['assessments', 'assessments.subject', 'reportCards'],
//     });

//     if (!student) {
//       throw new NotFoundException(`Student ${examNumber} not found`);
//     }

//     const activeGradeConfig = await this.getActiveGradeConfiguration();

//     return this.formatStudentData(student, activeGradeConfig);
//   }

//   async getActiveGradeConfiguration() {
//     const config = await this.gradeConfigRepository.findOne({
//       where: { is_active: true }
//     });

//     if (!config) {
//       return {
//         id: 'default',
//         configuration_name: 'Default (Average All)',
//         calculation_method: 'average_all',
//         weight_qa1: 33.33,
//         weight_qa2: 33.33,
//         weight_end_of_term: 33.34,
//         is_active: true,
//       };
//     }

//     return config;
//   }

//   private formatStudentData(student: Student, gradeConfig: any) {
//     const subjectMap = {};

//     student.assessments?.forEach((asm) => {
//       const subjectName = asm.subject?.name || 'Unknown';
//       if (!subjectMap[subjectName]) {
//         subjectMap[subjectName] = {
//           name: subjectName,
//           qa1: 0,
//           qa2: 0,
//           endOfTerm: 0,
//           grade: 'N/A',
//         };
//       }

//       if (asm.assessmentType === 'qa1') {
//         subjectMap[subjectName].qa1 = asm.score;
//       } else if (asm.assessmentType === 'qa2') {
//         subjectMap[subjectName].qa2 = asm.score;
//       } else if (asm.assessmentType === 'end_of_term') {
//         subjectMap[subjectName].endOfTerm = asm.score;
//         subjectMap[subjectName].grade = asm.grade;
//       }
//     });

//     Object.values(subjectMap).forEach((subject: any) => {
//       subject.finalScore = this.calculateFinalScore(subject, gradeConfig);
//       subject.grade = this.calculateGrade(subject.finalScore);
//     });

//     const activeReport = student.reportCards?.[0] || {};

//     const response: any = {
//       id: student.id,
//       name: student.name,
//       examNumber: student.examNumber,
//       class: student.class,
//       term: student.term,
//       photo: student.photoUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
//       subjects: Object.values(subjectMap),
//       attendance: {
//         present: activeReport.daysPresent || 0,
//         absent: activeReport.daysAbsent || 0,
//         late: activeReport.daysLate || 0,
//       },
//       classRank: activeReport.classRank || 0,
//       qa1Rank: activeReport.qa1Rank || 0,     // ← ADDED
//       qa2Rank: activeReport.qa2Rank || 0,     // ← ADDED
//       totalStudents: activeReport.totalStudents || 0,
//       teacherRemarks: activeReport.teacherRemarks || 'No remarks available.',
//       gradeConfiguration: gradeConfig,
//     };

//     response.assessmentStats = this.calculateAssessmentStats(response, gradeConfig);

//     return response;
//   }

//   private calculateFinalScore(subject: any, gradeConfig: any): number {
//     switch (gradeConfig.calculation_method) {
//       case 'average_all':
//         return (subject.qa1 + subject.qa2 + subject.endOfTerm) / 3;

//       case 'end_of_term_only':
//         return subject.endOfTerm;

//       case 'weighted_average':
//         return (subject.qa1 * gradeConfig.weight_qa1 +
//           subject.qa2 * gradeConfig.weight_qa2 +
//           subject.endOfTerm * gradeConfig.weight_end_of_term) / 100;

//       default:
//         return (subject.qa1 + subject.qa2 + subject.endOfTerm) / 3;
//     }
//   }

//   private calculateAssessmentStats(studentData: any, gradeConfig: any) {
//     const subjects = studentData.subjects;

//     // Calculate averages
//     const qa1Average = subjects.reduce((sum, s) => sum + s.qa1, 0) / subjects.length;
//     const qa2Average = subjects.reduce((sum, s) => sum + s.qa2, 0) / subjects.length;
//     const endOfTermAverage = subjects.reduce((sum, s) => sum + s.endOfTerm, 0) / subjects.length;

//     // Calculate overall grades for each assessment
//     const qa1Grade = this.calculateGrade(qa1Average);
//     const qa2Grade = this.calculateGrade(qa2Average);
//     const endOfTermGrade = this.calculateGrade(endOfTermAverage);

//     // Overall average
//     let overallAverage = (qa1Average + qa2Average + endOfTermAverage) / 3;
//     if (gradeConfig) {
//       overallAverage = this.calculateFinalScore(
//         { qa1: qa1Average, qa2: qa2Average, endOfTerm: endOfTermAverage },
//         gradeConfig
//       );
//     }

//     return {
//       qa1: {
//         classRank: studentData.qa1Rank || 0, // Use QA1 rank
//         termAverage: parseFloat(qa1Average.toFixed(1)),
//         overallGrade: qa1Grade, // ADD OVERALL GRADE FOR QA1
//         // NO ATTENDANCE FIELD AT ALL
//       },
//       qa2: {
//         classRank: studentData.qa2Rank || 0, // Use QA2 rank
//         termAverage: parseFloat(qa2Average.toFixed(1)),
//         overallGrade: qa2Grade, // ADD OVERALL GRADE FOR QA2
//         // NO ATTENDANCE FIELD AT ALL
//       },
//       endOfTerm: {
//         classRank: studentData.classRank, // Overall rank from report card
//         termAverage: parseFloat(endOfTermAverage.toFixed(1)),
//         overallGrade: endOfTermGrade, // ADD OVERALL GRADE FOR END OF TERM
//         attendance: studentData.attendance // Keep attendance only for End of Term
//       },
//       overall: {
//         termAverage: parseFloat(overallAverage.toFixed(1)),
//         calculationMethod: gradeConfig?.calculation_method || 'average_all'
//       }
//     };
//   }
//   async findAll() {
//     return this.studentRepository.find({
//       order: { examNumber: 'ASC' },
//     });
//   }

//   async findAllSubjects() {
//     return this.subjectRepository.find({
//       order: { name: 'ASC' },
//       select: ['id', 'name'],
//     });
//   }

//   async create(studentData: any) {
//     const student = this.studentRepository.create({
//       ...studentData,
//       examNumber: studentData.examNumber?.toUpperCase() || studentData.exam_number?.toUpperCase(),
//     });
//     return this.studentRepository.save(student);
//   }

//   async update(id: string, updates: any) {
//     const student = await this.studentRepository.findOne({ where: { id } });
//     if (!student) {
//       throw new NotFoundException(`Student ${id} not found`);
//     }

//     const allowedUpdates = ['name', 'class', 'term', 'photoUrl'];
//     allowedUpdates.forEach(field => {
//       if (updates[field] !== undefined) {
//         student[field] = updates[field];
//       }
//     });

//     return this.studentRepository.save(student);
//   }

//   async remove(id: string) {
//     const student = await this.studentRepository.findOne({ where: { id } });
//     if (!student) {
//       throw new NotFoundException(`Student ${id} not found`);
//     }
//     return this.studentRepository.remove(student);
//   }

//   async getStudentAssessments(studentId: string) {
//     return this.assessmentRepository.find({
//       where: { student: { id: studentId } },
//       relations: ['subject'],
//       order: { subject: { name: 'ASC' } },
//     });
//   }

//   async getStudentReportCard(studentId: string, term: string) {
//     return this.reportCardRepository.findOne({
//       where: {
//         student: { id: studentId },
//         term,
//       },
//     });
//   }

//   async upsertAssessment(assessmentData: any) {
//     const data = {
//       student: { id: assessmentData.student_id || assessmentData.studentId },
//       subject: { id: assessmentData.subject_id || assessmentData.subjectId },
//       assessmentType: assessmentData.assessment_type || assessmentData.assessmentType,
//       score: assessmentData.score,
//       grade: assessmentData.grade,
//     };

//     const existing = await this.assessmentRepository.findOne({
//       where: {
//         student: { id: data.student.id },
//         subject: { id: data.subject.id },
//         assessmentType: data.assessmentType,
//       },
//     });

//     if (existing) {
//       Object.assign(existing, {
//         score: data.score,
//         grade: data.grade,
//       });
//       return this.assessmentRepository.save(existing);
//     } else {
//       const assessment = this.assessmentRepository.create(data);
//       return this.assessmentRepository.save(assessment);
//     }
//   }


//   async upsertReportCard(reportCardData: any) {
//     const data = {
//       student: { id: reportCardData.student_id || reportCardData.studentId },
//       term: reportCardData.term,
//       classRank: reportCardData.class_rank || reportCardData.classRank || 0,
//       // ADD THESE 2 LINES:
//       qa1Rank: reportCardData.qa1_rank || reportCardData.qa1Rank || 0,
//       qa2Rank: reportCardData.qa2_rank || reportCardData.qa2Rank || 0,
//       totalStudents: reportCardData.total_students || reportCardData.totalStudents || 0,
//       daysPresent: reportCardData.days_present || reportCardData.daysPresent || 0,
//       daysAbsent: reportCardData.days_absent || reportCardData.daysAbsent || 0,
//       daysLate: reportCardData.days_late || reportCardData.daysLate || 0,
//       teacherRemarks: reportCardData.teacher_remarks || reportCardData.teacherRemarks || '',
//     };

//     const existing = await this.reportCardRepository.findOne({
//       where: {
//         student: { id: data.student.id },
//         term: data.term,
//       },
//     });

//     if (existing) {
//       Object.assign(existing, data);
//       return this.reportCardRepository.save(existing);
//     } else {
//       const reportCard = this.reportCardRepository.create(data);
//       return this.reportCardRepository.save(reportCard);
//     }
//   }

//   async createSubject(subjectData: { name: string }) {
//     const subject = this.subjectRepository.create(subjectData);
//     return this.subjectRepository.save(subject);
//   }

//   async deleteSubject(id: string) {
//     const subject = await this.subjectRepository.findOne({ where: { id } });
//     if (!subject) {
//       throw new NotFoundException(`Subject ${id} not found`);
//     }
//     return this.subjectRepository.remove(subject);
//   }

//   calculateGrade(score: number): string {
//     if (score >= 80) return 'A';
//     if (score >= 70) return 'B';
//     if (score >= 60) return 'C';
//     if (score >= 50) return 'D';
//     return 'F';
//   }

//   async getAllGradeConfigurations() {
//     return this.gradeConfigRepository.find({
//       order: { is_active: 'DESC', created_at: 'DESC' }
//     });
//   }

//   async createGradeConfiguration(data: Partial<GradeConfig>) {
//     const config = this.gradeConfigRepository.create(data);
//     return this.gradeConfigRepository.save(config);
//   }

//   async updateGradeConfiguration(id: string, updates: Partial<GradeConfig>) {
//     const config = await this.gradeConfigRepository.findOne({ where: { id } });
//     if (!config) {
//       throw new NotFoundException(`Grade configuration ${id} not found`);
//     }

//     Object.assign(config, updates);
//     return this.gradeConfigRepository.save(config);
//   }

//   async setActiveConfiguration(id: string) {
//     await this.gradeConfigRepository.update({ is_active: true }, { is_active: false });

//     const config = await this.gradeConfigRepository.findOne({ where: { id } });
//     if (!config) {
//       throw new NotFoundException(`Grade configuration ${id} not found`);
//     }

//     config.is_active = true;
//     return this.gradeConfigRepository.save(config);
//   }
// }


