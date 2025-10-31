import { describe, it, expect } from 'vitest';
import { calculateEstimatedExpenses } from '../driverEarningsHelpers';

describe('calculateEstimatedExpenses', () => {
  it('calculates fuel costs accurately with provided distance', () => {
    const expenses = calculateEstimatedExpenses(10, 30); // 10 stops, 30 miles
    // 30 miles / 20 MPG * $3.50 = $5.25
    expect(expenses.fuel).toBe(5.25);
    expect(expenses.tolls).toBe(5.00); // 10 stops > 5
    expect(expenses.total).toBe(10.25);
  });

  it('uses default distance calculation when not provided', () => {
    const expenses = calculateEstimatedExpenses(8); // No distance provided
    // 8 stops * 3mi/stop = 24 miles
    // 24 / 20 MPG * $3.50 = $4.20
    expect(expenses.fuel).toBe(4.20);
    expect(expenses.tolls).toBe(5.00);
    expect(expenses.total).toBe(9.20);
  });

  it('adds tolls for routes > 5 stops', () => {
    const expenses = calculateEstimatedExpenses(8, 24);
    expect(expenses.tolls).toBe(5.00);
  });

  it('no tolls for small routes (<= 5 stops)', () => {
    const expenses = calculateEstimatedExpenses(3, 9);
    expect(expenses.tolls).toBe(0);
    // 9 miles / 20 MPG * $3.50 = $1.575 → $1.58
    expect(expenses.fuel).toBe(1.58);
    expect(expenses.total).toBe(1.58); // Fuel only
  });

  it('handles single delivery', () => {
    const expenses = calculateEstimatedExpenses(1, 3);
    // 3mi / 20 * 3.50 = $0.525 → $0.53
    expect(expenses.fuel).toBe(0.53);
    expect(expenses.tolls).toBe(0);
    expect(expenses.total).toBe(0.53);
  });

  it('handles boundary case at 5 stops', () => {
    const expenses5 = calculateEstimatedExpenses(5, 15);
    expect(expenses5.tolls).toBe(0); // Exactly 5 stops, no tolls
    
    const expenses6 = calculateEstimatedExpenses(6, 18);
    expect(expenses6.tolls).toBe(5.00); // 6 stops, tolls apply
  });

  it('handles zero distance edge case', () => {
    const expenses = calculateEstimatedExpenses(5, 0);
    expect(expenses.fuel).toBe(0);
    expect(expenses.tolls).toBe(0);
    expect(expenses.total).toBe(0);
  });

  it('calculates expenses for large routes', () => {
    const expenses = calculateEstimatedExpenses(20, 60);
    // 60 miles / 20 MPG * $3.50 = $10.50
    expect(expenses.fuel).toBe(10.50);
    expect(expenses.tolls).toBe(5.00);
    expect(expenses.total).toBe(15.50);
  });

  it('verifies fuel cost formula accuracy', () => {
    // Test formula: (miles / MPG) * gasPrice
    const testCases = [
      { miles: 20, expected: 3.50 },  // 20/20 * 3.50
      { miles: 40, expected: 7.00 },  // 40/20 * 3.50
      { miles: 10, expected: 1.75 },  // 10/20 * 3.50
    ];

    testCases.forEach(({ miles, expected }) => {
      const expenses = calculateEstimatedExpenses(1, miles); // 1 stop to avoid tolls
      expect(expenses.fuel).toBe(expected);
    });
  });
});
