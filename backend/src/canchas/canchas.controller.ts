import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { CanchasService } from './canchas.service';
import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('canchas')
export class CanchasController {
    constructor(private readonly canchasService: CanchasService) { }

    @Get()
    findAll(@Req() req: any) {
        return this.canchasService.findAll(req?.accessToken);
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    create(@Body() createCanchaDto: CreateCanchaDto, @Req() req: any) {
        return this.canchasService.create(createCanchaDto, req.accessToken);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() updateCanchaDto: UpdateCanchaDto,
        @Req() req: any
    ) {
        return this.canchasService.update(id, updateCanchaDto, req.accessToken);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
        return this.canchasService.remove(id, req.accessToken);
    }
}
