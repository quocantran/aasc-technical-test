import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BitrixApiService } from '../../bitrix-oauth/services/bitrix-api.service';
import { CreateContactDto } from '../dtos/create-contact.dto';
import { UpdateContactDto } from '../dtos/update-contact.dto';
import { ContactQueryDto } from '../dtos/contact-query.dto';
import { ContactResponseDto } from '../dtos/contact-response.dto';
import {
  BitrixRequisite,
  BitrixBankDetail,
} from '../interfaces/requisite.interface';
import { BITRIX_CONSTANTS } from '../../../common/constants/bitrix.constants';

/**
 * Service managing 3-tier CRUD operations for Contacts, Requisites, and Bank Details on Bitrix24 CRM.
 */
@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly bitrixApi: BitrixApiService) {}

  /**
   * Creates a Contact, optionally creates associated Requisites and Bank Details via Bitrix24 Batch API.
   */
  async create(dto: CreateContactDto): Promise<ContactResponseDto> {
    this.logger.log(`[Contacts] Creating Contact via Batch API: "${dto.name}"`);

    const contactFields = this.buildCreateContactPayload(dto);

    // 1. If bank details provided, create Contact + Requisite + Bank Detail in 1 single Batch request
    if (
      dto.bankDetail &&
      (dto.bankDetail.bankName || dto.bankDetail.accountNumber)
    ) {
      const commands: Record<string, string> = {
        add_contact: `crm.contact.add?${this.bitrixApi.serializeBatchPayload({
          fields: contactFields,
          params: { REGISTER_SONET_EVENT: 'N' },
        })}`,
        add_requisite: `crm.requisite.add?${this.bitrixApi.serializeBatchPayload(
          {
            fields: {
              ENTITY_TYPE_ID: BITRIX_CONSTANTS.OWNER_TYPE.CONTACT,
              ENTITY_ID: '$result[add_contact]',
              PRESET_ID: BITRIX_CONSTANTS.PRESET.ORGANIZATION,
              NAME: `Legal info - ${dto.name}`,
              ACTIVE: 'Y',
              ADDRESS_ONLY: 'N',
              RQ_NAME: dto.name,
            },
          },
        )}`,
        add_bank: `crm.requisite.bankdetail.add?${this.bitrixApi.serializeBatchPayload(
          {
            fields: {
              ENTITY_ID: '$result[add_requisite]',
              NAME: 'Main Account',
              RQ_BANK_NAME: dto.bankDetail.bankName,
              RQ_ACC_NUM: dto.bankDetail.accountNumber,
              RQ_BIK: dto.bankDetail.bik || '',
              RQ_ACC_CURRENCY: 'VND',
              COUNTRY_ID: 1,
              ACTIVE: 'Y',
            },
          },
        )}`,
      };

      const batchRes = await this.bitrixApi.callBitrixBatch<{
        add_contact: number;
        add_requisite: number;
        add_bank: number;
      }>(commands, 1);

      const contactId = batchRes.result.add_contact;
      const requisiteId = batchRes.result.add_requisite;
      const bankDetailId = batchRes.result.add_bank;

      return ContactResponseDto.fromDto(
        contactId,
        dto,
        requisiteId,
        bankDetailId,
      );
    }

    // 2. If no bank details, execute single contact creation
    const contactId = await this.bitrixApi.callBitrixAPI<number>(
      BITRIX_CONSTANTS.METHODS.CONTACT.ADD,
      {
        fields: contactFields,
        params: { REGISTER_SONET_EVENT: 'N' },
      },
    );

    return ContactResponseDto.fromDto(contactId, dto);
  }

  /**
   * Retrieves paginated contacts list with associated bank details using batch fetching (solves N+1 query).
   */
  async findAll(query: ContactQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 20, 50);
    const start = (page - 1) * limit;

    this.logger.log(
      `[Contacts] Fetching contact list: page=${page}, limit=${limit}, start=${start}`,
    );

    // 1. Explicitly select multi-fields and address components
    const selectFields = [
      'ID',
      'NAME',
      'LAST_NAME',
      'SECOND_NAME',
      'PHONE',
      'EMAIL',
      'WEB',
      'ADDRESS',
      'ADDRESS_CITY',
      'ADDRESS_PROVINCE',
      'ADDRESS_COUNTRY',
      'DATE_CREATE',
    ];

    const { result: contactList, total: totalFromBitrix } =
      await this.bitrixApi.callBitrixAPIWithPagination<any>(
        BITRIX_CONSTANTS.METHODS.CONTACT.LIST,
        {
          order: { ID: 'DESC' },
          filter: { '>ID': 0 },
          select: selectFields,
          start,
        },
      );

    const contactIds = contactList
      .map((c) => Number(c.ID))
      .filter((id) => !isNaN(id) && id > 0);

    // 2. Batch-fetch Requisites (Single HTTP call instead of N queries)
    const requisiteMap = new Map<number, BitrixRequisite>();
    const bankDetailMap = new Map<number, ContactResponseDto['bankDetail']>();

    if (contactIds.length > 0) {
      try {
        const requisites = await this.bitrixApi.callBitrixAPI<
          BitrixRequisite[]
        >(BITRIX_CONSTANTS.METHODS.REQUISITE.LIST, {
          filter: {
            ENTITY_TYPE_ID: BITRIX_CONSTANTS.OWNER_TYPE.CONTACT,
            '@ENTITY_ID': contactIds,
          },
        });

        const requisiteList = Array.isArray(requisites) ? requisites : [];
        const requisiteIds: number[] = [];

        for (const req of requisiteList) {
          const cId = Number(req.ENTITY_ID);
          if (!requisiteMap.has(cId)) {
            requisiteMap.set(cId, req);
          }
          const rId = Number(req.ID);
          if (rId && !requisiteIds.includes(rId)) {
            requisiteIds.push(rId);
          }
        }

        // 3. Batch-fetch Bank Details using array operator '@ENTITY_ID'
        if (requisiteIds.length > 0) {
          const bankDetails = await this.bitrixApi.callBitrixAPI<
            BitrixBankDetail[]
          >(BITRIX_CONSTANTS.METHODS.BANK_DETAIL.LIST, {
            filter: {
              '@ENTITY_ID': requisiteIds,
            },
          });

          const bankList = Array.isArray(bankDetails) ? bankDetails : [];
          for (const bank of bankList) {
            const rId = Number(bank.ENTITY_ID);
            if (!bankDetailMap.has(rId)) {
              bankDetailMap.set(rId, {
                id: Number(bank.ID),
                bankName: bank.RQ_BANK_NAME || '',
                accountNumber: bank.RQ_ACC_NUM || '',
                bik: bank.RQ_BIK || '',
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(
          `[Contacts] Batch requisite/bank detail retrieval failed: ${err.message}`,
        );
      }
    }

    // 4. Map raw contacts to standardized ContactResponseDto in memory
    const formattedContacts = contactList.map((contact) => {
      const cId = Number(contact.ID);
      const req = requisiteMap.get(cId);
      const reqId = req ? Number(req.ID) : undefined;
      const bank = reqId ? bankDetailMap.get(reqId) : undefined;

      return ContactResponseDto.fromBitrixRaw(contact, reqId, bank);
    });

    const total =
      totalFromBitrix !== undefined
        ? Number(totalFromBitrix)
        : formattedContacts.length;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      success: true,
      data: formattedContacts,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves a single Contact along with its Requisites and Bank Details via Batch API.
   */
  async findOne(id: number): Promise<ContactResponseDto> {
    this.logger.log(`[Contacts] Fetching Contact ID ${id} via Batch API`);

    const commands: Record<string, string> = {
      contact: `crm.contact.get?id=${id}`,
      requisites: `crm.requisite.list?${this.bitrixApi.serializeBatchPayload({
        filter: {
          ENTITY_ID: id,
          ENTITY_TYPE_ID: BITRIX_CONSTANTS.OWNER_TYPE.CONTACT,
        },
      })}`,
      bankDetails: `crm.requisite.bankdetail.list?filter[@ENTITY_ID]=$result[requisites][0][ID]`,
    };

    const batchRes = await this.bitrixApi.callBitrixBatch<{
      contact: any;
      requisites: BitrixRequisite[];
      bankDetails: BitrixBankDetail[];
    }>(commands, 0);

    const contactRaw = batchRes.result.contact;
    if (!contactRaw || !contactRaw.ID) {
      throw new NotFoundException(`Contact #${id} không tồn tại`);
    }

    const requisite = batchRes.result.requisites?.[0];
    const rawBank = batchRes.result.bankDetails?.[0];
    const bankDetail: ContactResponseDto['bankDetail'] = rawBank
      ? {
          id: Number(rawBank.ID),
          bankName: rawBank.RQ_BANK_NAME || '',
          accountNumber: rawBank.RQ_ACC_NUM || '',
          bik: rawBank.RQ_BIK,
        }
      : undefined;

    return ContactResponseDto.fromBitrixRaw(
      contactRaw,
      requisite ? Number(requisite.ID) : undefined,
      bankDetail,
    );
  }

  /**
   * Updates an existing Contact and creates/updates its associated Bank Details via Batch API.
   */
  async update(id: number, dto: UpdateContactDto): Promise<ContactResponseDto> {
    this.logger.log(`[Contacts] Updating Contact ID: ${id} via Batch API`);

    // 1. Single Batch call to verify existence and fetch requisite/bank details
    const batchFetch = await this.bitrixApi.callBitrixBatch<{
      contact: any;
      requisites: BitrixRequisite[];
      bankDetails: BitrixBankDetail[];
    }>({
      contact: `crm.contact.get?id=${id}`,
      requisites: `crm.requisite.list?${this.bitrixApi.serializeBatchPayload({
        filter: {
          ENTITY_ID: id,
          ENTITY_TYPE_ID: BITRIX_CONSTANTS.OWNER_TYPE.CONTACT,
        },
      })}`,
      bankDetails: `crm.requisite.bankdetail.list?filter[@ENTITY_ID]=$result[requisites][0][ID]`,
    });

    const contactRaw = batchFetch.result.contact;
    if (!contactRaw || !contactRaw.ID) {
      throw new NotFoundException(`Contact #${id} không tồn tại`);
    }

    const requisite = batchFetch.result.requisites?.[0];
    const bankDetails = batchFetch.result.bankDetails || [];
    const updateCommands: Record<string, string> = {};

    // 2. Prepare updated contact fields declaratively
    const updateFields: Record<string, any> = {
      ...(dto.name !== undefined && { NAME: dto.name }),
      ...(dto.lastName !== undefined && { LAST_NAME: dto.lastName }),
      ...(dto.address !== undefined && { ADDRESS: dto.address }),
      ...(dto.city !== undefined && { ADDRESS_CITY: dto.city }),
      ...(dto.province !== undefined && { ADDRESS_PROVINCE: dto.province }),
      ...(dto.country !== undefined && { ADDRESS_COUNTRY: dto.country }),
      ...(dto.phone !== undefined && {
        PHONE: this.buildMultiFieldUpdatePayload(contactRaw.PHONE, dto.phone),
      }),
      ...(dto.email !== undefined && {
        EMAIL: this.buildMultiFieldUpdatePayload(contactRaw.EMAIL, dto.email),
      }),
      ...(dto.website !== undefined && {
        WEB: this.buildMultiFieldUpdatePayload(contactRaw.WEB, dto.website),
      }),
    };

    if (Object.keys(updateFields).length > 0) {
      updateCommands.update_contact = `crm.contact.update?${this.bitrixApi.serializeBatchPayload(
        {
          id,
          fields: updateFields,
          params: { REGISTER_SONET_EVENT: 'N' },
        },
      )}`;
    }

    // 3. Synchronize, update or delete bank details in batch
    if (dto.bankDetail === null) {
      if (requisite) {
        updateCommands.delete_requisite = `crm.requisite.delete?id=${requisite.ID}`;
      }
    } else if (
      dto.bankDetail &&
      (dto.bankDetail.bankName || dto.bankDetail.accountNumber)
    ) {
      if (requisite) {
        if (dto.name) {
          updateCommands.update_requisite = `crm.requisite.update?${this.bitrixApi.serializeBatchPayload(
            {
              id: Number(requisite.ID),
              fields: {
                NAME: `Legal info - ${dto.name}`,
              },
            },
          )}`;
        }

        if (bankDetails.length > 0) {
          updateCommands.update_bank = `crm.requisite.bankdetail.update?${this.bitrixApi.serializeBatchPayload(
            {
              id: Number(bankDetails[0].ID),
              fields: {
                RQ_BANK_NAME: dto.bankDetail.bankName,
                RQ_ACC_NUM: dto.bankDetail.accountNumber,
                RQ_BIK: dto.bankDetail.bik || '',
              },
            },
          )}`;
        } else {
          updateCommands.add_bank = `crm.requisite.bankdetail.add?${this.bitrixApi.serializeBatchPayload(
            {
              fields: {
                ENTITY_ID: Number(requisite.ID),
                NAME: 'Main Account',
                RQ_BANK_NAME: dto.bankDetail.bankName,
                RQ_ACC_NUM: dto.bankDetail.accountNumber,
                RQ_BIK: dto.bankDetail.bik || '',
                COUNTRY_ID: 1,
              },
            },
          )}`;
        }
      } else {
        updateCommands.add_requisite = `crm.requisite.add?${this.bitrixApi.serializeBatchPayload(
          {
            fields: {
              ENTITY_TYPE_ID: BITRIX_CONSTANTS.OWNER_TYPE.CONTACT,
              ENTITY_ID: id,
              PRESET_ID: BITRIX_CONSTANTS.PRESET.ORGANIZATION,
              NAME: `Legal info - ${dto.name || 'Contact #' + id}`,
              ACTIVE: 'Y',
            },
          },
        )}`;

        updateCommands.add_bank = `crm.requisite.bankdetail.add?${this.bitrixApi.serializeBatchPayload(
          {
            fields: {
              ENTITY_ID: '$result[add_requisite]',
              NAME: 'Main Account',
              RQ_BANK_NAME: dto.bankDetail.bankName,
              RQ_ACC_NUM: dto.bankDetail.accountNumber,
              RQ_BIK: dto.bankDetail.bik || '',
              COUNTRY_ID: 1,
            },
          },
        )}`;
      }
    }

    // 4. Execute update commands in batch if any
    let batchUpdateRes: any;
    if (Object.keys(updateCommands).length > 0) {
      batchUpdateRes = await this.bitrixApi.callBitrixBatch(updateCommands, 0);
    }

    // 5. Assemble updated ContactResponseDto in-memory without extra network roundtrips
    let finalRequisiteId: number | undefined;
    let finalBankDetail: ContactResponseDto['bankDetail'];

    if (dto.bankDetail === null) {
      finalRequisiteId = undefined;
      finalBankDetail = undefined;
    } else if (
      dto.bankDetail &&
      (dto.bankDetail.bankName || dto.bankDetail.accountNumber)
    ) {
      if (requisite) {
        finalRequisiteId = Number(requisite.ID);
        finalBankDetail = {
          id:
            bankDetails.length > 0
              ? Number(bankDetails[0].ID)
              : batchUpdateRes?.result?.add_bank || undefined,
          bankName:
            dto.bankDetail.bankName || (bankDetails[0]?.RQ_BANK_NAME ?? ''),
          accountNumber:
            dto.bankDetail.accountNumber || (bankDetails[0]?.RQ_ACC_NUM ?? ''),
          bik:
            dto.bankDetail.bik !== undefined
              ? dto.bankDetail.bik
              : bankDetails[0]?.RQ_BIK,
        };
      } else {
        finalRequisiteId = batchUpdateRes?.result?.add_requisite || undefined;
        finalBankDetail = {
          id: batchUpdateRes?.result?.add_bank || undefined,
          bankName: dto.bankDetail.bankName || '',
          accountNumber: dto.bankDetail.accountNumber || '',
          bik: dto.bankDetail.bik,
        };
      }
    } else {
      finalRequisiteId = requisite ? Number(requisite.ID) : undefined;
      if (bankDetails.length > 0) {
        finalBankDetail = {
          id: Number(bankDetails[0].ID),
          bankName: bankDetails[0].RQ_BANK_NAME || '',
          accountNumber: bankDetails[0].RQ_ACC_NUM || '',
          bik: bankDetails[0].RQ_BIK,
        };
      }
    }

    const mergedRaw = {
      ID: id,
      NAME: dto.name !== undefined ? dto.name : contactRaw.NAME,
      LAST_NAME:
        dto.lastName !== undefined ? dto.lastName : contactRaw.LAST_NAME,
      ADDRESS: dto.address !== undefined ? dto.address : contactRaw.ADDRESS,
      ADDRESS_CITY: dto.city !== undefined ? dto.city : contactRaw.ADDRESS_CITY,
      ADDRESS_PROVINCE:
        dto.province !== undefined ? dto.province : contactRaw.ADDRESS_PROVINCE,
      ADDRESS_COUNTRY:
        dto.country !== undefined
          ? dto.country
          : contactRaw.ADDRESS_COUNTRY || 'Việt Nam',
      PHONE:
        dto.phone !== undefined
          ? dto.phone
            ? [{ VALUE: dto.phone }]
            : []
          : contactRaw.PHONE,
      EMAIL:
        dto.email !== undefined
          ? dto.email
            ? [{ VALUE: dto.email }]
            : []
          : contactRaw.EMAIL,
      WEB:
        dto.website !== undefined
          ? dto.website
            ? [{ VALUE: dto.website }]
            : []
          : contactRaw.WEB,
      DATE_CREATE: contactRaw.DATE_CREATE,
    };

    return ContactResponseDto.fromBitrixRaw(
      mergedRaw,
      finalRequisiteId,
      finalBankDetail,
    );
  }

  /**
   * Deletes a Contact by ID, triggering Bitrix24 to cascade-delete linked requisites in 1 single API call.
   */
  async remove(id: number): Promise<{ success: boolean; message: string }> {
    this.logger.log(`[Contacts] Deleting Contact ID: ${id}`);

    const result = await this.bitrixApi.callBitrixAPI<boolean>(
      BITRIX_CONSTANTS.METHODS.CONTACT.DELETE,
      { id },
    );

    if (!result) {
      throw new NotFoundException(`Contact #${id} không tồn tại trên Bitrix24`);
    }

    return {
      success: true,
      message: `Đã xóa Contact #${id} thành công trên Bitrix24 CRM`,
    };
  }

  /**
   * Helper: Builds declarative creation payload for crm.contact.add.
   */
  private buildCreateContactPayload(
    dto: CreateContactDto,
  ): Record<string, any> {
    return {
      NAME: dto.name,
      LAST_NAME: dto.lastName || '',
      OPENED: 'Y',
      TYPE_ID: 'CLIENT',
      SOURCE_ID: 'WEB',
      ADDRESS_COUNTRY: dto.country || 'Việt Nam',
      ...(dto.address && { ADDRESS: dto.address }),
      ...(dto.city && { ADDRESS_CITY: dto.city }),
      ...(dto.province && { ADDRESS_PROVINCE: dto.province }),
      ...(dto.phone && {
        PHONE: [
          { VALUE: dto.phone, VALUE_TYPE: BITRIX_CONSTANTS.VALUE_TYPE.WORK },
        ],
      }),
      ...(dto.email && {
        EMAIL: [
          { VALUE: dto.email, VALUE_TYPE: BITRIX_CONSTANTS.VALUE_TYPE.WORK },
        ],
      }),
      ...(dto.website && {
        WEB: [
          { VALUE: dto.website, VALUE_TYPE: BITRIX_CONSTANTS.VALUE_TYPE.WORK },
        ],
      }),
    };
  }

  /**
   * Helper: Formats multi-field update payloads preserving existing item IDs.
   */
  private buildMultiFieldUpdatePayload(
    existingList: any[] | undefined,
    newValue: string | undefined,
    valueType = BITRIX_CONSTANTS.VALUE_TYPE.WORK,
  ) {
    if (newValue === undefined) return undefined;

    const payload: any[] = [];
    const list = Array.isArray(existingList) ? existingList : [];

    if (newValue) {
      if (list.length > 0) {
        // Update first item in-place using its internal Bitrix24 ID
        payload.push({
          ID: list[0].ID,
          VALUE: newValue,
          VALUE_TYPE: valueType,
        });
        // Mark subsequent old duplicate items as deleted
        for (let i = 1; i < list.length; i++) {
          payload.push({
            ID: list[i].ID,
            DELETE: 'Y',
          });
        }
      } else {
        payload.push({
          VALUE: newValue,
          VALUE_TYPE: valueType,
        });
      }
    } else {
      for (const item of list) {
        payload.push({
          ID: item.ID,
          DELETE: 'Y',
        });
      }
    }

    return payload;
  }
}
