import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/helpers/renderWithProviders';
import OrderTracking from '../OrderTracking';

describe('OrderTracking', () => {
  const baseProps = {
    orderId: 'ORD-123',
    status: 'ordered' as const,
    items: '3 items',
    total: 45.50,
  };

  it('should render order ID', () => {
    renderWithProviders(<OrderTracking {...baseProps} />);

    expect(screen.getByText('Order ORD-123')).toBeDefined();
  });

  it('should render order status badge', () => {
    renderWithProviders(<OrderTracking {...baseProps} />);

    expect(screen.getByText('Order Placed')).toBeDefined();
  });

  it('should render items and total', () => {
    renderWithProviders(<OrderTracking {...baseProps} />);

    expect(screen.getByText('3 items')).toBeDefined();
    expect(screen.getByText('$45.50')).toBeDefined();
  });

  it('should render delivery address when provided', () => {
    renderWithProviders(
      <OrderTracking 
        {...baseProps} 
        deliveryAddress="123 Main St, New York, NY 10001"
      />
    );

    expect(screen.getByText('123 Main St, New York, NY 10001')).toBeDefined();
  });

  it('should render driver info when provided', () => {
    renderWithProviders(
      <OrderTracking 
        {...baseProps} 
        driverName="John Doe"
        driverPhone="555-0100"
      />
    );

    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText(/Call Driver: 555-0100/)).toBeDefined();
  });

  it('should render ETA when en route', () => {
    renderWithProviders(
      <OrderTracking 
        {...baseProps} 
        status="en_route"
        estimatedTime="15 min"
      />
    );

    expect(screen.getByText('ETA: 15 min')).toBeDefined();
  });

  it('should show correct status for farm_pickup', () => {
    renderWithProviders(<OrderTracking {...baseProps} status="farm_pickup" />);

    expect(screen.getByText('Farm Pickup')).toBeDefined();
  });

  it('should show correct status for en_route', () => {
    renderWithProviders(<OrderTracking {...baseProps} status="en_route" />);

    expect(screen.getByText('En Route')).toBeDefined();
  });

  it('should show correct status for delivered', () => {
    renderWithProviders(<OrderTracking {...baseProps} status="delivered" />);

    expect(screen.getByText('Delivered')).toBeDefined();
  });

  it('should render progress tracker', () => {
    renderWithProviders(<OrderTracking {...baseProps} />);

    expect(screen.getByText('Ordered')).toBeDefined();
    expect(screen.getByText('Pickup')).toBeDefined();
    expect(screen.getByText('En Route')).toBeDefined();
    expect(screen.getByText('Delivered')).toBeDefined();
  });

  it('should not show ETA when not en route', () => {
    renderWithProviders(
      <OrderTracking 
        {...baseProps} 
        status="ordered"
        estimatedTime="15 min"
      />
    );

    expect(screen.queryByText('ETA: 15 min')).toBeNull();
  });

  it('should not show driver info when not provided', () => {
    renderWithProviders(<OrderTracking {...baseProps} />);

    expect(screen.queryByText('John Doe')).toBeNull();
    expect(screen.queryByText(/Call Driver/)).toBeNull();
  });
});
