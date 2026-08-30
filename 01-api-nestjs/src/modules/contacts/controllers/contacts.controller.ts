import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ContactsService } from '../services/contacts.service';
import { CreateContactDto } from '../dtos/create-contact.dto';
import { UpdateContactDto } from '../dtos/update-contact.dto';
import { ContactQueryDto } from '../dtos/contact-query.dto';
import { ContactResponseDto } from '../dtos/contact-response.dto';
import { UseApiKeyAuth } from '../../../common/decorators/api-key.decorator';
import { ApiResponse as ApiEnvelope } from '../../../common/interfaces/api-response.interface';

/**
 * RESTful API Controller managing Contacts and Bank Details on Bitrix24 CRM.
 */
@ApiTags('Contacts & Requisites')
@UseApiKeyAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /**
   * Creates a new Contact, Requisite, and Bank Detail record on Bitrix24.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo mới Contact kèm Hồ sơ pháp lý và Chi tiết ngân hàng',
    description:
      'Tạo mới contact trên Bitrix24 CRM. Nếu có thông tin ngân hàng, tự động tạo Requisite (Type 3) và Bank Detail.',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ContactResponseDto,
    description: 'Tạo Contact thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu đầu vào không hợp lệ',
  })
  async create(
    @Body() createContactDto: CreateContactDto,
  ): Promise<ApiEnvelope<ContactResponseDto>> {
    const data = await this.contactsService.create(createContactDto);
    return {
      success: true,
      message: 'Tạo Contact thành công',
      data,
    };
  }

  /**
   * Retrieves a paginated list of contacts with integrated bank details.
   */
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách Contact có phân trang từ Bitrix24 CRM',
    description:
      'Lấy danh sách contact từ Bitrix24 kèm chi tiết ngân hàng. Hỗ trợ phân trang ?page=1&limit=20.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [ContactResponseDto],
    description: 'Lấy danh sách Contact thành công',
  })
  async findAll(
    @Query() query: ContactQueryDto,
  ): Promise<ApiEnvelope<ContactResponseDto[]>> {
    return this.contactsService.findAll(query);
  }

  /**
   * Retrieves details of a specific Contact by ID.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Xem chi tiết Contact theo ID',
    description:
      'Lấy đầy đủ thông tin của một Contact bao gồm Requisite và tài khoản ngân hàng.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của Contact (số nguyên)',
    example: 142,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ContactResponseDto,
    description: 'Lấy thông tin Contact thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contact không tồn tại',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiEnvelope<ContactResponseDto>> {
    const data = await this.contactsService.findOne(id);
    return {
      success: true,
      data,
    };
  }

  /**
   * Updates an existing Contact and its associated Bank Details by ID.
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Cập nhật Contact và Chi tiết ngân hàng theo ID',
    description: 'Cập nhật thông tin liên hệ và tài khoản ngân hàng tương ứng.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của Contact (số nguyên)',
    example: 142,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ContactResponseDto,
    description: 'Cập nhật Contact thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contact không tồn tại',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateContactDto: UpdateContactDto,
  ): Promise<ApiEnvelope<ContactResponseDto>> {
    const data = await this.contactsService.update(id, updateContactDto);
    return {
      success: true,
      message: `Cập nhật Contact #${id} thành công`,
      data,
    };
  }

  /**
   * Deletes a Contact by ID on Bitrix24 CRM (cascade-deleting linked requisites).
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Xóa Contact theo ID trên Bitrix24',
    description:
      'Xóa contact khỏi Bitrix24 CRM. Các Requisite và Bank Detail liên kết sẽ tự động bị xóa theo.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID của Contact (số nguyên)',
    example: 142,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xóa Contact thành công',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Contact không tồn tại',
  })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean; message: string }> {
    return this.contactsService.remove(id);
  }
}
