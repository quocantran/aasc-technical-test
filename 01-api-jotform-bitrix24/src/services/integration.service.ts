import { ContactData } from '../interfaces/contact.interface';
import { logger } from '../utils/logger';
import { validateContactData } from '../utils/validator';
import { bitrix24Service } from './bitrix24.service';
import { jotformService } from './jotform.service';

export interface SyncResult {
  success: boolean;
  submissionId: string;
  contactId?: number;
  contactData?: ContactData;
  error?: string;
  processedAt: string;
}

export class IntegrationService {
  // Extract submission ID from webhook payload regardless of content-type
  public extractSubmissionId(body: any): string | null {
    if (!body) return null;

    if (body.submissionID) return String(body.submissionID);
    if (body.submission_id) return String(body.submission_id);
    if (body.id) return String(body.id);

    // Parse rawRequest if payload was sent as stringified multipart field
    if (body.rawRequest) {
      try {
        const raw =
          typeof body.rawRequest === 'string' ? JSON.parse(body.rawRequest) : body.rawRequest;
        if (raw.submissionID) return String(raw.submissionID);
        if (raw.submission_id) return String(raw.submission_id);
      } catch (err) {
        logger.warn('Failed to parse rawRequest string for submission ID extraction');
      }
    }

    return null;
  }

  // Orchestrate full pipeline: Trigger -> Jotform API -> Validation -> Bitrix24
  public async handleWebhookSubmission(webhookBody: any): Promise<SyncResult> {
    const processedAt = new Date().toISOString();
    const submissionId = this.extractSubmissionId(webhookBody);

    if (!submissionId) {
      logger.error('No submissionID found in incoming webhook payload');
      throw new Error('Missing submissionID in webhook payload');
    }

    logger.info(`Processing integration pipeline for Submission ID: ${submissionId}`);

    // Step 1: Fetch submission data from Jotform REST API (with payload fallback)
    let rawContact: ContactData;
    try {
      rawContact = await jotformService.getSubmission(submissionId);
    } catch (apiError: any) {
      logger.warn(
        `Jotform API request failed (${apiError.message}), falling back to webhook payload parser`
      );
      rawContact = jotformService.extractFromWebhookPayload(webhookBody);
    }

    // Step 2: Validate and sanitize canonical contact data
    const validatedContact = validateContactData(rawContact);

    // Step 3: Create contact record in Bitrix24 CRM
    const contactId = await bitrix24Service.createContact(validatedContact);

    logger.info(
      `Integration completed successfully: Jotform Submission [${submissionId}] -> Bitrix24 Contact [${contactId}]`
    );

    return {
      success: true,
      submissionId,
      contactId,
      contactData: validatedContact,
      processedAt,
    };
  }
}

export const integrationService = new IntegrationService();
