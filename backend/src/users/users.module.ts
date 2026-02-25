import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController, UsersPublicController } from './users.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [UsersPublicController, UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
