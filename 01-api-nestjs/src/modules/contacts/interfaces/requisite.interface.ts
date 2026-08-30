/**
 * Interfaces representing raw Requisite and Bank Detail objects from Bitrix24.
 */
export interface BitrixRequisite {
  ID: string;
  ENTITY_TYPE_ID: string;
  ENTITY_ID: string;
  PRESET_ID: string;
  NAME: string;
  RQ_NAME?: string;
  RQ_INN?: string;
  ACTIVE?: string;
}

export interface BitrixBankDetail {
  ID: string;
  ENTITY_ID: string; // Refers to the parent Requisite ID
  NAME: string;
  RQ_BANK_NAME: string;
  RQ_ACC_NUM: string;
  RQ_BIK?: string;
  RQ_ACC_CURRENCY?: string;
  ACTIVE?: string;
}
