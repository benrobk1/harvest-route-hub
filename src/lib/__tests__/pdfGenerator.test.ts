import { describe, it, expect, vi } from 'vitest';
import { generateRouteManifestPDF, RouteManifestData } from '../pdfGenerator';

// Mock jsPDF
vi.mock('jspdf', () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    setDrawColor: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    rect: vi.fn(),
    setFillColor: vi.fn(),
    splitTextToSize: vi.fn((text) => [text]),
    save: vi.fn(),
  })),
}));

describe('generateRouteManifestPDF', () => {
  const mockData: RouteManifestData = {
    batchNumber: 'B-001',
    deliveryDate: '2024-01-15',
    driverName: 'John Driver',
    totalStops: 2,
    stops: [
      {
        sequence: 1,
        customerName: 'Alice Consumer',
        address: '123 Main St, New York, NY 10001',
        phone: '555-0100',
        boxCode: 'B1-1',
        items: [
          { name: 'Tomatoes', quantity: 2, unit: 'lb' },
          { name: 'Carrots', quantity: 1, unit: 'bunch' },
        ],
        notes: 'Leave at door',
        estimatedArrival: '2024-01-15T09:00:00Z',
      },
      {
        sequence: 2,
        customerName: 'Bob Consumer',
        address: '456 Oak Ave, New York, NY 10002',
        phone: '555-0200',
        boxCode: 'B1-2',
        items: [
          { name: 'Mixed Greens', quantity: 1, unit: 'lb' },
        ],
        notes: null,
        estimatedArrival: '2024-01-15T09:30:00Z',
      },
    ],
  };

  it('generates PDF without errors', () => {
    expect(() => generateRouteManifestPDF(mockData)).not.toThrow();
  });

  it('includes all stop information', () => {
    const jsPDF = require('jspdf').default;
    generateRouteManifestPDF(mockData);
    
    const mockInstance = jsPDF.mock.results[0].value;
    const textCalls = mockInstance.text.mock.calls;
    
    // Check that customer names are included
    expect(textCalls.some((call: any[]) => 
      call[0]?.includes('Alice Consumer')
    )).toBe(true);
    
    expect(textCalls.some((call: any[]) => 
      call[0]?.includes('Bob Consumer')
    )).toBe(true);
  });

  it('includes batch metadata', () => {
    const jsPDF = require('jspdf').default;
    generateRouteManifestPDF(mockData);
    
    const mockInstance = jsPDF.mock.results[0].value;
    const textCalls = mockInstance.text.mock.calls;
    
    expect(textCalls.some((call: any[]) => call[0]?.includes('B-001'))).toBe(true);
    expect(textCalls.some((call: any[]) => call[0]?.includes('John Driver'))).toBe(true);
  });

  it('calls save with correct filename', () => {
    const jsPDF = require('jspdf').default;
    generateRouteManifestPDF(mockData);
    
    const mockInstance = jsPDF.mock.results[0].value;
    expect(mockInstance.save).toHaveBeenCalledWith('route-manifest-batch-B-001.pdf');
  });

  it('handles stops without notes', () => {
    expect(() => generateRouteManifestPDF(mockData)).not.toThrow();
  });

  it('handles stops without phone numbers', () => {
    const dataWithoutPhone = {
      ...mockData,
      stops: mockData.stops.map(stop => ({ ...stop, phone: null })),
    };
    
    expect(() => generateRouteManifestPDF(dataWithoutPhone)).not.toThrow();
  });
});
