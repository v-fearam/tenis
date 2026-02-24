import { Controller, Get, Post, Body, Param, Patch, Req } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/booking.dto';

@Controller('bookings')
export class BookingsController {
    constructor(private readonly bookingsService: BookingsService) { }

    @Post()
    create(@Body() createBookingDto: CreateBookingDto, @Req() req: any) {
        // For now, using a placeholder user ID until full auth guard is implemented
        const userId = req.user?.id || '00000000-0000-0000-0000-000000000000';
        return this.bookingsService.create(createBookingDto, userId);
    }

    @Get()
    findAll() {
        return this.bookingsService.findAll();
    }

    @Patch(':id/confirm')
    confirm(@Param('id') id: string) {
        return this.bookingsService.confirm(id);
    }

    @Patch(':id/cancel')
    cancel(@Param('id') id: string) {
        // We should implement cancel logic in service too
        return { id, status: 'cancelled' };
    }
}
