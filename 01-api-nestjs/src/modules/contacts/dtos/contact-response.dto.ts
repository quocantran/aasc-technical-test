import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for Bank Detail responses.
 */
export class BankDetailResponseDto {
  @ApiPropertyOptional({
    example: 10,
    description: 'ID bản ghi Bank Detail trên Bitrix24',
  })
  id?: number;

  @ApiProperty({
    example: 'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
    description: 'Tên ngân hàng (RQ_BANK_NAME)',
  })
  bankName: string;

  @ApiProperty({
    example: '0071001234567',
    description: 'Số tài khoản ngân hàng (RQ_ACC_NUM)',
  })
  accountNumber: string;

  @ApiPropertyOptional({
    example: 'BFTVVNVX',
    description: 'Mã định danh ngân hàng / BIK / SWIFT (RQ_BIK)',
  })
  bik?: string;
}

/**
 * Data Transfer Object representing a structured Contact returned to clients.
 */
export class ContactResponseDto {
  @ApiProperty({
    example: 142,
    description: 'ID của Contact trên Bitrix24 CRM',
  })
  id: number;

  @ApiProperty({
    example: 'Nguyễn Văn A',
    description: 'Tên của Contact (NAME)',
  })
  name: string;

  @ApiPropertyOptional({
    example: 'Nguyễn',
    description: 'Họ của Contact (LAST_NAME)',
  })
  lastName?: string;

  @ApiProperty({
    example: 'Nguyễn Nguyễn Văn A',
    description: 'Họ và tên đầy đủ được chuẩn hóa',
  })
  fullName: string;

  @ApiPropertyOptional({
    example: '0912345678',
    description: 'Số điện thoại liên hệ (PHONE)',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'vana@example.com',
    description: 'Địa chỉ Email (EMAIL)',
  })
  email?: string;

  @ApiPropertyOptional({
    example: 'https://company.com',
    description: 'Trang web (WEB)',
  })
  website?: string;

  @ApiPropertyOptional({
    example: '123 Lê Lợi, Phường Bến Nghé',
    description: 'Địa chỉ đường phố (ADDRESS)',
  })
  address?: string;

  @ApiPropertyOptional({
    example: 'Quận 1',
    description: 'Quận / Huyện (ADDRESS_CITY)',
  })
  city?: string;

  @ApiPropertyOptional({
    example: 'Hồ Chí Minh',
    description: 'Tỉnh / Thành phố (ADDRESS_PROVINCE)',
  })
  province?: string;

  @ApiPropertyOptional({
    example: 'Việt Nam',
    description: 'Quốc gia (ADDRESS_COUNTRY)',
  })
  country?: string;

  @ApiPropertyOptional({
    example: '123 Lê Lợi, Phường Bến Nghé, Quận 1, Hồ Chí Minh, Việt Nam',
    description: 'Địa chỉ đầy đủ kết hợp các cấp hành chính',
  })
  fullAddress?: string;

  @ApiPropertyOptional({
    example: 25,
    description: 'ID Hồ sơ pháp lý Requisite liên kết (Type 3)',
  })
  requisiteId?: number;

  @ApiPropertyOptional({
    type: BankDetailResponseDto,
    description: 'Thông tin tài khoản ngân hàng liên kết',
  })
  bankDetail?: BankDetailResponseDto;

  @ApiPropertyOptional({
    example: '2026-08-30T10:00:00.000Z',
    description: 'Thời gian tạo bản ghi (ISO 8601)',
  })
  createdAt?: string;

  /**
   * Factory: Assembles a ContactResponseDto directly from creation input DTO and resolved IDs in-memory.
   */
  static fromDto(
    id: number,
    dto: {
      name: string;
      lastName?: string;
      phone?: string;
      email?: string;
      website?: string;
      address?: string;
      city?: string;
      province?: string;
      country?: string;
      bankDetail?: {
        bankName?: string;
        accountNumber?: string;
        bik?: string;
      };
    },
    requisiteId?: number,
    bankDetailId?: number,
  ): ContactResponseDto {
    const fullName =
      [dto.lastName, dto.name].filter(Boolean).join(' ') || dto.name;
    const fullAddress = [
      dto.address,
      dto.city,
      dto.province,
      dto.country || 'Việt Nam',
    ]
      .filter(Boolean)
      .join(', ');

    const res = new ContactResponseDto();
    res.id = id;
    res.name = dto.name;
    res.lastName = dto.lastName;
    res.fullName = fullName;
    res.phone = dto.phone;
    res.email = dto.email;
    res.website = dto.website;
    res.address = dto.address;
    res.city = dto.city;
    res.province = dto.province;
    res.country = dto.country || 'Việt Nam';
    res.fullAddress = fullAddress || undefined;
    res.requisiteId = requisiteId;
    res.bankDetail =
      dto.bankDetail &&
      (dto.bankDetail.bankName || dto.bankDetail.accountNumber) &&
      requisiteId
        ? {
            id: bankDetailId,
            bankName: dto.bankDetail.bankName || '',
            accountNumber: dto.bankDetail.accountNumber || '',
            bik: dto.bankDetail.bik,
          }
        : undefined;
    res.createdAt = new Date().toISOString();
    return res;
  }

  /**
   * Factory: Assembles a ContactResponseDto from raw Bitrix24 entity payloads.
   */
  static fromBitrixRaw(
    contactRaw: any,
    requisiteId?: number,
    bankDetail?: BankDetailResponseDto,
  ): ContactResponseDto {
    const id = Number(contactRaw.ID);
    const name = contactRaw.NAME || '';
    const lastName = contactRaw.LAST_NAME || '';
    const fullName = [lastName, name].filter(Boolean).join(' ') || name;

    let phone: string | undefined;
    if (Array.isArray(contactRaw.PHONE) && contactRaw.PHONE.length > 0) {
      phone = contactRaw.PHONE[0].VALUE;
    }

    let email: string | undefined;
    if (Array.isArray(contactRaw.EMAIL) && contactRaw.EMAIL.length > 0) {
      email = contactRaw.EMAIL[0].VALUE;
    }

    let website: string | undefined;
    if (Array.isArray(contactRaw.WEB) && contactRaw.WEB.length > 0) {
      website = contactRaw.WEB[0].VALUE;
    }

    const address = contactRaw.ADDRESS || undefined;
    const city = contactRaw.ADDRESS_CITY || undefined;
    const province = contactRaw.ADDRESS_PROVINCE || undefined;
    const country = contactRaw.ADDRESS_COUNTRY || 'Việt Nam';

    const fullAddress = [address, city, province, country]
      .filter(Boolean)
      .join(', ');

    const res = new ContactResponseDto();
    res.id = id;
    res.name = name;
    res.lastName = lastName || undefined;
    res.fullName = fullName;
    res.phone = phone;
    res.email = email;
    res.website = website;
    res.address = address;
    res.city = city;
    res.province = province;
    res.country = country;
    res.fullAddress = fullAddress || undefined;
    res.requisiteId = requisiteId;
    res.bankDetail = bankDetail;
    res.createdAt = contactRaw.DATE_CREATE || new Date().toISOString();
    return res;
  }
}
