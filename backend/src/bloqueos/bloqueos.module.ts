import { Module } from '@nestjs/common';
import { BloqueosController } from './bloqueos.controller';
import { BloqueosService } from './bloqueos.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [BloqueosController],
    providers: [BloqueosService],
    exports: [BloqueosService],
})
export class BloqueosModule { }
