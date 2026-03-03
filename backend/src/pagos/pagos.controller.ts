import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PagosService } from './pagos.service';
import { RegisterPaymentDto, GiftPaymentDto, PayAllDto } from './dto/pagos.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto';

@Controller('pagos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Get('monthly-revenue')
  getMonthlyRevenue() {
    return this.pagosService.getMonthlyRevenue();
  }

  @Get('unpaid')
  findUnpaid(
    @Query() query: PaginationDto,
    @Query('fecha_desde') fechaDesde: string,
    @Query('fecha_hasta') fechaHasta: string,
    @Req() req: any,
  ) {
    return this.pagosService.findUnpaidTurnos(
      query,
      req.accessToken,
      fechaDesde,
      fechaHasta,
    );
  }

  @Post('pay')
  registerPayment(
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.pagosService.registerPayment(
      dto,
      user?.nombre || 'Admin',
      req.accessToken,
    );
  }

  @Post('gift')
  giftPayment(
    @Body() dto: GiftPaymentDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.pagosService.giftPayment(
      dto,
      user?.nombre || 'Admin',
      req.accessToken,
    );
  }

  @Post('pay-all')
  payAll(
    @Body() dto: PayAllDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.pagosService.payAllForTurno(
      dto,
      user?.nombre || 'Admin',
      req.accessToken,
    );
  }
}
