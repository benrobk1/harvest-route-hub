import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { CSVProductRow } from '@/lib/csvParser';

interface ValidationPreviewTableProps {
  rows: CSVProductRow[];
  errors: Array<{ row: number; field: string; error: string }>;
  onEditCell: (rowIndex: number, field: string, value: string) => void;
}

export function ValidationPreviewTable({ rows, errors, onEditCell }: ValidationPreviewTableProps) {
  const getErrorForCell = (rowIndex: number, field: string) => {
    return errors.find(e => e.row === rowIndex + 2 && e.field === field);
  };
  
  const hasRowError = (rowIndex: number) => {
    return errors.some(e => e.row === rowIndex + 2);
  };
  
  return (
    <div className="max-h-96 overflow-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead className="w-8"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow 
              key={rowIndex} 
              className={hasRowError(rowIndex) ? 'bg-destructive/10' : ''}
            >
              <TableCell className="font-medium">{rowIndex + 1}</TableCell>
              
              {/* Editable Name Cell */}
              <TableCell>
                <Input
                  value={row.name}
                  onChange={(e) => onEditCell(rowIndex, 'name', e.target.value)}
                  className={getErrorForCell(rowIndex, 'name') ? 'border-destructive' : ''}
                />
                {getErrorForCell(rowIndex, 'name') && (
                  <p className="text-xs text-destructive mt-1">
                    {getErrorForCell(rowIndex, 'name')?.error}
                  </p>
                )}
              </TableCell>
              
              {/* Editable Price Cell */}
              <TableCell>
                <Input
                  type="number"
                  step="0.01"
                  value={row.price}
                  onChange={(e) => onEditCell(rowIndex, 'price', e.target.value)}
                  className={getErrorForCell(rowIndex, 'price') ? 'border-destructive' : ''}
                />
                {getErrorForCell(rowIndex, 'price') && (
                  <p className="text-xs text-destructive mt-1">
                    {getErrorForCell(rowIndex, 'price')?.error}
                  </p>
                )}
              </TableCell>
              
              {/* Editable Unit Cell */}
              <TableCell>
                <Input
                  value={row.unit}
                  onChange={(e) => onEditCell(rowIndex, 'unit', e.target.value)}
                  className={getErrorForCell(rowIndex, 'unit') ? 'border-destructive' : ''}
                />
                {getErrorForCell(rowIndex, 'unit') && (
                  <p className="text-xs text-destructive mt-1">
                    {getErrorForCell(rowIndex, 'unit')?.error}
                  </p>
                )}
              </TableCell>
              
              {/* Editable Quantity Cell */}
              <TableCell>
                <Input
                  type="number"
                  value={row.available_quantity}
                  onChange={(e) => onEditCell(rowIndex, 'available_quantity', e.target.value)}
                  className={getErrorForCell(rowIndex, 'available_quantity') ? 'border-destructive' : ''}
                />
                {getErrorForCell(rowIndex, 'available_quantity') && (
                  <p className="text-xs text-destructive mt-1">
                    {getErrorForCell(rowIndex, 'available_quantity')?.error}
                  </p>
                )}
              </TableCell>
              
              <TableCell>
                {hasRowError(rowIndex) ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
