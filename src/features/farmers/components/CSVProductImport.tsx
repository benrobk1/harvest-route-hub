import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { parseProductCSV, generateCSVTemplate, type CSVProductRow } from '@/lib/csvParser';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CSVProductImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  farmProfileId: string;
  onImportComplete: () => void;
}

export function CSVProductImport({ open, onOpenChange, farmProfileId, onImportComplete }: CSVProductImportProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<CSVProductRow[] | null>(null);
  const [errors, setErrors] = useState<Array<{ row: number; field: string; error: string }>>([]);
  const [importProgress, setImportProgress] = useState(0);

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV file',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    setParsing(true);
    setErrors([]);
    setPreview(null);

    try {
      const content = await selectedFile.text();
      const result = parseProductCSV(content);
      
      setPreview(result.valid);
      setErrors(result.errors);
      
      if (result.valid.length === 0) {
        toast({
          title: 'No valid products found',
          description: 'Please fix the errors and try again',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Failed to parse CSV',
        description: 'Please check the file format',
        variant: 'destructive',
      });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;

    setImporting(true);
    setImportProgress(0);

    try {
      const totalProducts = preview.length;
      let imported = 0;
      let failed = 0;

      // Import products in batches of 5 to avoid overwhelming the database
      for (let i = 0; i < preview.length; i += 5) {
        const batch = preview.slice(i, i + 5);
        
        const promises = batch.map(async (product) => {
          try {
            const { error } = await supabase.from('products').insert({
              farm_profile_id: farmProfileId,
              name: product.name,
              description: product.description || null,
              price: parseFloat(product.price),
              unit: product.unit,
              available_quantity: parseInt(product.available_quantity),
              image_url: product.image_url || null,
            });
            
            if (error) throw error;
            imported++;
          } catch (error) {
            console.error('Failed to import product:', product.name, error);
            failed++;
          }
        });

        await Promise.all(promises);
        setImportProgress(Math.round(((i + batch.length) / totalProducts) * 100));
      }

      toast({
        title: 'Import completed',
        description: `Successfully imported ${imported} products${failed > 0 ? `, ${failed} failed` : ''}`,
      });

      onImportComplete();
      onOpenChange(false);
      
      // Reset state
      setFile(null);
      setPreview(null);
      setErrors([]);
      setImportProgress(0);
    } catch (error) {
      toast({
        title: 'Import failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Products from CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to add multiple products at once. Download the template to see the required format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template Button */}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleDownloadTemplate} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download CSV Template
            </Button>
            <Badge variant="secondary">Required: name, price, unit, quantity</Badge>
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
              disabled={importing}
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">
                {file ? file.name : 'Click to upload CSV file'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Maximum 100 products per import
              </p>
            </label>
          </div>

          {/* Parsing Loader */}
          {parsing && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Parsing CSV...</span>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Found {errors.length} error(s)</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside text-sm mt-2 max-h-40 overflow-y-auto">
                  {errors.slice(0, 10).map((error, idx) => (
                    <li key={idx}>
                      Row {error.row}, {error.field}: {error.error}
                    </li>
                  ))}
                  {errors.length > 10 && (
                    <li className="text-muted-foreground">...and {errors.length - 10} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview && preview.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle>Ready to import {preview.length} product(s)</AlertTitle>
              <AlertDescription>
                <div className="text-sm mt-2 max-h-40 overflow-y-auto">
                  <ul className="space-y-1">
                    {preview.slice(0, 5).map((product, idx) => (
                      <li key={idx} className="flex items-center justify-between">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-muted-foreground">${product.price}/{product.unit}</span>
                      </li>
                    ))}
                    {preview.length > 5 && (
                      <li className="text-muted-foreground text-xs">
                        ...and {preview.length - 5} more products
                      </li>
                    )}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Import Progress */}
          {importing && (
            <div className="space-y-2">
              <Progress value={importProgress} />
              <p className="text-sm text-center text-muted-foreground">
                Importing products... {importProgress}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!preview || preview.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import {preview?.length || 0} Products
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
