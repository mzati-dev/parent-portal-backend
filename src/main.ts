import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow ALL origins during development
  app.enableCors();

  // REMOVE THIS LINE: app.setGlobalPrefix('api');

  // ========== START OF ADDED CODE ==========
  const dataSource = app.get(DataSource);
  await createSuperAdmin(dataSource);
  // ========== END OF ADDED CODE ==========

  await app.listen(3000);
  console.log(`🚀 Server ready at http://localhost:3000`);
}

// ========== START OF NEW FUNCTION ==========
async function createSuperAdmin(dataSource: DataSource) {
  try {
    const userRepository = dataSource.getRepository('User');

    const adminExists = await userRepository.findOne({
      where: { email: 'admin@parentportal.com' }
    });

    if (adminExists) {
      console.log('✅ Super admin already exists');
      return;
    }

    // Let TypeORM handle column names
    const admin = userRepository.create({
      fullName: 'Super Admin',
      email: 'admin@parentportal.com',
      password: 'Admin@123', // Will be auto-hashed
      role: 'super_admin',
      isEmailVerified: true
    });

    await userRepository.save(admin);
    console.log('✅ Super admin created: admin@parentportal.com / Admin@123');

  } catch (error) {
    console.log('Error creating admin:', error.message);
  }
}
// ========== END OF NEW FUNCTION ==========
bootstrap();

// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   // SIMPLEST FIX: Allow ALL origins during development
//   app.enableCors();

//   app.setGlobalPrefix('api');
//   await app.listen(3000);
//   console.log(`🚀 Server ready at http://localhost:3000/api`);
// }
// bootstrap();

// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);

//   // 1. Allow your React app (on 8080) to access this data
//   app.enableCors({
//     origin: 'http://localhost:8080',
//     methods: 'GET,POST,PUT,DELETE',
//     credentials: true,
//   });

//   // 2. Add /api before all your routes
//   // Your URL becomes: http://localhost:3000/api/students/results/EX123
//   app.setGlobalPrefix('api');

//   // 3. Listen on port 3000
//   await app.listen(3000);

//   console.log(`🚀 Server ready at http://localhost:3000/api`);
// }
// bootstrap();
