import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/supabase/functions/**/__tests__/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/types',
        'dist/',
        'e2e/',
        'scripts/',
        // Auto-generated files
        'src/integrations/supabase/types.ts',
        'src/integrations/supabase/client.ts',
        // Config files
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/App.tsx',
        // UI component library (tested via integration)
        'src/components/ui/**',
      ],
      include: [
        'src/**/*.{ts,tsx}',
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
      thresholds: {
        autoUpdate: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
