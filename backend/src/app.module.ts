import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BookingsModule } from './bookings/bookings.module';
import { ConfigSistemaModule } from './config/config.module';
import { BloqueosModule } from './bloqueos/bloqueos.module';
import { CanchasModule } from './canchas/canchas.module';
import { AbonosModule } from './abonos/abonos.module';
import { PagosModule } from './pagos/pagos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    BookingsModule,
    ConfigSistemaModule,
    BloqueosModule,
    CanchasModule,
    AbonosModule,
    PagosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
