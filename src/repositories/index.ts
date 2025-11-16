/**
 * REPOSITORY EXPORTS
 * Central export point for all repository interfaces and factories
 */

// Interfaces
export type { IProductRepository } from './interfaces/IProductRepository';
export type { ICartRepository } from './interfaces/ICartRepository';
export type { IOrderRepository } from './interfaces/IOrderRepository';

// Factory
export {
  getProductRepository,
  getCartRepository,
  getOrderRepository,
  resetRepositories,
} from './factory';
