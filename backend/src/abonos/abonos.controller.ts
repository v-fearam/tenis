import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Req, Param } from '@nestjs/common';
import { AbonosService } from './abonos.service';
import { AssignAbonoDto, CreateAbonoTypeDto, UpdateAbonoTypeDto } from './dto/abono.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('abonos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbonosController {
    constructor(private readonly abonosService: AbonosService) {}

    // --- TYPES CRUD ---

    @Get('types')
    @Roles('admin')
    findAllTypes(@Req() req: any) {
        const token = req.headers.authorization.split(' ')[1];
        return this.abonosService.findAllTypes(token);
    }

    @Post('types')
    @Roles('admin')
    createType(@Body() dto: CreateAbonoTypeDto, @Req() req: any) {
        const token = req.headers.authorization.split(' ')[1];
        return this.abonosService.createType(dto, token);
    }

    @Patch('types/:id')
    @Roles('admin')
    updateType(@Param('id') id: string, @Body() dto: UpdateAbonoTypeDto, @Req() req: any) {
        const token = req.headers.authorization.split(' ')[1];
        return this.abonosService.updateType(id, dto, token);
    }

    @Delete('types/:id')
    @Roles('admin')
    deleteType(@Param('id') id: string, @Req() req: any) {
        const token = req.headers.authorization.split(' ')[1];
        return this.abonosService.deleteType(id, token);
    }

    // --- ASSIGNMENT ---

    @Post('assign')
    @Roles('admin')
    assign(@Body() dto: AssignAbonoDto, @Req() req: any) {
        const token = req.headers.authorization.split(' ')[1];
        return this.abonosService.assign(dto, token);
    }

    @Delete('assign/:socioId')
    @Roles('admin')
    removeAbono(@Param('socioId') socioId: string, @Req() req: any) {
        const token = req.headers.authorization.split(' ')[1];
        return this.abonosService.removeAbono(socioId, token);
    }
}
