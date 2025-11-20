import { vi } from 'vitest';

/**
 * Mock Stripe client for testing
 */
export const createMockStripeClient = () => ({
  paymentIntents: {
    create: vi.fn().mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret_456',
      status: 'requires_payment_method',
    }),
    confirm: vi.fn().mockResolvedValue({
      id: 'pi_test_123',
      status: 'succeeded',
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'pi_test_123',
      status: 'succeeded',
    }),
  },
  customers: {
    create: vi.fn().mockResolvedValue({
      id: 'cus_test_123',
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'cus_test_123',
    }),
  },
  subscriptions: {
    create: vi.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'active',
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'active',
    }),
    update: vi.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'active',
    }),
    cancel: vi.fn().mockResolvedValue({
      id: 'sub_test_123',
      status: 'canceled',
    }),
  },
  transfers: {
    create: vi.fn().mockResolvedValue({
      id: 'tr_test_123',
      amount: 1000,
      destination: 'acct_test_123',
    }),
  },
  accounts: {
    create: vi.fn().mockResolvedValue({
      id: 'acct_test_123',
    }),
    retrieve: vi.fn().mockResolvedValue({
      id: 'acct_test_123',
      charges_enabled: true,
      payouts_enabled: true,
    }),
  },
  accountLinks: {
    create: vi.fn().mockResolvedValue({
      url: 'https://connect.stripe.com/setup/test',
    }),
  },
  webhooks: {
      constructEvent: vi.fn().mockImplementation((_payload, _sig, _secret) => ({
      id: 'evt_test_123',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          status: 'succeeded',
        },
      },
    })),
  },
});

export type MockStripeClient = ReturnType<typeof createMockStripeClient>;
