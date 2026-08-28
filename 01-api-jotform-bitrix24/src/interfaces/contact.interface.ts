// Canonical data model used across internal application layers
export interface ContactData {
  fullName: string;
  phone: string;
  email: string;
  submissionId?: string;
  formId?: string;
}

// Multi-field item structure required by Bitrix24 REST API
export interface Bitrix24MultiField {
  VALUE: string;
  VALUE_TYPE: 'WORK' | 'HOME' | 'MOBILE' | 'OTHER';
}

// Request payload structure for Bitrix24 crm.contact.add method
export interface Bitrix24CreateContactPayload {
  fields: {
    NAME: string;
    PHONE: Bitrix24MultiField[];
    EMAIL: Bitrix24MultiField[];
    COMMENTS?: string;
    OPENED?: 'Y' | 'N';
    TYPE_ID?: string;
    SOURCE_ID?: string;
  };
  params?: {
    REGISTER_SONET_EVENT?: 'Y' | 'N';
  };
}

// Response structure returned by Bitrix24 REST API
export interface Bitrix24ApiResponse<T = number> {
  result?: T;
  error?: string;
  error_description?: string;
  time?: {
    start: number;
    finish: number;
    duration: number;
  };
}

// Single answer object returned in Jotform submission response
export interface JotformAnswer {
  name?: string;
  text?: string;
  type?: string;
  answer?: any;
  prettyFormat?: string;
}

// Response structure returned by Jotform GET /submission/{id} API
export interface JotformSubmissionApiResponse {
  responseCode: number;
  message: string;
  content: {
    id: string;
    form_id: string;
    ip: string;
    created_at: string;
    status: string;
    answers: Record<string, JotformAnswer>;
  };
}
