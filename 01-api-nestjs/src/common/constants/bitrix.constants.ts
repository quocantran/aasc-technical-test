/**
 * Standard configuration constants, RPC method names, and entity IDs for Bitrix24 REST API.
 */
export const BITRIX_CONSTANTS = {
  // Parent CRM entity type identifiers (Owner Type ID)
  OWNER_TYPE: {
    LEAD: 1, // ENTITY_TYPE_ID = 1 for Lead
    DEAL: 2, // ENTITY_TYPE_ID = 2 for Deal
    CONTACT: 3, // ENTITY_TYPE_ID = 3 for Contact
    COMPANY: 4, // ENTITY_TYPE_ID = 4 for Company
    REQUISITE: 8, // ENTITY_TYPE_ID = 8 for Requisite
  },

  // Default requisite template identifiers (Preset ID)
  PRESET: {
    ORGANIZATION: 1, // Organization template
    PERSON: 2, // Individual / Person template
  },

  // Bitrix24 OAuth authorization server endpoints and grant types
  OAUTH: {
    TOKEN_ENDPOINT: 'https://oauth.bitrix.info/oauth/token/',
    GRANT_TYPE_REFRESH: 'refresh_token',
    GRANT_TYPE_AUTH_CODE: 'authorization_code',
  },

  // Multi-field value types for phone, email, web, and IM
  VALUE_TYPE: {
    WORK: 'WORK',
    MOBILE: 'MOBILE',
    HOME: 'HOME',
    OTHER: 'OTHER',
    MAILING: 'MAILING',
    FAX: 'FAX',
    PAGER: 'PAGER',
  },

  // Centralized Bitrix24 REST API Method Registry (Eliminates Magic Strings)
  METHODS: {
    // CRM Contact Methods
    CONTACT: {
      ADD: 'crm.contact.add',
      GET: 'crm.contact.get',
      LIST: 'crm.contact.list',
      UPDATE: 'crm.contact.update',
      DELETE: 'crm.contact.delete',
      FIELDS: 'crm.contact.fields',
    },
    // CRM Contact Company Association Methods
    CONTACT_COMPANY: {
      ADD: 'crm.contact.company.add',
      DELETE: 'crm.contact.company.delete',
      ITEMS_GET: 'crm.contact.company.items.get',
      ITEMS_SET: 'crm.contact.company.items.set',
      ITEMS_DELETE: 'crm.contact.company.items.delete',
      FIELDS: 'crm.contact.company.fields',
    },
    // CRM Requisite Methods (Universal Legal Information)
    REQUISITE: {
      ADD: 'crm.requisite.add',
      GET: 'crm.requisite.get',
      LIST: 'crm.requisite.list',
      UPDATE: 'crm.requisite.update',
      DELETE: 'crm.requisite.delete',
      FIELDS: 'crm.requisite.fields',
    },
    // CRM Bank Detail Methods (Banking Account Details)
    BANK_DETAIL: {
      ADD: 'crm.requisite.bankdetail.add',
      GET: 'crm.requisite.bankdetail.get',
      LIST: 'crm.requisite.bankdetail.list',
      UPDATE: 'crm.requisite.bankdetail.update',
      DELETE: 'crm.requisite.bankdetail.delete',
      FIELDS: 'crm.requisite.bankdetail.fields',
    },
    // CRM Address Methods (Requisite Addresses)
    ADDRESS: {
      ADD: 'crm.address.add',
      GET: 'crm.address.get',
      LIST: 'crm.address.list',
      UPDATE: 'crm.address.update',
      DELETE: 'crm.address.delete',
      FIELDS: 'crm.address.fields',
    },
    // CRM Preset Methods (Requisite Templates)
    PRESET: {
      LIST: 'crm.requisite.preset.list',
      GET: 'crm.requisite.preset.get',
      COUNTRIES: 'crm.requisite.preset.countries',
      FIELDS: 'crm.requisite.preset.fields',
    },
    // CRM Requisite Link Methods
    REQUISITE_LINK: {
      REGISTER: 'crm.requisite.link.register',
      GET: 'crm.requisite.link.get',
      LIST: 'crm.requisite.link.list',
      UNREGISTER: 'crm.requisite.link.unregister',
      FIELDS: 'crm.requisite.link.fields',
    },
    // Core & Batch Methods
    APP_INFO: 'app.info',
    BATCH: 'batch',
  },
} as const;

/**
 * Union type representing all valid Bitrix24 method strings registered in BITRIX_CONSTANTS.METHODS.
 */
export type BitrixMethod =
  | (typeof BITRIX_CONSTANTS.METHODS.CONTACT)[keyof typeof BITRIX_CONSTANTS.METHODS.CONTACT]
  | (typeof BITRIX_CONSTANTS.METHODS.CONTACT_COMPANY)[keyof typeof BITRIX_CONSTANTS.METHODS.CONTACT_COMPANY]
  | (typeof BITRIX_CONSTANTS.METHODS.REQUISITE)[keyof typeof BITRIX_CONSTANTS.METHODS.REQUISITE]
  | (typeof BITRIX_CONSTANTS.METHODS.BANK_DETAIL)[keyof typeof BITRIX_CONSTANTS.METHODS.BANK_DETAIL]
  | (typeof BITRIX_CONSTANTS.METHODS.ADDRESS)[keyof typeof BITRIX_CONSTANTS.METHODS.ADDRESS]
  | (typeof BITRIX_CONSTANTS.METHODS.PRESET)[keyof typeof BITRIX_CONSTANTS.METHODS.PRESET]
  | (typeof BITRIX_CONSTANTS.METHODS.REQUISITE_LINK)[keyof typeof BITRIX_CONSTANTS.METHODS.REQUISITE_LINK]
  | typeof BITRIX_CONSTANTS.METHODS.APP_INFO
  | typeof BITRIX_CONSTANTS.METHODS.BATCH;
