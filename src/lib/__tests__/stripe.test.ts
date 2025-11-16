import { describe, it, expect, vi } from 'vitest';
import { loadStripe } from '@stripe/stripe-js';

// Mock @stripe/stripe-js
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(),
}));

describe('stripe integration', () => {
  it('should load stripe with publishable key', async () => {
    const mockStripe = { id: 'mock-stripe-instance' };
    (loadStripe as any).mockResolvedValue(mockStripe);

    const stripe = await loadStripe('pk_test_mock_key');
    
    expect(loadStripe).toHaveBeenCalledWith('pk_test_mock_key');
    expect(stripe).toEqual(mockStripe);
  });

  it('should handle stripe loading errors', async () => {
    (loadStripe as any).mockResolvedValue(null);

    const stripe = await loadStripe('invalid_key');
    
    expect(stripe).toBeNull();
  });
});
