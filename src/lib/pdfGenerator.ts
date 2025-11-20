import jsPDF from 'jspdf';
import { format } from 'date-fns';

export interface RouteManifestData {
  batchNumber: string;
  deliveryDate: string;
  driverName: string;
  totalStops: number;
  stops: Array<{
    sequence: number;
    customerName: string;
    address: string;
    phone: string | null;
    boxCode: string | null;
    items: Array<{
      name: string;
      quantity: number;
      unit: string;
    }>;
    notes: string | null;
    estimatedArrival: string | null;
  }>;
}

export function generateRouteManifestPDF(data: RouteManifestData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper: Add text with word wrap
  const addText = (text: string, fontSize: number, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = doc.splitTextToSize(text, contentWidth);
    lines.forEach((line: string) => {
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.4;
    });
  };

  const addSpace = (height: number = 5) => {
    yPosition += height;
  };

  const addLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 3;
  };

  // Header
  addText('BLUE HARVESTS', 16, true);
  addText('Route Manifest', 14, true);
  addSpace(3);
  addLine();
  addSpace(3);

  // Batch Info
  doc.setFontSize(10);
  doc.text(`Batch #: ${data.batchNumber}`, margin, yPosition);
  doc.text(`Driver: ${data.driverName}`, pageWidth / 2, yPosition);
  yPosition += 5;
  doc.text(`Date: ${data.deliveryDate}`, margin, yPosition);
  doc.text(`Total Stops: ${data.totalStops}`, pageWidth / 2, yPosition);
  yPosition += 8;
  addLine();
  addSpace(5);

  // Delivery Instructions
  addText('DELIVERY INSTRUCTIONS:', 11, true);
  addSpace(2);
  addText('□ Verify box code matches customer', 9);
  addText('□ Confirm items with customer', 9);
  addText('□ Mark checkbox when delivered', 9);
  addText('□ Note issues or customer feedback', 9);
  addSpace(8);
  addLine();
  addSpace(5);

  // Stops
  data.stops.forEach((stop, index) => {
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = margin;
    }

    // Stop Header
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPosition - 5, contentWidth, 10, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`□ Stop ${stop.sequence}`, margin + 2, yPosition);
    
    if (stop.boxCode) {
      doc.text(`Box: ${stop.boxCode}`, pageWidth - margin - 30, yPosition);
    }
    
    yPosition += 8;

    // Customer Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(stop.customerName, margin + 5, yPosition);
    yPosition += 5;
    
    doc.setFont('helvetica', 'normal');
    doc.text(stop.address, margin + 5, yPosition);
    yPosition += 5;
    
    if (stop.phone) {
      doc.text(`Phone: ${stop.phone}`, margin + 5, yPosition);
      yPosition += 5;
    }
    
    if (stop.estimatedArrival) {
      doc.text(`ETA: ${stop.estimatedArrival}`, margin + 5, yPosition);
      yPosition += 5;
    }

    // Items
    if (stop.items.length > 0) {
      yPosition += 2;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Items:', margin + 5, yPosition);
      yPosition += 4;
      
      doc.setFont('helvetica', 'normal');
      stop.items.forEach((item) => {
        const itemText = `• ${item.quantity} ${item.unit} ${item.name}`;
        doc.text(itemText, margin + 8, yPosition);
        yPosition += 4;
      });
    }

    // Notes
    if (stop.notes) {
      yPosition += 2;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      const noteLines = doc.splitTextToSize(`Note: ${stop.notes}`, contentWidth - 10);
      noteLines.forEach((line: string) => {
        doc.text(line, margin + 5, yPosition);
        yPosition += 4;
      });
    }

    // Delivery signature box
    yPosition += 3;
    doc.setDrawColor(150, 150, 150);
    doc.setFontSize(8);
    doc.text('Customer Signature:', margin + 5, yPosition);
    yPosition += 2;
    doc.line(margin + 35, yPosition, pageWidth - margin - 5, yPosition);
    yPosition += 8;

    // Separator
    if (index < data.stops.length - 1) {
      addLine();
      yPosition += 3;
    }
  });

  // Footer on last page
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
    margin,
    pageHeight - 10
  );
  doc.text(
    'Blue Harvests - Farm to Table Delivery',
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // Save PDF
  const filename = `route-manifest-batch-${data.batchNumber}.pdf`;
  doc.save(filename);
}
