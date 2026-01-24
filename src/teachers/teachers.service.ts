import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Teacher } from './entities/teacher.entity';
import { TeacherClassSubject } from './entities/teacher-class-subject.entity';
import { Class } from '../students/entities/class.entity';
import { Subject } from '../students/entities/subject.entity';
import { Student } from '../students/entities/student.entity';

@Injectable()
export class TeachersService {
    constructor(
        @InjectRepository(Teacher)
        private teachersRepo: Repository<Teacher>,
        // ===== START: NEW REPOSITORIES =====
        @InjectRepository(TeacherClassSubject)
        private teacherClassSubjectRepo: Repository<TeacherClassSubject>,

        @InjectRepository(Class)
        private classRepo: Repository<Class>,

        @InjectRepository(Subject)
        private subjectRepo: Repository<Subject>,

        @InjectRepository(Student)
        private studentRepo: Repository<Student>,
        // ===== END: NEW REPOSITORIES =====
    ) { }

    // Create teacher - school_id comes from admin's context
    async createTeacher(name: string, email: string, password: string, schoolId: string) {
        // Check if email exists (globally for now)
        const existingTeacher = await this.teachersRepo.findOne({
            where: { email }
        });

        if (existingTeacher) {
            throw new ConflictException('A teacher with this email already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create teacher
        const teacher = this.teachersRepo.create({
            name,
            email,
            password: hashedPassword,
            school_id: schoolId,
        });

        await this.teachersRepo.save(teacher);

        // Return exactly what frontend expects
        return {
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            created_at: teacher.created_at
        };
    }

    // Get all teachers for a school - frontend expects array with specific fields
    async getTeachersBySchool(schoolId: string) {
        const teachers = await this.teachersRepo.find({
            where: { school_id: schoolId },
            order: { created_at: 'DESC' },
        });

        // Return exactly what frontend expects
        return teachers.map(teacher => ({
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            created_at: teacher.created_at
        }));
    }

    // ===== START: FIND TEACHER BY EMAIL METHOD =====
    async findTeacherByEmail(email: string) {
        return await this.teachersRepo.findOne({
            where: { email },
            select: ['id', 'name', 'email', 'password', 'school_id', 'is_active', 'created_at']
        });
    }
    // ===== END: FIND TEACHER BY EMAIL METHOD =====

    // Delete teacher
    async deleteTeacher(id: string, schoolId: string) {
        const result = await this.teachersRepo.delete({ id, school_id: schoolId });

        if (result.affected === 0) {
            throw new NotFoundException('Teacher not found');
        }

        return { message: 'Teacher deleted successfully' };
    }

    // ===== START: NEW TEACHER-CLASS-SUBJECT METHODS =====

    // Assign teacher to a specific class and subject
    async assignTeacherToClassSubject(teacherId: string, classId: string, subjectId: string) {
        // Check if assignment already exists
        const existing = await this.teacherClassSubjectRepo.findOne({
            where: { teacherId, classId, subjectId }
        });

        if (existing) {
            throw new ConflictException('Teacher is already assigned to this class and subject');
        }

        // Check if teacher exists
        const teacher = await this.teachersRepo.findOne({ where: { id: teacherId } });
        if (!teacher) {
            throw new NotFoundException('Teacher not found');
        }

        // Check if class exists
        const classExists = await this.classRepo.findOne({ where: { id: classId } });
        if (!classExists) {
            throw new NotFoundException('Class not found');
        }

        // Check if subject exists
        const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
        if (!subject) {
            throw new NotFoundException('Subject not found');
        }

        // Create new assignment
        const assignment = this.teacherClassSubjectRepo.create({
            teacherId,
            classId,
            subjectId
        });

        return this.teacherClassSubjectRepo.save(assignment);
    }

    // Get all assignments for a teacher
    async getTeacherAssignments(teacherId: string) {
        return this.teacherClassSubjectRepo.find({
            where: { teacherId },
            relations: ['class', 'subject']
        });
    }

    // Get only classes assigned to a teacher
    async getTeacherClasses(teacherId: string): Promise<Class[]> {
        const assignments = await this.teacherClassSubjectRepo.find({
            where: { teacherId },
            relations: ['class']
        }) as any[];

        const uniqueClasses: Class[] = [];
        const seenClassIds = new Set<string>();

        for (const assignment of assignments) {
            const classObj = assignment.class;
            if (classObj && !seenClassIds.has(classObj.id)) {
                seenClassIds.add(classObj.id);
                uniqueClasses.push(classObj);
            }
        }

        return uniqueClasses;
    }

    // Get only subjects assigned to a teacher
    async getTeacherSubjects(teacherId: string): Promise<Subject[]> {
        const assignments = await this.teacherClassSubjectRepo.find({
            where: { teacherId },
            relations: ['subject']
        }) as any[];

        const uniqueSubjects: Subject[] = [];
        const seenSubjectIds = new Set<string>();

        for (const assignment of assignments) {
            const subjectObj = assignment.subject;
            if (subjectObj && !seenSubjectIds.has(subjectObj.id)) {
                seenSubjectIds.add(subjectObj.id);
                uniqueSubjects.push(subjectObj);
            }
        }

        return uniqueSubjects;
    }

    // Get students from classes assigned to a teacher - CORRECTED
    async getTeacherStudents(teacherId: string) {
        // Get teacher's assigned classes
        const assignments = await this.getTeacherAssignments(teacherId);
        const classIds = assignments.map(a => a.classId);

        if (classIds.length === 0) {
            return [];
        }

        // Use the class relationship, not classId field
        return this.studentRepo.find({
            where: { class: { id: In(classIds) } },
            relations: ['class']
        });
    }

    // Remove a teacher's assignment
    async removeTeacherAssignment(teacherId: string, classId: string, subjectId: string) {
        const result = await this.teacherClassSubjectRepo.delete({ teacherId, classId, subjectId });

        if (result.affected === 0) {
            throw new NotFoundException('Assignment not found');
        }
    }
    // ===== END: NEW TEACHER-CLASS-SUBJECT METHODS =====

    // ===== START: CLASS TEACHER METHODS =====

    // Assign a teacher as class teacher for a class
    async assignClassTeacher(teacherId: string, classId: string) {
        // Check if teacher exists
        const teacher = await this.teachersRepo.findOne({ where: { id: teacherId } });
        if (!teacher) {
            throw new NotFoundException('Teacher not found');
        }

        // Check if class exists
        const classEntity = await this.classRepo.findOne({ where: { id: classId } });
        if (!classEntity) {
            throw new NotFoundException('Class not found');
        }

        // Check if teacher is already class teacher for another class
        const existingClassTeacher = await this.classRepo.findOne({
            where: { classTeacherId: teacherId, id: classId }
        });

        if (existingClassTeacher) {
            throw new ConflictException('This teacher is already class teacher for this class');
        }

        // Update the class with new class teacher
        classEntity.classTeacherId = teacherId;
        await this.classRepo.save(classEntity);

        return {
            message: 'Class teacher assigned successfully',
            teacherId,
            teacherName: teacher.name,
            classId,
            className: classEntity.name
        };
    }

    // Remove class teacher from a class
    async removeClassTeacher(classId: string) {
        const classEntity = await this.classRepo.findOne({ where: { id: classId } });
        if (!classEntity) {
            throw new NotFoundException('Class not found');
        }

        if (!classEntity.classTeacherId) {
            throw new NotFoundException('No class teacher assigned to this class');
        }

        // Clear the class teacher
        classEntity.classTeacherId = undefined;
        await this.classRepo.save(classEntity);

        return { message: 'Class teacher removed successfully' };
    }

    // Get class teacher for a specific class
    async getClassTeacher(classId: string) {
        const classEntity = await this.classRepo.findOne({
            where: { id: classId },
            relations: ['classTeacher']
        });

        if (!classEntity) {
            throw new NotFoundException('Class not found');
        }

        if (!classEntity.classTeacher) {
            return null;
        }

        return {
            id: classEntity.classTeacher.id,
            name: classEntity.classTeacher.name,
            email: classEntity.classTeacher.email
        };
    }

    // Check if teacher is class teacher for a class
    async isClassTeacher(teacherId: string, classId: string): Promise<boolean> {
        const classEntity = await this.classRepo.findOne({
            where: { id: classId, classTeacherId: teacherId }
        });

        return !!classEntity;
    }
    // ===== END: CLASS TEACHER METHODS =====
}


// import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { In, Repository } from 'typeorm';
// import * as bcrypt from 'bcrypt';
// import { Teacher } from './entities/teacher.entity';
// import { TeacherClassSubject } from './entities/teacher-class-subject.entity';
// import { Class } from 'src/students/entities/class.entity';
// import { Subject } from 'src/students/entities/subject.entity';
// import { Student } from 'src/students/entities/student.entity';

// @Injectable()
// export class TeachersService {
//     constructor(
//         @InjectRepository(Teacher)
//         private teachersRepo: Repository<Teacher>,
//         // ===== START: NEW REPOSITORIES =====
//         @InjectRepository(TeacherClassSubject)
//         private teacherClassSubjectRepo: Repository<TeacherClassSubject>,

//         @InjectRepository(Class)
//         private classRepo: Repository<Class>,

//         @InjectRepository(Subject)
//         private subjectRepo: Repository<Subject>,

//         @InjectRepository(Student)
//         private studentRepo: Repository<Student>,
//         // ===== END: NEW REPOSITORIES =====
//     ) { }

//     // Create teacher - school_id comes from admin's context
//     async createTeacher(name: string, email: string, password: string, schoolId: string) {
//         // Check if email exists (globally for now)
//         const existingTeacher = await this.teachersRepo.findOne({
//             where: { email }
//         });

//         if (existingTeacher) {
//             throw new ConflictException('A teacher with this email already exists');
//         }

//         // Hash password
//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Create teacher
//         const teacher = this.teachersRepo.create({
//             name,
//             email,
//             password: hashedPassword,
//             school_id: schoolId,
//         });

//         await this.teachersRepo.save(teacher);

//         // Return exactly what frontend expects
//         return {
//             id: teacher.id,
//             name: teacher.name,
//             email: teacher.email,
//             created_at: teacher.created_at
//         };
//     }

//     // Get all teachers for a school - frontend expects array with specific fields
//     async getTeachersBySchool(schoolId: string) {
//         const teachers = await this.teachersRepo.find({
//             where: { school_id: schoolId },
//             order: { created_at: 'DESC' },
//         });

//         // Return exactly what frontend expects
//         return teachers.map(teacher => ({
//             id: teacher.id,
//             name: teacher.name,
//             email: teacher.email,
//             created_at: teacher.created_at
//         }));
//     }

//     // ===== START: FIND TEACHER BY EMAIL METHOD =====
//     async findTeacherByEmail(email: string) {
//         return await this.teachersRepo.findOne({
//             where: { email },
//             select: ['id', 'name', 'email', 'password', 'school_id', 'is_active', 'created_at']
//         });
//     }
//     // ===== END: FIND TEACHER BY EMAIL METHOD =====

//     // Delete teacher
//     async deleteTeacher(id: string, schoolId: string) {
//         const result = await this.teachersRepo.delete({ id, school_id: schoolId });

//         if (result.affected === 0) {
//             throw new NotFoundException('Teacher not found');
//         }

//         return { message: 'Teacher deleted successfully' };
//     }

//     // ===== START: NEW TEACHER-CLASS-SUBJECT METHODS =====

//     // Assign teacher to a specific class and subject
//     async assignTeacherToClassSubject(teacherId: string, classId: string, subjectId: string) {
//         // Check if assignment already exists
//         const existing = await this.teacherClassSubjectRepo.findOne({
//             where: { teacherId, classId, subjectId }
//         });

//         if (existing) {
//             throw new ConflictException('Teacher is already assigned to this class and subject');
//         }

//         // Check if teacher exists
//         const teacher = await this.teachersRepo.findOne({ where: { id: teacherId } });
//         if (!teacher) {
//             throw new NotFoundException('Teacher not found');
//         }

//         // Check if class exists
//         const classExists = await this.classRepo.findOne({ where: { id: classId } });
//         if (!classExists) {
//             throw new NotFoundException('Class not found');
//         }

//         // Check if subject exists
//         const subject = await this.subjectRepo.findOne({ where: { id: subjectId } });
//         if (!subject) {
//             throw new NotFoundException('Subject not found');
//         }

//         // Create new assignment
//         const assignment = this.teacherClassSubjectRepo.create({
//             teacherId,
//             classId,
//             subjectId
//         });

//         return this.teacherClassSubjectRepo.save(assignment);
//     }

//     // Get all assignments for a teacher
//     async getTeacherAssignments(teacherId: string) {
//         return this.teacherClassSubjectRepo.find({
//             where: { teacherId },
//             relations: ['class', 'subject']
//         });
//     }

//     // Get only classes assigned to a teacher
//     // async getTeacherClasses(teacherId: string) {
//     //     const assignments = await this.teacherClassSubjectRepo.find({
//     //         where: { teacherId },
//     //         relations: ['class']
//     //     });

//     //     return assignments.map(a => a.class);
//     // }
//     async getTeacherClasses(teacherId: string): Promise<Class[]> {
//         const assignments = await this.teacherClassSubjectRepo.find({
//             where: { teacherId },
//             relations: ['class']
//         }) as any[];

//         const uniqueClasses: Class[] = [];
//         const seenClassIds = new Set<string>();

//         for (const assignment of assignments) {
//             const classObj = assignment.class;
//             if (classObj && !seenClassIds.has(classObj.id)) {
//                 seenClassIds.add(classObj.id);
//                 uniqueClasses.push(classObj);
//             }
//         }

//         return uniqueClasses;
//     }
//     // Get only subjects assigned to a teacher
//     // async getTeacherSubjects(teacherId: string) {
//     //     const assignments = await this.teacherClassSubjectRepo.find({
//     //         where: { teacherId },
//     //         relations: ['subject']
//     //     });

//     //     return assignments.map(a => a.subject);
//     // }
//     async getTeacherSubjects(teacherId: string): Promise<Subject[]> {
//         const assignments = await this.teacherClassSubjectRepo.find({
//             where: { teacherId },
//             relations: ['subject']
//         }) as any[];

//         const uniqueSubjects: Subject[] = [];
//         const seenSubjectIds = new Set<string>();

//         for (const assignment of assignments) {
//             const subjectObj = assignment.subject;
//             if (subjectObj && !seenSubjectIds.has(subjectObj.id)) {
//                 seenSubjectIds.add(subjectObj.id);
//                 uniqueSubjects.push(subjectObj);
//             }
//         }

//         return uniqueSubjects;
//     }
//     // Get students from classes assigned to a teacher - CORRECTED
//     async getTeacherStudents(teacherId: string) {
//         // Get teacher's assigned classes
//         const assignments = await this.getTeacherAssignments(teacherId);
//         const classIds = assignments.map(a => a.classId);

//         if (classIds.length === 0) {
//             return [];
//         }

//         // Use the class relationship, not classId field
//         return this.studentRepo.find({
//             where: { class: { id: In(classIds) } },
//             relations: ['class']
//         });
//     }

//     // Remove a teacher's assignment
//     async removeTeacherAssignment(teacherId: string, classId: string, subjectId: string) {
//         const result = await this.teacherClassSubjectRepo.delete({ teacherId, classId, subjectId });

//         if (result.affected === 0) {
//             throw new NotFoundException('Assignment not found');
//         }
//     }
//     // ===== END: NEW TEACHER-CLASS-SUBJECT METHODS =====
// }

// // import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
// // import { InjectRepository } from '@nestjs/typeorm';
// // import { Repository } from 'typeorm';
// // import * as bcrypt from 'bcrypt';
// // import { Teacher } from './entities/teacher.entity';


// // @Injectable()
// // export class TeachersService {
// //     constructor(
// //         @InjectRepository(Teacher)
// //         private teachersRepo: Repository<Teacher>,
// //     ) { }

// //     // Create teacher - school_id comes from admin's context
// //     async createTeacher(name: string, email: string, password: string, schoolId: string) {
// //         // Check if email exists (globally for now)
// //         const existingTeacher = await this.teachersRepo.findOne({
// //             where: { email }
// //         });

// //         if (existingTeacher) {
// //             throw new ConflictException('A teacher with this email already exists');
// //         }

// //         // Hash password
// //         const hashedPassword = await bcrypt.hash(password, 10);

// //         // Create teacher
// //         const teacher = this.teachersRepo.create({
// //             name,
// //             email,
// //             password: hashedPassword,
// //             school_id: schoolId,
// //         });

// //         await this.teachersRepo.save(teacher);

// //         // Return exactly what frontend expects
// //         return {
// //             id: teacher.id,
// //             name: teacher.name,
// //             email: teacher.email,
// //             created_at: teacher.created_at
// //         };
// //     }

// //     // Get all teachers for a school - frontend expects array with specific fields
// //     async getTeachersBySchool(schoolId: string) {
// //         const teachers = await this.teachersRepo.find({
// //             where: { school_id: schoolId },
// //             order: { created_at: 'DESC' },
// //         });

// //         // Return exactly what frontend expects
// //         return teachers.map(teacher => ({
// //             id: teacher.id,
// //             name: teacher.name,
// //             email: teacher.email,
// //             created_at: teacher.created_at
// //         }));
// //     }

// //     // Delete teacher
// //     async deleteTeacher(id: string, schoolId: string) {
// //         const result = await this.teachersRepo.delete({ id, school_id: schoolId });

// //         if (result.affected === 0) {
// //             throw new NotFoundException('Teacher not found');
// //         }

// //         return { message: 'Teacher deleted successfully' };
// //     }
// // }