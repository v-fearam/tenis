import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { TurnosRecurrentesService } from './turnos-recurrentes.service';
import {
  CheckAvailabilityDto,
  CreateTurnoRecurrenteDto,
  AddPagoRecurrenteDto,
} from './dto/turnos-recurrentes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('turnos-recurrentes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class TurnosRecurrentesController {
  constructor(private readonly service: TurnosRecurrentesService) {}

  /** Check slot availability and compute suggested price */
  @Post('check-availability')
  checkAvailability(@Body() dto: CheckAvailabilityDto) {
    return this.service.checkAvailability(dto);
  }

  /** Total debt + committed across all active recurrencias (for dashboard) */
  @Get('deuda-total')
  getDeudaTotal() {
    return this.service.getDeudaTotal();
  }

  /** List recurrencias with saldo calculated */
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('estado') estado?: string,
  ) {
    return this.service.findAll(page, pageSize, estado);
  }

  /** Create recurrencia + turnos */
  @Post()
  create(@Body() dto: CreateTurnoRecurrenteDto, @Req() req: any) {
    return this.service.create(dto, req.user.id);
  }

  /** Detail: recurrencia with turnos, payments, saldo */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /** Register a payment */
  @Post(':id/pagos')
  addPago(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPagoRecurrenteDto,
    @Req() req: any,
  ) {
    return this.service.addPago(id, dto, req.user.id);
  }

  /** Preview price recalculation for future turnos */
  @Get(':id/recalcular')
  recalcularPreview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.recalcularPreview(id);
  }

  /** Confirm price recalculation: update monto_recurrente of future turnos */
  @Post(':id/recalcular')
  recalcularConfirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.recalcularConfirm(id);
  }

  /** Cancel a single day turno */
  @Delete(':id/turnos/:turnoId')
  cancelTurno(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('turnoId', ParseUUIDPipe) turnoId: string,
  ) {
    return this.service.cancelTurno(id, turnoId);
  }

  /** Cancel recurrencia: marks all future turnos cancelled + recurrencia cancelled */
  @Delete(':id')
  cancelAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancelAll(id);
  }
}
