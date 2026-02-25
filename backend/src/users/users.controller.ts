import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UpdateSocioDto, CreateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
export class UsersPublicController {
  constructor(private readonly usersService: UsersService) { }

  @Get('search-socios')
  searchSocios(@Query('q') query: string) {
    return this.usersService.searchPublic(query || '');
  }
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  getMe(@CurrentUser('id') userId: string, @Req() req: any) {
    return this.usersService.findOne(userId, req.accessToken);
  }

  @Get('me/dashboard')
  getDashboard(@CurrentUser('id') userId: string, @Req() req: any) {
    return this.usersService.getDashboardData(userId, req.accessToken);
  }

  @Get('count')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getCount(@Req() req: any) {
    return this.usersService.count(req.accessToken);
  }

  @Get('search')
  @UseGuards(RolesGuard)
  @Roles('admin')
  search(@Query('q') query: string, @Req() req: any) {
    return this.usersService.search(query || '', req.accessToken);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.accessToken);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.usersService.findOne(id, req.accessToken);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto, @Req() req: any) {
    return this.usersService.update(id, updateUserDto, req.accessToken);
  }

  @Patch(':id/socio')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateSocio(
    @Param('id') userId: string,
    @Body() updateSocioDto: UpdateSocioDto,
    @Req() req: any,
  ) {
    return this.usersService.updateSocio(userId, updateSocioDto, req.accessToken);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.usersService.remove(id, req.accessToken);
  }
}
