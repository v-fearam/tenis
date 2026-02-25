import { Module } from '@nestjs/common';
import { CanchasController } from './canchas.controller';
import { CanchasService } from './canchas.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [CanchasController],
    providers: [CanchasService],
    exports: [CanchasService],
})
export class CanchasModule { }
