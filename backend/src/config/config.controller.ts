import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { UpdateConfigDto } from './dto/update-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('config')
export class ConfigController {
    constructor(private readonly configService: ConfigService) { }

    @Get()
    findAll() {
        return this.configService.findAll();
    }

    @Get(':clave')
    findByKey(@Param('clave') clave: string) {
        return this.configService.findByKey(clave);
    }

    @Patch(':clave')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    update(
        @Param('clave') clave: string,
        @Body() updateConfigDto: UpdateConfigDto,
    ) {
        return this.configService.update(clave, updateConfigDto.valor, updateConfigDto.descripcion);
    }
}
