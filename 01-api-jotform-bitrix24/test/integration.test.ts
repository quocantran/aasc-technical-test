import axios from 'axios';
import { config } from '../src/configs/env';
import { bitrix24Service } from '../src/services/bitrix24.service';
import { logger } from '../src/utils/logger';
import { validateContactData } from '../src/utils/validator';

// Run end-to-end integration verification tests
async function runIntegrationTest() {
  logger.info('Starting integration test suite...');

  // Test 1: Verify data validator and sanitization
  logger.info('Test 1: Validating Contact Data Sanitizer...');
  const sample = validateContactData({
    fullName: '   Test Candidate Automated   ',
    phone: '+84 (091) 234-5678',
    email: 'TEST.AUTOMATED@EXAMPLE.COM',
  });

  if (
    sample.fullName === 'Test Candidate Automated' &&
    sample.phone === '+840912345678' &&
    sample.email === 'test.automated@example.com'
  ) {
    logger.info('[SUCCESS] Test 1 PASSED: Data validator correctly sanitizes and formats contact');
  } else {
    throw new Error('[FAILED] Test 1: Sanitization mismatch');
  }

  // Test 2: Verify Jotform API authentication and connectivity
  logger.info('Test 2: Verifying Jotform API connectivity...');
  try {
    const jotformUser = await axios.get(`${config.jotform.apiBaseUrl}/user`, {
      headers: { APIKEY: config.jotform.apiKey },
      timeout: 5000,
    });
    logger.info(`[SUCCESS] Test 2 PASSED: Jotform authenticated user: ${jotformUser.data?.content?.username || 'OK'}`);
  } catch (err: any) {
    logger.error(`[FAILED] Test 2: Jotform API connection failed: ${err.message}`);
  }

  // Test 3: Verify Bitrix24 CRM Contact creation
  logger.info('Test 3: Creating a sample contact in Bitrix24 CRM...');
  try {
    const testContactId = await bitrix24Service.createContact({
      fullName: 'Nguyễn Văn Test Automated',
      phone: '0988776655',
      email: 'automated.test@example.com',
      formId: config.jotform.formId,
      submissionId: 'test_auto_' + Date.now(),
    });

    logger.info(`[SUCCESS] Test 3 PASSED: Bitrix24 CRM Contact successfully created with ID: ${testContactId}`);
  } catch (err: any) {
    logger.error(`[FAILED] Test 3: Bitrix24 CRM Contact creation failed: ${err.message}`);
  }

  logger.info('Integration test suite completed.');
}

runIntegrationTest().catch((err) => {
  logger.error(`Test Suite Error: ${err.message}`);
  process.exit(1);
});
