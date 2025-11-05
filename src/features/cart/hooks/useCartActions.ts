import { useState } from 'react';

export const useCartActions = () => {
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = async (
    addToCartFn: () => Promise<void>
  ) => {
    setIsAdding(true);
    await addToCartFn();
    setIsAdding(false);
    setJustAdded(true);
    setTimeout(() => {
      setJustAdded(false);
      setQuantity(1);
    }, 2000);
  };

  const incrementQuantity = (maxQuantity: number) => {
    if (quantity < maxQuantity) {
      setQuantity(prev => prev + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  return {
    isAdding,
    justAdded,
    quantity,
    setQuantity,
    handleAddToCart,
    incrementQuantity,
    decrementQuantity,
  };
};
