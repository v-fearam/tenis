import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import {
  CreateBookingDto,
  BookingQueryDto,
  PreviewBookingDto,
} from './dto/booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RecaptchaService } from '../common/recaptcha.service';
import { PaginationDto } from '../common/dto';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly recaptchaService: RecaptchaService,
  ) {}

  @Post('preview')
  async preview(@Body() dto: PreviewBookingDto) {
    return this.bookingsService.previewCost(dto.players);
  }

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(@Body() createBookingDto: CreateBookingDto, @Req() req: any) {
    // Verify reCAPTCHA token
    if (createBookingDto.recaptcha_token) {
      await this.recaptchaService.verifyToken(
        createBookingDto.recaptcha_token,
        'booking_submit',
      );
    }

    const userId = req.user?.id || null;
    const accessToken = req.accessToken || null;
    return this.bookingsService.create(createBookingDto, userId, accessToken);
  }

  @Get()
  findAll(@Query() query: BookingQueryDto, @Req() req: any) {
    return this.bookingsService.findAll(
      query,
      req?.accessToken,
      query.status,
      query.fecha_desde,
      query.fecha_hasta,
    );
  }

  @Get('calendar')
  findForCalendar(@Query('fecha') fecha: string, @Req() req: any) {
    return this.bookingsService.findByDateForCalendar(
      fecha,
      req?.accessToken,
    );
  }

  @Get('courts')
  findCourts(@Req() req: any) {
    return this.bookingsService.findAllCourts(req?.accessToken);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  findActive(@Query() paginationDto: PaginationDto, @Req() req: any) {
    return this.bookingsService.findActive(paginationDto, req.accessToken);
  }

  @Patch(':id/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  confirm(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.bookingsService.confirm(id, req.accessToken);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    return this.bookingsService.cancel(id, req.accessToken);
  }

  @Delete('purge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  purge(@Query('mes') mes: string, @Query('anio') anio: string, @Req() req: any) {
    return this.bookingsService.purgeByMonth(
      parseInt(mes, 10),
      parseInt(anio, 10),
      req.accessToken,
    );
  }
}
