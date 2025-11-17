import { supabase } from '@/integrations/supabase/client';
import { getErrorMessage } from '@/lib/errors/getErrorMessage';

export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Fetches image from URL and uploads to Supabase storage
 * Returns the new storage URL or error
 */
export async function uploadImageFromUrl(
  imageUrl: string,
  farmProfileId: string,
  productName: string
): Promise<ImageUploadResult> {
  try {
    // Validate URL
    const url = new URL(imageUrl);
    
    // Fetch image from URL
    const response = await fetch(url.toString(), { mode: 'cors' });
    
    if (!response.ok) {
      return { success: false, error: `Failed to fetch image: ${response.statusText}` };
    }
    
    const blob = await response.blob();
    
    // Check file size (max 5MB)
    if (blob.size > 5 * 1024 * 1024) {
      return { success: false, error: 'Image too large (max 5MB)' };
    }
    
    // Check file type
    if (!blob.type.startsWith('image/')) {
      return { success: false, error: 'Not a valid image file' };
    }
    
    // Generate unique filename
    const fileExt = blob.type.split('/')[1];
    const fileName = `${farmProfileId}/${productName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.${fileExt}`;
    
    // Upload to Supabase storage (product-images bucket)
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);
    
    return { success: true, url: urlData.publicUrl };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error) };
  }
}
