import axios, { AxiosInstance } from 'axios';
import { config } from '../configs/env';
import {
  Bitrix24ApiResponse,
  Bitrix24CreateContactPayload,
  ContactData,
} from '../interfaces/contact.interface';
import { logger } from '../utils/logger';
import { maskContact, maskName } from '../utils/masker';

export class Bitrix24Service {
  private client: AxiosInstance;
  private baseUrl: string;

  // Initialize Axios client with configured Bitrix24 Inbound Webhook URL
  constructor() {
    this.baseUrl = config.bitrix24.webhookUrl.endsWith('/')
      ? config.bitrix24.webhookUrl
      : `${config.bitrix24.webhookUrl}/`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Create a new Contact record in Bitrix24 CRM via crm.contact.add REST method
  public async createContact(contact: ContactData): Promise<number> {
    const startTime = Date.now();
    logger.info(`Initiating Bitrix24 CRM Contact creation for: "${maskName(contact.fullName)}"`);

    const payload: Bitrix24CreateContactPayload = {
      fields: {
        NAME: contact.fullName,
        PHONE: [{ VALUE: contact.phone, VALUE_TYPE: 'WORK' }],
        EMAIL: [{ VALUE: contact.email, VALUE_TYPE: 'WORK' }],
        COMMENTS: `Auto-synchronized from Jotform (Form ID: ${contact.formId || 'N/A'}, Submission ID: ${contact.submissionId || 'N/A'})`,
        OPENED: 'Y',
        TYPE_ID: 'CLIENT',
      },
      params: {
        REGISTER_SONET_EVENT: 'Y',
      },
    };

    try {
      const response = await this.client.post<Bitrix24ApiResponse<number>>(
        'crm.contact.add.json',
        payload
      );

      const duration = Date.now() - startTime;

      if (response.data.error) {
        throw new Error(
          `Bitrix24 Error [${response.data.error}]: ${response.data.error_description || 'Unknown error'}`
        );
      }

      const contactId = response.data.result;
      if (!contactId) {
        throw new Error('Bitrix24 did not return a valid Contact ID in response result');
      }

      logger.info(
        `Successfully created Bitrix24 Contact (ID: ${contactId}) in ${duration}ms`,
        { contactId, duration, contactName: maskName(contact.fullName) }
      );

      return contactId;
    } catch (error: any) {
      const errorDetail =
        error.response?.data?.error_description ||
        error.response?.data?.error ||
        error.message;

      logger.error(`Bitrix24 API Contact creation failed: ${errorDetail}`, {
        contact: maskContact(contact),
        status: error.response?.status,
        stack: error.stack,
      });

      throw new Error(`Bitrix24 API Error: ${errorDetail}`);
    }
  }
}

export const bitrix24Service = new Bitrix24Service();
