// src/schools/school.controller.ts
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';
import { SchoolsService } from './schools.service';
import { School } from './entities/school.entity';


@ApiTags('schools')
@Controller('schools')
// @UseGuards(AuthGuard('jwt'), AdminGuard) // Only super admin can access
@ApiBearerAuth()
export class SchoolsController {
    constructor(private readonly schoolService: SchoolsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new school' })
    @ApiResponse({ status: 201, description: 'School created successfully', type: School })
    async create(@Body() data: any) {
        return this.schoolService.createSchool(data);
    }

    @Get()
    @ApiOperation({ summary: 'Get all schools' })
    @ApiResponse({ status: 200, description: 'List of schools', type: [School] })
    async findAll() {
        return this.schoolService.getAllSchools();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get school by ID' })
    @ApiResponse({ status: 200, description: 'School details', type: School })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.schoolService.getSchoolById(id);
    }

    @Put(':id')
    @ApiOperation({ summary: 'Update school' })
    @ApiResponse({ status: 200, description: 'School updated successfully', type: School })
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() data: any) {
        return this.schoolService.updateSchool(id, data);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete (deactivate) school' })
    @ApiResponse({ status: 200, description: 'School deactivated' })
    async delete(@Param('id', ParseUUIDPipe) id: string) {
        return this.schoolService.deleteSchool(id);
    }

    @Post(':id/restore')
    @ApiOperation({ summary: 'Restore school' })
    @ApiResponse({ status: 200, description: 'School restored' })
    async restore(@Param('id', ParseUUIDPipe) id: string) {
        return this.schoolService.restoreSchool(id);
    }
}