import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface CartItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  products: {
    id: string;
    name: string;
    unit: string;
    image_url: string | null;
    available_quantity: number;
    farm_profiles: {
      farm_name: string;
    };
  };
}

export const useCart = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get or create cart
      const { data: existingCart, error: cartError } = await supabase
        .from('shopping_carts')
        .select('id')
        .eq('consumer_id', user.id)
        .maybeSingle();

      if (cartError) throw cartError;

      let cartId = existingCart?.id;

      if (!cartId) {
        const { data: newCart, error: createError } = await supabase
          .from('shopping_carts')
          .insert({ consumer_id: user.id })
          .select('id')
          .single();

        if (createError) throw createError;
        cartId = newCart.id;
      }

      // Get cart items
      const { data: items, error: itemsError } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          products (
            id,
            name,
            unit,
            image_url,
            available_quantity,
            farm_profiles (
              farm_name
            )
          )
        `)
        .eq('cart_id', cartId);

      if (itemsError) throw itemsError;

      return {
        id: cartId,
        items: items as unknown as CartItem[],
      };
    },
    enabled: !!user,
  });

  const addToCart = useMutation({
    mutationFn: async ({ productId, quantity, unitPrice }: { productId: string; quantity: number; unitPrice: number }) => {
      if (!user || !cart) throw new Error('Not authenticated');

      // Check if item already exists
      const existingItem = cart.items?.find((item) => item.product_id === productId);

      if (existingItem) {
        // Update quantity
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + quantity })
          .eq('id', existingItem.id);

        if (error) throw error;
      } else {
        // Add new item
        const { error } = await supabase
          .from('cart_items')
          .insert({
            cart_id: cart.id,
            product_id: productId,
            quantity,
            unit_price: unitPrice,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', user?.id] });
      toast({
        title: 'Added to cart',
        description: 'Item added successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (quantity <= 0) {
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', itemId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity })
          .eq('id', itemId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', user?.id] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', user?.id] });
      toast({
        title: 'Removed from cart',
        description: 'Item removed successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const cartTotal = cart?.items?.reduce(
    (sum, item) => sum + item.quantity * Number(item.unit_price),
    0
  ) || 0;

  const cartCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return {
    cart,
    isLoading,
    addToCart,
    updateQuantity,
    removeItem,
    cartTotal,
    cartCount,
  };
};
