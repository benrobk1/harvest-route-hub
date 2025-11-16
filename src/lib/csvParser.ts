import * as XLSX from 'xlsx';

export interface CSVProductRow {
  id?: string;
  name: string;
  description?: string;
  price: string;
  unit: string;
  available_quantity: string;
  image_url?: string;
}

export interface ExportableProductRow {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  unit: string;
  available_quantity: number;
  image_url?: string | null;
}

export interface CSVParseResult {
  valid: CSVProductRow[];
  errors: Array<{ row: number; field: string; error: string }>;
}

export async function parseProductFile(file: File, mode: 'create' | 'update' = 'create'): Promise<CSVParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        
        // Detect file type and parse
        if (file.name.endsWith('.csv')) {
          resolve(parseProductCSV(data as string, mode));
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const csvString = XLSX.utils.sheet_to_csv(firstSheet);
          resolve(parseProductCSV(csvString, mode));
        } else {
          reject(new Error('Unsupported file type'));
        }
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

export function parseProductCSV(fileContent: string, mode: 'create' | 'update' = 'create'): CSVParseResult {
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    return { 
      valid: [], 
      errors: [{ row: 0, field: 'file', error: 'CSV file is empty or missing header' }] 
    };
  }

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  let requiredFields = ['name', 'price', 'unit', 'available_quantity'];
  
  // If update mode, require id column
  if (mode === 'update') {
    requiredFields = ['id', ...requiredFields];
  }
  
  // Validate header
  const missingFields = requiredFields.filter(f => !header.includes(f));
  if (missingFields.length > 0) {
    return { 
      valid: [], 
      errors: [{ 
        row: 0, 
        field: 'header', 
        error: `Missing required columns: ${missingFields.join(', ')}` 
      }] 
    };
  }

  const valid: CSVProductRow[] = [];
  const errors: Array<{ row: number; field: string; error: string }> = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: Record<string, string> = {};

    // Map values to fields
    header.forEach((field, index) => {
      row[field] = values[index] || '';
    });

    // Validate required fields
    let hasError = false;
    
    if (!row.name) {
      errors.push({ row: i + 1, field: 'name', error: 'Product name is required' });
      hasError = true;
    }
    
    if (!row.price || isNaN(parseFloat(row.price))) {
      errors.push({ row: i + 1, field: 'price', error: 'Valid price is required' });
      hasError = true;
    }
    
    if (!row.unit) {
      errors.push({ row: i + 1, field: 'unit', error: 'Unit is required' });
      hasError = true;
    }
    
    if (!row.available_quantity || isNaN(parseInt(row.available_quantity))) {
      errors.push({ row: i + 1, field: 'available_quantity', error: 'Valid quantity is required' });
      hasError = true;
    }

    // Validate optional image URL
    if (row.image_url && !isValidUrl(row.image_url)) {
      errors.push({ row: i + 1, field: 'image_url', error: 'Invalid image URL format' });
      hasError = true;
    }

    // Validate ID if update mode
    if (mode === 'update' && row.id) {
      // Basic UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(row.id)) {
        errors.push({ row: i + 1, field: 'id', error: 'Invalid product ID format' });
        hasError = true;
      }
    }

    if (!hasError) {
      valid.push({
        id: row.id || undefined,
        name: row.name,
        description: row.description || '',
        price: row.price,
        unit: row.unit,
        available_quantity: row.available_quantity,
        image_url: row.image_url || '',
      });
    }
  }

  return { valid, errors };
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

// Export products to CSV
export function generateCSVFromProducts(products: ExportableProductRow[]): string {
  const header = 'id,name,description,price,unit,available_quantity,image_url';
  const rows = products.map(p =>
    `${p.id},"${p.name}","${p.description || ''}",${p.price},${p.unit},${p.available_quantity},${p.image_url || ''}`
  );
  
  return [header, ...rows].join('\n');
}

// CSV Template Generator
export function generateCSVTemplate(): string {
  const header = 'name,description,price,unit,available_quantity,image_url';
  const example1 = 'Organic Tomatoes,Fresh heirloom tomatoes,4.99,lb,50,https://example.com/tomatoes.jpg';
  const example2 = 'Baby Carrots,Sweet baby carrots,3.49,lb,30,';
  const example3 = 'Mixed Greens,Organic salad mix,5.99,bunch,20,';
  
  return [header, example1, example2, example3].join('\n');
}

// Excel Template Generator
export function generateExcelTemplate(): Blob {
  const data = [
    ['name', 'description', 'price', 'unit', 'available_quantity', 'image_url'],
    ['Organic Tomatoes', 'Fresh heirloom tomatoes', 4.99, 'lb', 50, 'https://example.com/tomatoes.jpg'],
    ['Baby Carrots', 'Sweet baby carrots', 3.49, 'lb', 30, ''],
    ['Mixed Greens', 'Organic salad mix', 5.99, 'bunch', 20, ''],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
  
  // Convert binary string to Blob
  const buf = new ArrayBuffer(wbout.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < wbout.length; i++) {
    view[i] = wbout.charCodeAt(i) & 0xFF;
  }
  
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
