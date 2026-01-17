import { Controller, Get, Post, Body, Param, Delete, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { TeachersService } from './teachers.service';

@Controller('teachers')
export class TeachersController {
    constructor(private readonly teachersService: TeachersService) { }

    // CREATE teacher
    @Post()
    async createTeacher(
        @Body() body: {
            name: string;
            email: string;
            password: string;
        },
        @Query('schoolId') schoolId: string
    ) {
        if (!schoolId) {
            return {
                success: false,
                message: 'School ID is required'
            };
        }

        const teacher = await this.teachersService.createTeacher(
            body.name,
            body.email,
            body.password,
            schoolId
        );

        return {
            success: true,
            message: 'Teacher created successfully',
            data: teacher
        };
    }

    // GET teachers
    @Get()
    async getTeachers(@Query('schoolId') schoolId: string) {
        if (!schoolId) {
            return {
                success: false,
                message: 'School ID is required'
            };
        }

        const teachers = await this.teachersService.getTeachersBySchool(schoolId);

        return {
            success: true,
            data: teachers
        };
    }

    // DELETE teacher
    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteTeacher(
        @Param('id') id: string,
        @Query('schoolId') schoolId: string
    ) {
        if (!schoolId) {
            return {
                success: false,
                message: 'School ID is required'
            };
        }

        const result = await this.teachersService.deleteTeacher(id, schoolId);

        return {
            success: true,
            message: result.message
        };
    }

    // ===== START: NEW TEACHER ASSIGNMENT ENDPOINTS =====

    // Assign teacher to class and subject
    @Post('assign')
    async assignTeacher(
        @Body() body: {
            teacherId: string;
            classId: string;
            subjectId: string;
        }
    ) {
        const assignment = await this.teachersService.assignTeacherToClassSubject(
            body.teacherId,
            body.classId,
            body.subjectId
        );

        return {
            success: true,
            message: 'Teacher assigned successfully',
            data: assignment
        };
    }

    // Get teacher's assignments
    @Get(':teacherId/assignments')
    async getTeacherAssignments(@Param('teacherId') teacherId: string) {
        const assignments = await this.teachersService.getTeacherAssignments(teacherId);

        return {
            success: true,
            data: assignments
        };
    }

    // Get teacher's classes
    @Get(':teacherId/classes')
    async getTeacherClasses(@Param('teacherId') teacherId: string) {
        const classes = await this.teachersService.getTeacherClasses(teacherId);

        return {
            success: true,
            data: classes
        };
    }

    // Get teacher's subjects
    @Get(':teacherId/subjects')
    async getTeacherSubjects(@Param('teacherId') teacherId: string) {
        const subjects = await this.teachersService.getTeacherSubjects(teacherId);

        return {
            success: true,
            data: subjects
        };
    }

    // Get teacher's students
    @Get(':teacherId/students')
    async getTeacherStudents(@Param('teacherId') teacherId: string) {
        const students = await this.teachersService.getTeacherStudents(teacherId);

        return {
            success: true,
            data: students
        };
    }

    // Remove teacher assignment
    @Delete('assign/remove')
    @HttpCode(HttpStatus.OK)
    async removeTeacherAssignment(
        @Body() body: {
            teacherId: string;
            classId: string;
            subjectId: string;
        }
    ) {
        await this.teachersService.removeTeacherAssignment(
            body.teacherId,
            body.classId,
            body.subjectId
        );

        return {
            success: true,
            message: 'Assignment removed successfully'
        };
    }
    // ===== END: NEW TEACHER ASSIGNMENT ENDPOINTS =====
}