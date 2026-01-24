import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Headers } from '@nestjs/common';
import { StudentsService } from './students.service';

// Main Students Controller
@Controller('api/students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) { }

  @Post('calculate-ranks')
  async calculateRanks(
    @Body() body: { class_id: string; term: string; schoolId?: string },
    @Query('schoolId') schoolId?: string
  ) {
    const finalSchoolId = body.schoolId || schoolId;
    return this.studentsService.calculateAndUpdateRanks(body.class_id, body.term, finalSchoolId);
  }

  @Get('class/:classId/results')
  async getClassResults(
    @Param('classId') classId: string,
    @Query('schoolId') schoolId?: string,
    @Headers('x-teacher-id') teacherId?: string // ADD THIS
  ) {
    return this.studentsService.getClassResults(classId, schoolId, teacherId);
  }

  @Get('results/:examNumber')
  async getStudentResults(
    @Param('examNumber') examNumber: string,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.findByExamNumber(examNumber, schoolId);
  }

  @Get()
  async getAllStudents(@Query('schoolId') schoolId?: string) {
    return this.studentsService.findAll(schoolId);
  }

  @Get(':id/assessments')
  async getStudentAssessments(
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.getStudentAssessments(id, schoolId);
  }

  @Get(':id/report-cards/:term')
  async getStudentReportCard(
    @Param('id') id: string,
    @Param('term') term: string,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.getStudentReportCard(id, term, schoolId);
  }

  @Post()
  async createStudent(
    @Body() studentData: any,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.create(studentData, schoolId);
  }

  @Patch(':id')
  async updateStudent(
    @Param('id') id: string,
    @Body() updates: any,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.update(id, updates, schoolId);
  }

  @Delete(':id')
  async deleteStudent(
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.remove(id, schoolId);
  }
}

// Assessments Controller
@Controller('api/assessments')
export class AssessmentsController {
  constructor(private readonly studentsService: StudentsService) { }

  @Post('upsert')
  async upsertAssessment(
    @Body() assessmentData: any,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.upsertAssessment(assessmentData, schoolId);
  }
}

// Report Cards Controller - MODIFIED
@Controller('api/report-cards')
export class ReportCardsController {
  constructor(private readonly studentsService: StudentsService) { }

  @Post('upsert')
  async upsertReportCard(
    @Body() reportCardData: any,
    @Query('schoolId') schoolId?: string,
    @Headers('x-teacher-id') teacherId?: string // ADDED HEADER
  ) {
    return this.studentsService.upsertReportCard(reportCardData, schoolId, teacherId);
  }
}

// Subjects Controller
@Controller('api/subjects')
export class SubjectsController {
  constructor(private readonly studentsService: StudentsService) { }

  @Get()
  async getAllSubjects(@Query('schoolId') schoolId?: string) {
    return this.studentsService.findAllSubjects(schoolId);
  }

  @Post()
  async createSubject(
    @Body() subjectData: { name: string },
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.createSubject(subjectData, schoolId);
  }

  @Delete(':id')
  async deleteSubject(
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.deleteSubject(id, schoolId);
  }
}

// Grade Configurations Controller
@Controller('api/grade-configs')
export class GradeConfigsController {
  constructor(private readonly studentsService: StudentsService) { }

  @Get('active')
  async getActiveGradeConfig(@Query('schoolId') schoolId?: string) {
    return this.studentsService.getActiveGradeConfiguration(schoolId);
  }

  @Get()
  async getAllGradeConfigs(@Query('schoolId') schoolId?: string) {
    return this.studentsService.getAllGradeConfigurations(schoolId);
  }

  @Post()
  async createGradeConfig(
    @Body() configData: any,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.createGradeConfiguration(configData, schoolId);
  }

  @Patch(':id')
  async updateGradeConfig(
    @Param('id') id: string,
    @Body() updates: any,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.updateGradeConfiguration(id, updates, schoolId);
  }

  @Post(':id/activate')
  async activateGradeConfig(
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.setActiveConfiguration(id, schoolId);
  }
}

// Classes Controller
@Controller('api/classes')
export class ClassesController {
  constructor(private readonly studentsService: StudentsService) { }

  @Get()
  async getAllClasses(@Query('schoolId') schoolId?: string) {
    return this.studentsService.findAllClasses(schoolId);
  }

  @Get(':id/students')
  async getClassStudents(
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.getClassStudents(id, schoolId);
  }

  @Post()
  async createClass(
    @Body() classData: { name: string; academic_year: string; term: string },
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.createClass(classData, schoolId);
  }

  @Delete(':id')
  async deleteClass(
    @Param('id') id: string,
    @Query('schoolId') schoolId?: string
  ) {
    return this.studentsService.deleteClass(id, schoolId);
  }
}

// import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common'; // ADD Query import
// import { StudentsService } from './students.service';

// // Main Students Controller
// @Controller('api/students')
// export class StudentsController {
//   constructor(private readonly studentsService: StudentsService) { }

//   @Post('calculate-ranks')
//   async calculateRanks(
//     @Body() body: { class_id: string; term: string; schoolId?: string },
//     @Query('schoolId') schoolId?: string
//   ) {
//     const finalSchoolId = body.schoolId || schoolId;
//     return this.studentsService.calculateAndUpdateRanks(body.class_id, body.term, finalSchoolId);
//   }

//   @Get('class/:classId/results')
//   async getClassResults(
//     @Param('classId') classId: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.getClassResults(classId, schoolId);
//   }

//   @Get('results/:examNumber')
//   async getStudentResults(
//     @Param('examNumber') examNumber: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.findByExamNumber(examNumber, schoolId);
//   }

//   @Get()
//   async getAllStudents(@Query('schoolId') schoolId?: string) { // ADD THIS PARAMETER
//     return this.studentsService.findAll(schoolId);
//   }

//   @Get(':id/assessments')
//   async getStudentAssessments(
//     @Param('id') id: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.getStudentAssessments(id, schoolId);
//   }

//   @Get(':id/report-cards/:term')
//   async getStudentReportCard(
//     @Param('id') id: string,
//     @Param('term') term: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.getStudentReportCard(id, term, schoolId);
//   }

//   @Post()
//   async createStudent(
//     @Body() studentData: any,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.create(studentData, schoolId);
//   }

//   @Patch(':id')
//   async updateStudent(
//     @Param('id') id: string,
//     @Body() updates: any,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.update(id, updates, schoolId);
//   }

//   @Delete(':id')
//   async deleteStudent(
//     @Param('id') id: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.remove(id, schoolId);
//   }
// }

// // Assessments Controller
// @Controller('api/assessments')
// export class AssessmentsController {
//   constructor(private readonly studentsService: StudentsService) { }

//   @Post('upsert')
//   async upsertAssessment(
//     @Body() assessmentData: any,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.upsertAssessment(assessmentData, schoolId);
//   }
// }

// // Report Cards Controller
// @Controller('api/report-cards')
// export class ReportCardsController {
//   constructor(private readonly studentsService: StudentsService) { }

//   @Post('upsert')
//   async upsertReportCard(
//     @Body() reportCardData: any,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.upsertReportCard(reportCardData, schoolId);
//   }
// }

// // Subjects Controller
// @Controller('api/subjects')
// export class SubjectsController {
//   constructor(private readonly studentsService: StudentsService) { }

//   @Get()
//   async getAllSubjects(@Query('schoolId') schoolId?: string) {
//     return this.studentsService.findAllSubjects(schoolId);
//   }

//   @Post()
//   async createSubject(
//     @Body() subjectData: { name: string },
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.createSubject(subjectData, schoolId);
//   }

//   @Delete(':id')
//   async deleteSubject(
//     @Param('id') id: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.deleteSubject(id, schoolId);
//   }
// }

// // Grade Configurations Controller
// @Controller('api/grade-configs')
// export class GradeConfigsController {
//   constructor(private readonly studentsService: StudentsService) { }

//   @Get('active')
//   async getActiveGradeConfig(@Query('schoolId') schoolId?: string) {
//     return this.studentsService.getActiveGradeConfiguration(schoolId);
//   }

//   @Get()
//   async getAllGradeConfigs(@Query('schoolId') schoolId?: string) {
//     return this.studentsService.getAllGradeConfigurations(schoolId);
//   }

//   @Post()
//   async createGradeConfig(
//     @Body() configData: any,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.createGradeConfiguration(configData, schoolId);
//   }

//   @Patch(':id')
//   async updateGradeConfig(
//     @Param('id') id: string,
//     @Body() updates: any,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.updateGradeConfiguration(id, updates, schoolId);
//   }

//   @Post(':id/activate')
//   async activateGradeConfig(
//     @Param('id') id: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.setActiveConfiguration(id, schoolId);
//   }
// }

// // Classes Controller
// @Controller('api/classes')
// export class ClassesController {
//   constructor(private readonly studentsService: StudentsService) { }

//   @Get()
//   async getAllClasses(@Query('schoolId') schoolId?: string) {
//     return this.studentsService.findAllClasses(schoolId);
//   }

//   @Get(':id/students')
//   async getClassStudents(
//     @Param('id') id: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.getClassStudents(id, schoolId);
//   }

//   @Post()
//   async createClass(
//     @Body() classData: { name: string; academic_year: string; term: string },
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.createClass(classData, schoolId);
//   }

//   @Delete(':id')
//   async deleteClass(
//     @Param('id') id: string,
//     @Query('schoolId') schoolId?: string
//   ) {
//     return this.studentsService.deleteClass(id, schoolId);
//   }
// }


// // import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
// // import { StudentsService } from './students.service';

// // // Main Students Controller
// // @Controller('api/students')
// // export class StudentsController {
// //   constructor(private readonly studentsService: StudentsService) { }

// //   //New code

// //   @Post('calculate-ranks')
// //   async calculateRanks(@Body() body: { class_id: string; term: string }) {
// //     return this.studentsService.calculateAndUpdateRanks(body.class_id, body.term);
// //   }

// //   // Add this to your StudentsController class
// //   @Get('class/:classId/results')
// //   async getClassResults(@Param('classId') classId: string) {
// //     return this.studentsService.getClassResults(classId);
// //   }

// //   @Get('results/:examNumber')
// //   async getStudentResults(@Param('examNumber') examNumber: string) {
// //     return this.studentsService.findByExamNumber(examNumber);
// //   }

// //   @Get()
// //   async getAllStudents() {
// //     return this.studentsService.findAll();
// //   }

// //   @Get(':id/assessments')
// //   async getStudentAssessments(@Param('id') id: string) {
// //     return this.studentsService.getStudentAssessments(id);
// //   }

// //   @Get(':id/report-cards/:term')
// //   async getStudentReportCard(
// //     @Param('id') id: string,
// //     @Param('term') term: string,
// //   ) {
// //     return this.studentsService.getStudentReportCard(id, term);
// //   }

// //   @Post()
// //   async createStudent(@Body() studentData: any) {
// //     return this.studentsService.create(studentData);
// //   }

// //   @Patch(':id')
// //   async updateStudent(
// //     @Param('id') id: string,
// //     @Body() updates: any,
// //   ) {
// //     return this.studentsService.update(id, updates);
// //   }

// //   @Delete(':id')
// //   async deleteStudent(@Param('id') id: string) {
// //     return this.studentsService.remove(id);
// //   }
// // }

// // // Assessments Controller
// // @Controller('api/assessments')
// // export class AssessmentsController {
// //   constructor(private readonly studentsService: StudentsService) { }

// //   @Post('upsert')
// //   async upsertAssessment(@Body() assessmentData: any) {
// //     return this.studentsService.upsertAssessment(assessmentData);
// //   }
// // }

// // // Report Cards Controller
// // @Controller('api/report-cards')
// // export class ReportCardsController {
// //   constructor(private readonly studentsService: StudentsService) { }

// //   @Post('upsert')
// //   async upsertReportCard(@Body() reportCardData: any) {
// //     return this.studentsService.upsertReportCard(reportCardData);
// //   }
// // }

// // // Subjects Controller
// // @Controller('api/subjects')
// // export class SubjectsController {
// //   constructor(private readonly studentsService: StudentsService) { }

// //   @Get()
// //   async getAllSubjects() {
// //     return this.studentsService.findAllSubjects();
// //   }

// //   @Post()
// //   async createSubject(@Body() subjectData: { name: string }) {
// //     return this.studentsService.createSubject(subjectData);
// //   }

// //   @Delete(':id')
// //   async deleteSubject(@Param('id') id: string) {
// //     return this.studentsService.deleteSubject(id);
// //   }
// // }

// // // Grade Configurations Controller
// // @Controller('api/grade-configs')
// // export class GradeConfigsController {
// //   constructor(private readonly studentsService: StudentsService) { }

// //   @Get('active')
// //   async getActiveGradeConfig() {
// //     return this.studentsService.getActiveGradeConfiguration();
// //   }

// //   @Get()
// //   async getAllGradeConfigs() {
// //     return this.studentsService.getAllGradeConfigurations();
// //   }

// //   @Post()
// //   async createGradeConfig(@Body() configData: any) {
// //     return this.studentsService.createGradeConfiguration(configData);
// //   }

// //   @Patch(':id')
// //   async updateGradeConfig(
// //     @Param('id') id: string,
// //     @Body() updates: any,
// //   ) {
// //     return this.studentsService.updateGradeConfiguration(id, updates);
// //   }

// //   @Post(':id/activate')
// //   async activateGradeConfig(@Param('id') id: string) {
// //     return this.studentsService.setActiveConfiguration(id);
// //   }
// // }

// // // NEW: Classes Controller - ADD THIS AT THE END
// // @Controller('api/classes')
// // export class ClassesController {
// //   constructor(private readonly studentsService: StudentsService) { }

// //   @Get()
// //   async getAllClasses() {
// //     return this.studentsService.findAllClasses();
// //   }

// //   @Get(':id/students')
// //   async getClassStudents(@Param('id') id: string) {
// //     return this.studentsService.getClassStudents(id);
// //   }

// //   @Post()
// //   async createClass(@Body() classData: { name: string; academic_year: string; term: string }) {
// //     return this.studentsService.createClass(classData);
// //   }

// //   @Delete(':id')
// //   async deleteClass(@Param('id') id: string) {
// //     return this.studentsService.deleteClass(id);
// //   }
// // }

