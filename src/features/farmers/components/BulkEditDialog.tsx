import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { useErrorHandler } from '@/lib/errors/useErrorHandler';
import { createInvalidFileError, createCSVImportError } from '@/features/farmers/errors';
import { supabase } from '@/integrations/supabase/client';
import {
  parseProductFile,
  generateCSVTemplate,
  generateExcelTemplate,
  generateCSVFromProducts,
  CSVProductRow,
  ExportableProductRow,
} from '@/lib/csvParser';
import { uploadImageFromUrl } from '@/lib/imageUploader';
import { ValidationPreviewTable } from './ValidationPreviewTable';
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';
import { getErrorMessage } from '@/lib/errors/getErrorMessage';
import type { Database } from '@/integrations/supabase/types';

interface BulkEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmProfileId: string;
  products: Database['public']['Tables']['products']['Row'][];
  onComplete: () => void;
}

export function BulkEditDialog({ open, onOpenChange, farmProfileId, products, onComplete }: BulkEditDialogProps) {
  const { handleError, handleValidationError } = useErrorHandler();
  const [mode, setMode] = useState<'create' | 'update'>('create');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVProductRow[] | null>(null);
  const [editablePreview, setEditablePreview] = useState<CSVProductRow[]>([]);
  const [errors, setErrors] = useState<Array<{ row: number; field: string; error: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (preview) {
      setEditablePreview([...preview]);
    }
  }, [preview]);

  const handleDownloadTemplate = (format: 'csv' | 'excel') => {
    if (format === 'csv') {
      const template = generateCSVTemplate();
      const blob = new Blob([template], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const blob = generateExcelTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'product_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleExportCurrent = () => {
    const csv = generateCSVFromProducts(
      products.map((product): ExportableProductRow => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: Number(product.price),
        unit: product.unit,
        available_quantity: Number(product.available_quantity ?? 0),
        image_url: product.image_url,
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Current inventory exported' });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      handleValidationError(createInvalidFileError('Please upload a CSV or Excel file'));
      return;
    }

    setFile(selectedFile);
    try {
      const result = await parseProductFile(selectedFile, mode);
      setPreview(result.valid);
      setErrors(result.errors);
    } catch (error) {
      handleError(createCSVImportError(getErrorMessage(error) || 'Failed to parse file'));
    }
  };

  const handleCellEdit = (rowIndex: number, field: string, value: string) => {
    const updated = [...editablePreview];
    updated[rowIndex] = { ...updated[rowIndex], [field]: value };
    setEditablePreview(updated);
  };

  const handleImport = async () => {
    if (!editablePreview || editablePreview.length === 0) return;
    setImporting(true);
    setProgress(0);

    try {
      const total = editablePreview.length;
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < editablePreview.length; i += 5) {
        const batch = editablePreview.slice(i, i + 5);
        
        await Promise.all(batch.map(async (product) => {
          try {
            let finalImageUrl = product.image_url;
            
            if (product.image_url && product.image_url.trim()) {
              const uploadResult = await uploadImageFromUrl(product.image_url, farmProfileId, product.name);
              if (uploadResult.success) {
                finalImageUrl = uploadResult.url || product.image_url;
              }
            }
            
            if (mode === 'update' && product.id) {
              const { error } = await supabase.from('products').update({
                name: product.name,
                description: product.description || null,
                price: parseFloat(product.price),
                unit: product.unit,
                available_quantity: parseInt(product.available_quantity),
                image_url: finalImageUrl || null,
              }).eq('id', product.id).eq('farm_profile_id', farmProfileId);
              
              if (error) throw error;
            } else {
              const { error } = await supabase.from('products').insert({
                farm_profile_id: farmProfileId,
                name: product.name,
                description: product.description || null,
                price: parseFloat(product.price),
                unit: product.unit,
                available_quantity: parseInt(product.available_quantity),
                image_url: finalImageUrl || null,
              });
              
              if (error) throw error;
            }
            imported++;
          } catch (error) {
            failed++;
          }
        }));

        setProgress(Math.round(((i + batch.length) / total) * 100));
      }

      toast({ title: 'Import complete', description: `${imported} products ${mode === 'update' ? 'updated' : 'imported'}, ${failed} failed` });
      onComplete();
      onOpenChange(false);
      setFile(null);
      setPreview(null);
      setErrors([]);
    } catch (error) {
      handleError(createCSVImportError('Import failed. Please try again.'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Import/Edit Products</DialogTitle>
          <DialogDescription>Import new products or update existing ones via CSV/Excel</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as 'create' | 'update')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Add New Products</TabsTrigger>
            <TabsTrigger value="update">Update Existing</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleDownloadTemplate('csv')} className="flex-1">
                <Download className="h-4 w-4 mr-2" />CSV Template
              </Button>
              <Button variant="outline" onClick={() => handleDownloadTemplate('excel')} className="flex-1">
                <Download className="h-4 w-4 mr-2" />Excel Template
              </Button>
            </div>

            <div>
              <Label htmlFor="file-upload">Upload CSV/Excel</Label>
              <Input id="file-upload" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} />
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.length} error(s) found in file</AlertDescription>
              </Alert>
            )}

            {editablePreview && editablePreview.length > 0 && (
              <ValidationPreviewTable rows={editablePreview} errors={errors} onEditCell={handleCellEdit} />
            )}

            {importing && <Progress value={progress} />}
          </TabsContent>

          <TabsContent value="update" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Export your products, edit in Excel/CSV, then re-upload to update all at once</AlertDescription>
            </Alert>

            <Button onClick={handleExportCurrent} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />Export Current ({products.length} products)
            </Button>

            <div>
              <Label htmlFor="file-upload-update">Upload Modified CSV/Excel</Label>
              <Input id="file-upload-update" type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} />
            </div>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errors.length} error(s) found</AlertDescription>
              </Alert>
            )}

            {editablePreview && editablePreview.length > 0 && (
              <ValidationPreviewTable rows={editablePreview} errors={errors} onEditCell={handleCellEdit} />
            )}

            {importing && <Progress value={progress} />}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={!preview || preview.length === 0 || errors.length > 0 || importing}>
            {importing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing...</> : <><Upload className="mr-2 h-4 w-4" />{mode === 'update' ? 'Update' : 'Import'} ({editablePreview.length})</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
