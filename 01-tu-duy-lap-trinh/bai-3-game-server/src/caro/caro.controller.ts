import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CaroService } from './caro.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Cờ Caro')
@Controller('caro')
export class CaroController {
  constructor(private readonly caroService: CaroService) {}

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy lịch sử đấu Cờ Caro của người dùng' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Danh sách các ván đấu gần đây' })
  @ApiResponse({
    status: 401,
    description: 'Chưa đăng nhập hoặc token không hợp lệ',
  })
  async getHistory(@Request() req: any, @Query('limit') limit?: number) {
    const parsedLimit = limit ? Number(limit) : 20;
    return this.caroService.getMatchHistory(req.user.userId, parsedLimit);
  }
}
