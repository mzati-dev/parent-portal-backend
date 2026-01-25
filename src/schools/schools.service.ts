import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './entities/school.entity';
import * as bcrypt from 'bcryptjs'; // Change this line
// import * as bcrypt from 'bcrypt'; // ADD THIS IMPORT

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private schoolRepository: Repository<School>,
  ) { }

  // ===== START: MODIFIED createSchool method =====
  // async createSchool(data: {
  //   name: string;
  //   email: string;
  //   phone?: string;
  //   address?: string;
  //   // ADD THESE NEW FIELDS:
  //   adminEmail?: string;
  //   adminPassword?: string;
  //   adminName?: string;
  // }) {
  //   // Check if school email already exists
  //   const existingSchoolEmail = await this.schoolRepository.findOne({
  //     where: { email: data.email }
  //   });
  //   if (existingSchoolEmail) {
  //     throw new BadRequestException('School with this email already exists');
  //   }

  //   // NEW: Check if admin email already exists
  //   if (data.adminEmail) {
  //     const existingAdminEmail = await this.schoolRepository.findOne({
  //       where: { adminEmail: data.adminEmail }
  //     });
  //     if (existingAdminEmail) {
  //       throw new BadRequestException('Admin email already in use');
  //     }
  //   }

  //   const school = this.schoolRepository.create(data);

  //   // NEW: Hash the admin password if provided
  //   if (data.adminPassword) {
  //     const salt = await bcrypt.genSalt(10);
  //     school.adminPassword = await bcrypt.hash(data.adminPassword, salt);
  //   }

  //   // NEW: Set default role
  //   school.role = 'school_admin';

  //   return this.schoolRepository.save(school);
  // }
  // // ===== END: MODIFIED createSchool method =====


  async createSchool(data: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    adminEmail?: string;
    adminPassword?: string;
    adminName?: string;
  }) {
    console.log('=== DEBUG START ===');
    console.log('Full data received:', JSON.stringify(data, null, 2));
    console.log('Admin password exists?', !!data.adminPassword);
    console.log('Admin password:', data.adminPassword);

    // ... your existing validation code ...

    const school = this.schoolRepository.create(data);
    console.log('School object after create (before hash):', {
      adminEmail: school.adminEmail,
      adminPassword: school.adminPassword // This might be plain text already!
    });

    // HASHING CODE - ADD LOGS
    if (data.adminPassword) {
      console.log('Starting bcrypt hash...');
      try {
        console.log('Generating salt...');
        const salt = await bcrypt.genSalt(10);
        console.log('Salt:', salt);

        console.log('Hashing password...');
        const hashed = await bcrypt.hash(data.adminPassword, salt);
        console.log('Hashed password (first 20 chars):', hashed.substring(0, 20));
        console.log('Full hash length:', hashed.length);

        school.adminPassword = hashed;
        console.log('✅ Hash assigned to school object');
      } catch (error) {
        console.error('❌ Hashing failed:', error);
      }
    } else {
      console.log('⚠️ No adminPassword to hash!');
    }

    console.log('School object before save:', {
      adminEmail: school.adminEmail,
      adminPassword: school.adminPassword?.substring(0, 20) + '...'
    });

    const savedSchool = await this.schoolRepository.save(school);
    console.log('Saved school from database:', {
      id: savedSchool.id,
      adminEmail: savedSchool.adminEmail,
      adminPassword: savedSchool.adminPassword?.substring(0, 20) + '...'
    });
    console.log('=== DEBUG END ===');

    return savedSchool;
  }

  async getAllSchools() {
    return this.schoolRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async getSchoolById(id: string) {
    const school = await this.schoolRepository.findOne({ where: { id } });
    if (!school) {
      throw new NotFoundException('School not found');
    }
    return school;
  }

  async updateSchool(id: string, data: Partial<School>) {
    const school = await this.getSchoolById(id);
    Object.assign(school, data);
    return this.schoolRepository.save(school);
  }

  async deleteSchool(id: string) {
    const school = await this.getSchoolById(id);
    // Soft delete - mark as inactive
    school.isActive = false;
    return this.schoolRepository.save(school);
  }

  async restoreSchool(id: string) {
    const school = await this.getSchoolById(id);
    school.isActive = true;
    return this.schoolRepository.save(school);
  }

  async permanentlyDelete(id: string) {
    const school = await this.getSchoolById(id);

    // This is the command that actually uses the CASCADE rules.
    // It tells the database: "Delete this school AND everything linked to it."
    return this.schoolRepository.remove(school);
  }
}

// // src/schools/school.service.ts
// import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { School } from './entities/school.entity';


// @Injectable()
// export class SchoolsService {
//   constructor(
//     @InjectRepository(School)
//     private schoolRepository: Repository<School>,
//   ) { }

//   async createSchool(data: {
//     name: string;
//     email: string;
//     phone?: string;
//     address?: string;
//   }) {
//     // Check if email already exists
//     const existing = await this.schoolRepository.findOne({ where: { email: data.email } });
//     if (existing) {
//       throw new BadRequestException('School with this email already exists');
//     }

//     const school = this.schoolRepository.create(data);
//     return this.schoolRepository.save(school);
//   }

//   async getAllSchools() {
//     return this.schoolRepository.find({
//       order: { createdAt: 'DESC' },
//     });
//   }

//   async getSchoolById(id: string) {
//     const school = await this.schoolRepository.findOne({ where: { id } });
//     if (!school) {
//       throw new NotFoundException('School not found');
//     }
//     return school;
//   }

//   async updateSchool(id: string, data: Partial<School>) {
//     const school = await this.getSchoolById(id);
//     Object.assign(school, data);
//     return this.schoolRepository.save(school);
//   }

//   async deleteSchool(id: string) {
//     const school = await this.getSchoolById(id);
//     // Soft delete - mark as inactive
//     school.isActive = false;
//     return this.schoolRepository.save(school);
//   }

//   async restoreSchool(id: string) {
//     const school = await this.getSchoolById(id);
//     school.isActive = true;
//     return this.schoolRepository.save(school);
//   }
// }