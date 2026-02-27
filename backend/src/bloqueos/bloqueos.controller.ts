import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { BloqueosService } from './bloqueos.service';
import { CreateBloqueoDto, BloqueoQueryDto } from './dto/bloqueo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('bloqueos')
export class BloqueosController {
    constructor(private readonly bloqueosService: BloqueosService) { }

    @Get()
    findAll(
        @Query() query: BloqueoQueryDto,
        @Req() req: any,
    ) {
        if (query.fecha) {
            return this.bloqueosService.findByDate(query.fecha, req?.accessToken);
        }
        return this.bloqueosService.findAll(query, req?.accessToken, query.fecha_desde, query.fecha_hasta);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    create(@Body() createBloqueoDto: CreateBloqueoDto, @Req() req: any) {
        return this.bloqueosService.create(createBloqueoDto, req.user.id, req.accessToken);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    remove(@Param('id') id: string, @Req() req: any) {
        return this.bloqueosService.delete(id, req.accessToken);
    }
}
