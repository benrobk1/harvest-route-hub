export interface StructuredAddress {
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
}

export const formatFullAddress = (addr: StructuredAddress): string => {
  const parts = [
    addr.street_address,
    addr.city,
    `${addr.state} ${addr.zip_code}`
  ].filter(Boolean);
  
  return parts.join(', ');
};

export const formatShortAddress = (addr: StructuredAddress): string => {
  return `${addr.city}, ${addr.state} ${addr.zip_code}`;
};

export const parseAddress = (fullAddress: string): Partial<StructuredAddress> => {
  if (!fullAddress) return {};
  
  // Basic parsing for migration: "123 Main St, Springfield, IL 62701"
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length < 2) {
    return { street_address: fullAddress };
  }
  
  const lastPart = parts[parts.length - 1];
  const stateZipMatch = lastPart.match(/([A-Z]{2})\s+(\d{5})/);
  
  return {
    street_address: parts[0] || '',
    city: parts[1] || '',
    state: stateZipMatch ? stateZipMatch[1] : '',
    zip_code: stateZipMatch ? stateZipMatch[2] : '',
  };
};
