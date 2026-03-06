import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Req,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AbonosService } from './abonos.service';
import {
  AssignAbonoDto,
  CreateAbonoTypeDto,
  UpdateAbonoTypeDto,
} from './dto/abono.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('abonos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AbonosController {
  constructor(private readonly abonosService: AbonosService) {}

  // --- TYPES CRUD ---

  @Get('types')
  findAllTypes(@Req() req: any) {
    return this.abonosService.findAllTypes(req.accessToken);
  }

  @Post('types')
  createType(@Body() dto: CreateAbonoTypeDto, @Req() req: any) {
    return this.abonosService.createType(dto, req.accessToken);
  }

  @Patch('types/:id')
  updateType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAbonoTypeDto,
    @Req() req: any,
  ) {
    return this.abonosService.updateType(id, dto, req.accessToken);
  }

  @Delete('types/:id')
  deleteType(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.abonosService.deleteType(id, req.accessToken);
  }

  // --- STATS ---

  @Get('stats')
  getStats(@Req() req: any) {
    return this.abonosService.getAbonoStats(req.accessToken);
  }

  // --- CIERRE MENSUAL ---

  @Get('cierre-pendiente')
  getCierrePendiente() {
    return this.abonosService.getCierrePendiente();
  }

  @Post('cierre-mensual')
  ejecutarCierre(@Req() req: any) {
    return this.abonosService.ejecutarCierreMensual(
      req.accessToken,
      req.user.id,
    );
  }

  // --- ASSIGNMENT ---

  @Post('assign')
  assign(@Body() dto: AssignAbonoDto, @Req() req: any) {
    return this.abonosService.assign(dto, req.accessToken);
  }

  @Delete('assign/:socioId')
  removeAbono(
    @Param('socioId', ParseUUIDPipe) socioId: string,
    @Req() req: any,
  ) {
    return this.abonosService.removeAbono(socioId, req.accessToken);
  }
}
