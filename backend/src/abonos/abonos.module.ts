import { Module } from '@nestjs/common';
import { AbonosService } from './abonos.service';
import { AbonosController } from './abonos.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [AbonosService],
  controllers: [AbonosController],
  exports: [AbonosService],
})
export class AbonosModule {}
