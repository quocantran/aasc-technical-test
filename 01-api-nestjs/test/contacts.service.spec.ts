import {
  describe,
  it,
  expect,
  beforeEach,
  jest,
  beforeAll,
} from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { ContactsService } from '../src/modules/contacts/services/contacts.service';
import { BitrixApiService } from '../src/modules/bitrix-oauth/services/bitrix-api.service';
import { CreateContactDto } from '../src/modules/contacts/dtos/create-contact.dto';
import { UpdateContactDto } from '../src/modules/contacts/dtos/update-contact.dto';

describe('ContactsService', () => {
  let service: ContactsService;
  let mockBitrixApi: any;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  beforeEach(async () => {
    mockBitrixApi = {
      callBitrixAPI: jest.fn(),
      callBitrixAPIWithPagination: jest.fn(),
      callBitrixBatch: jest.fn(),
      serializeBatchPayload: jest.fn((params: any) =>
        new URLSearchParams(params as any).toString(),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: BitrixApiService,
          useValue: mockBitrixApi,
        },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  describe('1. create()', () => {
    it('should create Contact, Requisite (Type 3), and Bank Detail via Bitrix24 Batch API when bank details are provided', async () => {
      const dto: CreateContactDto = {
        name: 'John',
        lastName: 'Doe',
        address: '123 Le Loi',
        city: 'District 1',
        province: 'HCMC',
        country: 'Vietnam',
        phone: '0912345678',
        email: 'john@example.com',
        website: 'https://example.com',
        bankDetail: {
          bankName: 'Vietcombank',
          accountNumber: '0071001234567',
          bik: 'BFTVVNVX',
        },
      };

      mockBitrixApi.callBitrixBatch.mockResolvedValue({
        result: {
          add_contact: 101,
          add_requisite: 201,
          add_bank: 301,
        },
        result_error: {},
        result_total: {},
      });

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe(101);
      expect(result.fullName).toBe('Doe John');
      expect(result.requisiteId).toBe(201);
      expect(result.bankDetail?.id).toBe(301);
      expect(result.bankDetail?.bankName).toBe('Vietcombank');
      expect(mockBitrixApi.callBitrixBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          add_contact: expect.stringContaining('crm.contact.add'),
          add_requisite: expect.stringContaining('crm.requisite.add'),
          add_bank: expect.stringContaining('crm.requisite.bankdetail.add'),
        }),
        1,
      );
    });

    it('should create Contact via single call when no bank details are provided', async () => {
      const dto: CreateContactDto = {
        name: 'Jane Doe',
        country: '',
      };

      mockBitrixApi.callBitrixAPI.mockResolvedValue(102);

      const result = await service.create(dto);

      expect(result.id).toBe(102);
      expect(mockBitrixApi.callBitrixAPI).toHaveBeenCalledWith(
        'crm.contact.add',
        expect.objectContaining({
          fields: expect.objectContaining({
            NAME: 'Jane Doe',
          }),
        }),
      );
      expect(mockBitrixApi.callBitrixBatch).not.toHaveBeenCalled();
    });

    it('should create requisite via Batch API when only bankName or only accountNumber is provided', async () => {
      const dto: CreateContactDto = {
        name: 'Bank Name Only',
        bankDetail: { bankName: 'ACB', accountNumber: '' },
      };

      mockBitrixApi.callBitrixBatch.mockResolvedValue({
        result: {
          add_contact: 105,
          add_requisite: 205,
          add_bank: 305,
        },
        result_error: {},
        result_total: {},
      });

      const result = await service.create(dto);
      expect(result.id).toBe(105);
      expect(mockBitrixApi.callBitrixBatch).toHaveBeenCalled();
    });
  });

  describe('2. findAll()', () => {
    it('should retrieve contact list with pagination and formatted requisites via batch query', async () => {
      mockBitrixApi.callBitrixAPIWithPagination.mockResolvedValue({
        result: [
          {
            ID: '101',
            NAME: 'John',
            LAST_NAME: 'Doe',
            PHONE: [{ VALUE: '0912345678' }],
            EMAIL: [{ VALUE: 'john@example.com' }],
            WEB: [{ VALUE: 'https://example.com' }],
            ADDRESS: '123 Street',
          },
        ],
        total: 142,
      });

      mockBitrixApi.callBitrixAPI.mockImplementation((method: string) => {
        if (method === 'crm.requisite.list') {
          return Promise.resolve([{ ID: '201', ENTITY_ID: '101' }]);
        }
        if (method === 'crm.requisite.bankdetail.list') {
          return Promise.resolve([
            {
              ID: '301',
              ENTITY_ID: '201',
              RQ_BANK_NAME: 'ACB',
              RQ_ACC_NUM: '123456',
            },
          ]);
        }
        return Promise.resolve(null);
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].bankDetail?.bankName).toBe('ACB');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(142);
      expect(result.pagination.totalPages).toBe(8);
    });

    it('should handle empty response from Bitrix24 crm.contact.list safely', async () => {
      mockBitrixApi.callBitrixAPIWithPagination.mockResolvedValue({
        result: [],
        total: 0,
      });

      const result = await service.findAll({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(0);
    });

    it('should catch and handle errors during batch requisite query safely', async () => {
      mockBitrixApi.callBitrixAPIWithPagination.mockResolvedValue({
        result: [{ ID: '101', NAME: 'Test' }],
        total: 1,
      });
      mockBitrixApi.callBitrixAPI.mockRejectedValue(
        new Error('Batch requisite error'),
      );

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
      expect(result.data[0].requisiteId).toBeUndefined();
    });
  });

  describe('3. findOne()', () => {
    it('should return contact with full requisite and bank details via Batch API', async () => {
      mockBitrixApi.callBitrixBatch.mockResolvedValue({
        result: {
          contact: {
            ID: '101',
            NAME: 'Alice',
            LAST_NAME: '',
            ADDRESS_COUNTRY: 'Việt Nam',
          },
          requisites: [{ ID: '201', ENTITY_ID: '101' }],
          bankDetails: [
            {
              ID: '301',
              ENTITY_ID: '201',
              RQ_BANK_NAME: 'Vietcombank',
              RQ_ACC_NUM: '0071001234567',
              RQ_BIK: 'BFTVVNVX',
            },
          ],
        },
      });

      const result = await service.findOne(101);

      expect(result.id).toBe(101);
      expect(result.fullName).toBe('Alice');
      expect(result.country).toBe('Việt Nam');
      expect(result.requisiteId).toBe(201);
      expect(result.bankDetail?.bankName).toBe('Vietcombank');
      expect(mockBitrixApi.callBitrixBatch).toHaveBeenCalled();
    });

    it('should throw NotFoundException when contact is not found via Batch API', async () => {
      mockBitrixApi.callBitrixBatch.mockResolvedValue({
        result: {
          contact: null,
          requisites: [],
          bankDetails: [],
        },
      });

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. update()', () => {
    it('should throw NotFoundException if contact does not exist', async () => {
      mockBitrixApi.callBitrixBatch.mockResolvedValue({
        result: {
          contact: null,
          requisites: [],
          bankDetails: [],
        },
      });

      await expect(service.update(999, { name: 'New Name' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update basic contact fields, address, and in-place multi-fields via Batch API', async () => {
      const updateDto: UpdateContactDto = {
        name: 'Bob',
        lastName: 'Smith',
        address: '456 Tran Hung Dao',
        city: 'District 5',
        province: 'HCMC',
        country: 'Vietnam',
        phone: '0988888888',
        email: 'bob.new@example.com',
        website: 'https://newsite.com',
      };

      mockBitrixApi.callBitrixBatch
        // Step 1: batchFetch
        .mockResolvedValueOnce({
          result: {
            contact: {
              ID: '101',
              NAME: 'Old Bob',
              PHONE: [
                { ID: '11', VALUE: '0911111111' },
                { ID: '12', VALUE: '0922222222' },
              ],
              EMAIL: [{ ID: '21', VALUE: 'old@example.com' }],
              WEB: [{ ID: '31', VALUE: 'https://old.com' }],
            },
            requisites: [],
            bankDetails: [],
          },
        })
        // Step 2: updateCommands batch execution
        .mockResolvedValueOnce({
          result: {
            update_contact: true,
          },
        });

      const result = await service.update(101, updateDto);

      expect(result).toBeDefined();
      expect(result.fullName).toBe('Smith Bob');
      expect(result.phone).toBe('0988888888');
      expect(result.email).toBe('bob.new@example.com');
      expect(mockBitrixApi.callBitrixBatch).toHaveBeenCalledTimes(2);
    });

    it('should handle empty update DTO without calling update batch command', async () => {
      mockBitrixApi.callBitrixBatch.mockResolvedValueOnce({
        result: {
          contact: { ID: '101', NAME: 'Bob' },
          requisites: [],
          bankDetails: [],
        },
      });

      const result = await service.update(101, {});

      expect(result.id).toBe(101);
      expect(mockBitrixApi.callBitrixBatch).toHaveBeenCalledTimes(1);
    });

    it('should preserve existing bank details when bankDetail is undefined in DTO', async () => {
      mockBitrixApi.callBitrixBatch
        .mockResolvedValueOnce({
          result: {
            contact: { ID: '101', NAME: 'Bob' },
            requisites: [{ ID: '201', ENTITY_ID: '101' }],
            bankDetails: [
              {
                ID: '301',
                ENTITY_ID: '201',
                RQ_BANK_NAME: 'Preserved Bank',
                RQ_ACC_NUM: '111222',
                RQ_BIK: 'BIK123',
              },
            ],
          },
        })
        .mockResolvedValueOnce({ result: { update_contact: true } });

      const result = await service.update(101, { name: 'Bob Updated' });

      expect(result.name).toBe('Bob Updated');
      expect(result.bankDetail?.bankName).toBe('Preserved Bank');
      expect(result.bankDetail?.accountNumber).toBe('111222');
      expect(result.requisiteId).toBe(201);
    });

    it('should delete multi-fields when empty string is provided and handle new multi-field addition', async () => {
      const updateDto: UpdateContactDto = {
        phone: '',
        email: 'brandnew@example.com',
      };

      mockBitrixApi.callBitrixBatch
        .mockResolvedValueOnce({
          result: {
            contact: {
              ID: '101',
              NAME: 'Bob',
              PHONE: [{ ID: '11', VALUE: '0911111111' }],
              EMAIL: [],
            },
            requisites: [],
            bankDetails: [],
          },
        })
        .mockResolvedValueOnce({ result: { update_contact: true } });

      const result = await service.update(101, updateDto);
      expect(result).toBeDefined();
      expect(result.phone).toBeUndefined();
      expect(result.email).toBe('brandnew@example.com');
    });

    it('should update existing Bank Detail and Requisite when both Requisite and Bank Detail exist', async () => {
      const updateDto: UpdateContactDto = {
        name: 'Bob Updated',
        bankDetail: {
          bankName: 'Techcombank',
          accountNumber: '1903001234567',
          bik: 'VTCBVNVX',
        },
      };

      mockBitrixApi.callBitrixBatch
        .mockResolvedValueOnce({
          result: {
            contact: { ID: '101', NAME: 'Bob' },
            requisites: [{ ID: '201', ENTITY_ID: '101' }],
            bankDetails: [
              { ID: '301', ENTITY_ID: '201', RQ_BANK_NAME: 'Old Bank' },
            ],
          },
        })
        .mockResolvedValueOnce({
          result: {
            update_requisite: true,
            update_bank: true,
          },
        });

      const result = await service.update(101, updateDto);
      expect(result).toBeDefined();
      expect(result.name).toBe('Bob Updated');
      expect(result.bankDetail?.bankName).toBe('Techcombank');
      expect(result.bankDetail?.accountNumber).toBe('1903001234567');
      expect(result.bankDetail?.id).toBe(301);
    });

    it('should delete Requisite when bankDetail is null', async () => {
      const updateDto: UpdateContactDto = {
        bankDetail: null,
      };

      mockBitrixApi.callBitrixBatch
        .mockResolvedValueOnce({
          result: {
            contact: { ID: '101', NAME: 'Bob' },
            requisites: [{ ID: '201', ENTITY_ID: '101' }],
            bankDetails: [],
          },
        })
        .mockResolvedValueOnce({ result: { delete_requisite: true } });

      const result = await service.update(101, updateDto);
      expect(result.bankDetail).toBeUndefined();
      expect(result.requisiteId).toBeUndefined();
    });

    it('should create new Bank Detail when Requisite exists but Bank Detail does not exist', async () => {
      const updateDto: UpdateContactDto = {
        bankDetail: {
          bankName: 'VPBank',
          accountNumber: '888888888',
        },
      };

      mockBitrixApi.callBitrixBatch
        .mockResolvedValueOnce({
          result: {
            contact: { ID: '101', NAME: 'Bob' },
            requisites: [{ ID: '201', ENTITY_ID: '101' }],
            bankDetails: [],
          },
        })
        .mockResolvedValueOnce({ result: { add_bank: 302 } });

      const result = await service.update(101, updateDto);
      expect(result.bankDetail?.bankName).toBe('VPBank');
      expect(result.bankDetail?.accountNumber).toBe('888888888');
      expect(result.bankDetail?.id).toBe(302);
    });

    it('should create new Requisite and Bank Detail when Contact has no Requisite', async () => {
      const updateDto: UpdateContactDto = {
        bankDetail: {
          bankName: 'BIDV',
          accountNumber: '123456789',
        },
      };

      mockBitrixApi.callBitrixBatch
        .mockResolvedValueOnce({
          result: {
            contact: { ID: '101' },
            requisites: [],
            bankDetails: [],
          },
        })
        .mockResolvedValueOnce({
          result: { add_requisite: 202, add_bank: 303 },
        });

      const result = await service.update(101, updateDto);
      expect(result.requisiteId).toBe(202);
      expect(result.bankDetail?.id).toBe(303);
      expect(result.bankDetail?.bankName).toBe('BIDV');
    });
  });

  describe('5. remove()', () => {
    it('should delete contact and return success confirmation in a single API call', async () => {
      mockBitrixApi.callBitrixAPI.mockResolvedValue(true);

      const result = await service.remove(101);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Đã xóa Contact #101 thành công');
      expect(mockBitrixApi.callBitrixAPI).toHaveBeenCalledWith(
        'crm.contact.delete',
        { id: 101 },
      );
    });

    it('should throw NotFoundException when Bitrix24 returns false on delete', async () => {
      mockBitrixApi.callBitrixAPI.mockResolvedValue(false);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('6. Helper Methods & Edge Cases', () => {
    it('should format fullAddress correctly when all address fields are present', async () => {
      mockBitrixApi.callBitrixBatch.mockResolvedValue({
        result: {
          contact: {
            ID: '101',
            NAME: 'Solo Name',
            ADDRESS: '123 Le Loi',
            ADDRESS_CITY: 'District 1',
            ADDRESS_PROVINCE: 'HCMC',
            ADDRESS_COUNTRY: 'Việt Nam',
          },
          requisites: [],
          bankDetails: [],
        },
      });

      const result = await service.findOne(101);

      expect(result.fullAddress).toBe('123 Le Loi, District 1, HCMC, Việt Nam');
    });
  });
});
