import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['**/node_modules/**','**/dist/**','**/android/**','**/ios/**','**/.expo/**']},js.configs.recommended,...ts.configs.recommended,{files:['**/*.{ts,tsx}'],rules:{'@typescript-eslint/no-explicit-any':'error','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},{files:['**/*.{js,mjs,cjs}'],languageOptions:{globals:{process:'readonly',module:'readonly',require:'readonly',__dirname:'readonly'}}});
