// Source of truth: data/ucp-capabilities.json
import raw from '@/data/ucp-capabilities.json';

export type UcpCapabilities = {
  merchant_id: string;
  capabilities: Record<string, boolean>;
  supported_currencies: string[];
  supported_countries: string[];
  notes?: string;
};

function assertString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid UCP capabilities: ${field} must be a non-empty string`);
  }
}

function assertStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`Invalid UCP capabilities: ${field} must be a string array`);
  }
}

function assertBooleanMap(value: unknown, field: string) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Invalid UCP capabilities: ${field} must be an object`);
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val !== 'boolean') {
      throw new Error(`Invalid UCP capabilities: ${field}.${key} must be boolean`);
    }
  }
}

export function loadUcpCapabilities(): UcpCapabilities {
  const data = raw as UcpCapabilities;
  assertString(data.merchant_id, 'merchant_id');
  assertBooleanMap(data.capabilities, 'capabilities');
  assertStringArray(data.supported_currencies, 'supported_currencies');
  assertStringArray(data.supported_countries, 'supported_countries');
  if (data.notes != null) {
    assertString(data.notes, 'notes');
  }
  return data;
}
