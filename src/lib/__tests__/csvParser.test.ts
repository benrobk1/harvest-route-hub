import { describe, it, expect } from 'vitest';
import { parseProductCSV, generateCSVFromProducts, generateCSVTemplate } from '../csvParser';

describe('parseProductCSV', () => {
  it('parses valid CSV data in create mode', () => {
    const csv = `name,description,price,unit,available_quantity,image_url
Tomatoes,Fresh tomatoes,4.99,lb,50,https://example.com/tomatoes.jpg
Carrots,Sweet carrots,3.49,lb,30,`;

    const result = parseProductCSV(csv, 'create');
    
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toHaveLength(2);
    expect(result.valid[0].name).toBe('Tomatoes');
    expect(result.valid[0].price).toBe('4.99');
  });

  it('validates required fields', () => {
    const csv = `name,description,price,unit,available_quantity
,Fresh tomatoes,4.99,lb,50
Carrots,,invalid,lb,30`;

    const result = parseProductCSV(csv, 'create');
    
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.field === 'name')).toBe(true);
    expect(result.errors.some(e => e.field === 'price')).toBe(true);
  });

  it('validates numeric fields', () => {
    const csv = `name,description,price,unit,available_quantity
Tomatoes,Fresh,abc,lb,50
Carrots,Sweet,4.99,lb,invalid`;

    const result = parseProductCSV(csv, 'create');
    
    expect(result.errors.some(e => e.field === 'price' && e.row === 2)).toBe(true);
    expect(result.errors.some(e => e.field === 'available_quantity' && e.row === 3)).toBe(true);
  });

  it('validates image URLs', () => {
    const csv = `name,description,price,unit,available_quantity,image_url
Tomatoes,Fresh,4.99,lb,50,not-a-valid-url`;

    const result = parseProductCSV(csv, 'create');
    
    expect(result.errors.some(e => e.field === 'image_url')).toBe(true);
  });

  it('requires ID column in update mode', () => {
    const csv = `name,price,unit,available_quantity
Tomatoes,4.99,lb,50`;

    const result = parseProductCSV(csv, 'update');
    
    expect(result.errors.some(e => e.field === 'header')).toBe(true);
  });

  it('validates UUID format in update mode', () => {
    const csv = `id,name,price,unit,available_quantity
not-a-uuid,Tomatoes,4.99,lb,50
550e8400-e29b-41d4-a716-446655440000,Carrots,3.49,lb,30`;

    const result = parseProductCSV(csv, 'update');
    
    expect(result.errors.some(e => e.field === 'id' && e.row === 2)).toBe(true);
    expect(result.valid).toHaveLength(1);
  });

  it('handles empty CSV', () => {
    const result = parseProductCSV('', 'create');
    expect(result.errors).toHaveLength(1);
    expect(result.valid).toHaveLength(0);
  });
});

describe('generateCSVFromProducts', () => {
  it('generates valid CSV from products', () => {
    const products = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Tomatoes',
        description: 'Fresh tomatoes',
        price: 4.99,
        unit: 'lb',
        available_quantity: 50,
        image_url: 'https://example.com/tomatoes.jpg',
      },
    ];

    const csv = generateCSVFromProducts(products);
    
    expect(csv).toContain('id,name,description,price,unit,available_quantity,image_url');
    expect(csv).toContain('Tomatoes');
    expect(csv).toContain('4.99');
  });

  it('handles products without optional fields', () => {
    const products = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Tomatoes',
        price: 4.99,
        unit: 'lb',
        available_quantity: 50,
      },
    ];

    const csv = generateCSVFromProducts(products);
    expect(csv).toContain('Tomatoes');
  });
});

describe('generateCSVTemplate', () => {
  it('generates template with header and examples', () => {
    const template = generateCSVTemplate();
    
    expect(template).toContain('name,description,price,unit,available_quantity,image_url');
    expect(template).toContain('Organic Tomatoes');
    expect(template.split('\n').length).toBe(4); // Header + 3 examples
  });
});
