import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';

@Module({
  imports: [SupabaseModule],
  controllers: [PagosController],
  providers: [PagosService],
  exports: [PagosService],
})
export class PagosModule {}
