import axios, { AxiosInstance } from 'axios';
import { config } from '../configs/env';
import { ContactData, JotformSubmissionApiResponse } from '../interfaces/contact.interface';
import { logger } from '../utils/logger';

export class JotformService {
  private client: AxiosInstance;

  // Initialize Axios client with Jotform API configuration
  constructor() {
    this.client = axios.create({
      baseURL: config.jotform.apiBaseUrl,
      timeout: 10000,
      headers: {
        APIKEY: config.jotform.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // Retrieve submission details by submissionId using Jotform REST API
  public async getSubmission(submissionId: string): Promise<ContactData> {
    logger.info(`Fetching submission details from Jotform API for submissionId: ${submissionId}`);

    try {
      const response = await this.client.get<JotformSubmissionApiResponse>(
        `/submission/${submissionId}`,
        {
          params: { apiKey: config.jotform.apiKey },
        }
      );

      if (response.data.responseCode !== 200 || !response.data.content) {
        throw new Error(
          `Jotform API returned status ${response.data.responseCode}: ${response.data.message}`
        );
      }

      const content = response.data.content;
      const answers = content.answers || {};

      let fullName = '';
      let phone = '';
      let email = '';

      // Iterate through form answers to extract Full Name, Phone, and Email
      for (const key of Object.keys(answers)) {
        const field = answers[key];
        const fieldText = (field.text || '').toLowerCase();
        const fieldName = (field.name || '').toLowerCase();
        const fieldType = (field.type || '').toLowerCase();

        // Detect Name field
        if (
          fieldType.includes('fullname') ||
          fieldText.includes('họ và tên') ||
          fieldText.includes('name') ||
          fieldName.includes('name')
        ) {
          if (field.answer && typeof field.answer === 'object') {
            const first = field.answer.first || '';
            const last = field.answer.last || '';
            fullName = `${first} ${last}`.trim();
          } else if (typeof field.answer === 'string') {
            fullName = field.answer;
          }
        }

        // Detect Phone field
        if (
          fieldType.includes('phone') ||
          fieldText.includes('điện thoại') ||
          fieldText.includes('phone') ||
          fieldName.includes('phone')
        ) {
          if (field.answer && typeof field.answer === 'object') {
            phone = field.answer.full || `${field.answer.area || ''}${field.answer.phone || ''}`;
          } else if (typeof field.answer === 'string') {
            phone = field.answer;
          }
        }

        // Detect Email field
        if (
          fieldType.includes('email') ||
          fieldText.includes('email') ||
          fieldName.includes('email')
        ) {
          if (typeof field.answer === 'string') {
            email = field.answer;
          }
        }
      }

      logger.info(
        `Extracted data from Jotform API: Name="${fullName}", Phone="${phone}", Email="${email}"`
      );

      return {
        fullName,
        phone,
        email,
        submissionId: content.id,
        formId: content.form_id,
      };
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      logger.error(`Failed to fetch submission from Jotform API: ${errorMsg}`, {
        submissionId,
        stack: error.stack,
      });
      throw new Error(`Jotform API Error: ${errorMsg}`);
    }
  }

  // Fallback extraction from incoming webhook body
  public extractFromWebhookPayload(body: any): ContactData {
    logger.info('Executing fallback parser on webhook payload');

    let fullName = '';
    let phone = '';
    let email = '';
    const submissionId = String(body.submissionID || body.submission_id || body.id || '');
    const formId = String(body.formID || body.form_id || '');

    // Parse rawRequest JSON if present
    if (body.rawRequest) {
      try {
        const raw = typeof body.rawRequest === 'string' ? JSON.parse(body.rawRequest) : body.rawRequest;
        for (const [key, val] of Object.entries(raw)) {
          const k = key.toLowerCase();
          if (k.includes('name') || k.includes('hova') || k.includes('fullname')) {
            if (typeof val === 'object' && val !== null) {
              const obj: any = val;
              fullName = `${obj.first || ''} ${obj.last || ''}`.trim();
            } else if (typeof val === 'string') {
              fullName = val;
            }
          }
          if (k.includes('phone') || k.includes('sdin') || k.includes('dienthoai')) {
            if (typeof val === 'object' && val !== null) {
              const obj: any = val;
              phone = obj.full || `${obj.area || ''}${obj.phone || ''}`;
            } else if (typeof val === 'string') {
              phone = val;
            }
          }
          if (k.includes('email')) {
            if (typeof val === 'string') {
              email = val;
            }
          }
        }
      } catch (err) {
        logger.warn('Failed to parse rawRequest object during fallback extraction');
      }
    }

    // Parse pretty format if fields are still empty
    if ((!fullName || !phone || !email) && body.pretty) {
      const parts = String(body.pretty).split(',');
      for (const part of parts) {
        const [label, ...valParts] = part.split(':');
        const val = valParts.join(':').trim();
        const l = (label || '').toLowerCase();
        if (l.includes('tên') || l.includes('name')) fullName = fullName || val;
        if (l.includes('thoại') || l.includes('phone')) phone = phone || val;
        if (l.includes('email')) email = email || val;
      }
    }

    logger.info(`Fallback extracted data: Name="${fullName}", Phone="${phone}", Email="${email}"`);

    return { fullName, phone, email, submissionId, formId };
  }
}

export const jotformService = new JotformService();
