import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, CheckCircle2, Loader2, X } from 'lucide-react';
import { useEffect } from 'react';
import { getErrorMessage } from '@/lib/errors/getErrorMessage';

interface DocumentUploadProps {
  userId: string;
  documentType: 'driver_license' | 'insurance' | 'coi';
  currentUrl?: string;
  onUploadComplete?: () => void;
}

const DOCUMENT_LABELS = {
  driver_license: "Driver's License",
  insurance: 'Insurance Certificate',
  coi: 'Certificate of Insurance (COI)',
};

// Helper to extract storage path from URL or path string
const toStoragePath = (val: string | null): string | null => {
  if (!val) return null;
  if (val.includes('/documents/')) {
    const parts = val.split('/documents/');
    return parts[1] || null;
  }
  return val;
};

export const DocumentUpload = ({ userId, documentType, currentUrl, onUploadComplete }: DocumentUploadProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(toStoragePath(currentUrl || null));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select a file smaller than 10MB',
        variant: 'destructive',
      });
      return;
    }

    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(selectedFile.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or image file (JPG, PNG)',
        variant: 'destructive',
      });
      return;
    }

    setFile(selectedFile);
    
    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${documentType}_${Date.now()}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Store the path (not public URL) in the profile
      const updateField = `${documentType}_url`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: fileName })
        .eq('id', userId);

      if (updateError) throw updateError;

      toast({
        title: 'Document uploaded',
        description: 'Your document has been uploaded successfully',
      });

      setCurrentPath(fileName);
      setPreviewUrl(null); // Reset preview, will regenerate on next render
      onUploadComplete?.();
    } catch (error: unknown) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: getErrorMessage(error) || 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setFile(null);
    }
  };

  const handleRemove = async () => {
    if (!currentPath) return;

    try {
      // Delete from storage using the path
      const { error: deleteError } = await supabase.storage
        .from('documents')
        .remove([currentPath]);

      if (deleteError) throw deleteError;

      // Update profile
      const updateField = `${documentType}_url`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: null })
        .eq('id', userId);

      if (updateError) throw updateError;

      toast({
        title: 'Document removed',
        description: 'Your document has been removed',
      });

      setPreviewUrl(null);
      setCurrentPath(null);
      onUploadComplete?.();
    } catch (error: unknown) {
      console.error('Remove error:', error);
      toast({
        title: 'Failed to remove',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // Generate signed URL for preview when currentPath changes
  useEffect(() => {
    const loadPreview = async () => {
      if (!currentPath) {
        setPreviewUrl(null);
        return;
      }
      
      try {
        const { data, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(currentPath, 3600); // 1 hour
        
        if (error) throw error;
        setPreviewUrl(data?.signedUrl || null);
      } catch (error: unknown) {
        console.error('Error loading preview:', error);
      }
    };

    loadPreview();
  }, [currentPath]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {DOCUMENT_LABELS[documentType]}
          </span>
          {previewUrl && (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Uploaded
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Upload a clear photo or scan (PDF, JPG, or PNG, max 10MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {previewUrl ? (
          <div className="space-y-3">
            {previewUrl.endsWith('.pdf') ? (
              <div className="p-4 border rounded-lg bg-muted flex items-center gap-3">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1">
                  <p className="font-medium">PDF Document</p>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    View Document
                  </a>
                </div>
              </div>
            ) : (
              <img
                src={previewUrl}
                alt={DOCUMENT_LABELS[documentType]}
                className="w-full h-48 object-cover rounded-lg border"
              />
            )}
            <Button variant="destructive" onClick={handleRemove} className="w-full">
              <X className="mr-2 h-4 w-4" />
              Remove Document
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor={`file-${documentType}`}>Select File</Label>
              <Input
                id={`file-${documentType}`}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
            </div>

            {file && (
              <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
            )}

            {!file && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Select a file to upload
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
