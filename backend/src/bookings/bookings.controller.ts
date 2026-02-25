import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Req,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createBookingDto: CreateBookingDto,
    @CurrentUser('id') userId: string,
    @Req() req: any,
  ) {
    return this.bookingsService.create(createBookingDto, userId, req.accessToken);
  }

  @Get()
  findAll(@Req() req: any) {
    return this.bookingsService.findAll(req?.accessToken);
  }

  @Get('courts')
  findCourts(@Req() req: any) {
    return this.bookingsService.findAllCourts(req?.accessToken);
  }

  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles('admin')
  confirm(@Param('id') id: string, @Req() req: any) {
    return this.bookingsService.confirm(id, req.accessToken);
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('admin')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.bookingsService.cancel(id, req.accessToken);
  }
}
