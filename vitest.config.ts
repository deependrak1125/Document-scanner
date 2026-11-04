import { defineConfig } from 'vitest/config';
import { createRequire } from 'node:module';
const mobile = createRequire(new URL('./apps/mobile/package.json',import.meta.url));
export default defineConfig({resolve:{alias:['react-native','react-native-document-scanner-plugin','expo-image-picker','expo-image-manipulator','expo-crypto','expo-file-system/legacy','expo-sqlite'].map(find=>({find,replacement:mobile.resolve(find)}))},test:{include:['tests/**/*.test.ts'],testTimeout:30000,hookTimeout:120000,fileParallelism:false,env:{NODE_ENV:'test',JWT_SECRET:'test-only-secret-with-at-least-thirty-two-characters'}}});
