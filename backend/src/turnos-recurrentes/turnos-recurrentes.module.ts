import { Module } from '@nestjs/common';
import { TurnosRecurrentesController } from './turnos-recurrentes.controller';
import { TurnosRecurrentesService } from './turnos-recurrentes.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [TurnosRecurrentesController],
  providers: [TurnosRecurrentesService],
  exports: [TurnosRecurrentesService],
})
export class TurnosRecurrentesModule {}
