import { loadUcpCapabilities } from './ucp-loader';

export function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const entries = keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildUcpJsonLd() {
  const data = loadUcpCapabilities();
  const jsonLd: Record<string, any> = {
    '@context': {
      '@vocab': 'https://schema.org/',
      ucp: 'https://example.com/ucp#'
    },
    '@type': 'Organization',
    identifier: data.merchant_id,
    areaServed: data.supported_countries,
    currenciesAccepted: data.supported_currencies,
    'ucp:capabilities': data.capabilities
  };

  if (data.notes) {
    jsonLd.description = data.notes;
  }

  return jsonLd;
}
