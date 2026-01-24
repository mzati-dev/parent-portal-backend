import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config'; // Add ConfigService
import { StudentsModule } from './students/students.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchoolsModule } from './schools/schools.module';
import { TeachersModule } from './teachers/teachers.module';

@Module({
  imports: [
    // 1. Tell NestJS which .env file to load
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      isGlobal: true,
    }),

    // 2. Use a "Factory" to wait for the config variables before connecting
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        // host: configService.get<string>('DB_HOST', 'localhost'),
        // port: configService.get<number>('DB_PORT', 5432),
        // username: configService.get<string>('DB_USERNAME', 'postgres'),
        // password: configService.get<string>('DB_PASSWORD', 'wasi7122'),
        // database: configService.get<string>('DB_NAME', 'parent_portal_db'),
        // Automatically finds all your .entity.ts files
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // Sync is true ONLY if NOT in production
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
        extra: {
          ssl: { rejectUnauthorized: false }, // REQUIRED for Supabase
        },
      }),
    }),

    StudentsModule,

    AuthModule,

    UsersModule,

    SchoolsModule,

    TeachersModule,




  ],
})
export class AppModule { }