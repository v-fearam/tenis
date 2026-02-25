import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { AbonosModule } from '../abonos/abonos.module';

@Module({
    imports: [SupabaseModule, AbonosModule],
    controllers: [BookingsController],
    providers: [BookingsService],
    exports: [BookingsService],
})
export class BookingsModule { }
