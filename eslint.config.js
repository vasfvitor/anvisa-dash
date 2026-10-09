// @ts-check
// TypeScript com regras que usam os tipos (inclusive nos .vue, via @vue/eslint-config-typescript), Vue e Astro.
// A formatação é do Prettier: eslint-config-prettier entra por último e desliga as regras de estilo.
//
// Critério das regras além dos presets: pegar erro de verdade ou deixar o código mais claro sem virar
// ruído. De fora, de propósito: strict-boolean-expressions (`if (!produto.value)` é o idioma do projeto),
// no-non-null-assertion (com noUncheckedIndexedAccess, os `!` são deliberados), complexity, tipos de
// retorno explícitos e no-nested-ternary.
import js from "@eslint/js";
import { configureVueProject, defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import astro from "eslint-plugin-astro";
import pluginVue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

// sem isso as regras no-unsafe-* ficam desligadas em todos os arquivos, não só nos que mexem em componentes
configureVueProject({ allowComponentTypeUnsafety: false });

/** Módulos lidos pelas páginas Astro no build: só dados e formatação. */
const modulosDoBuild = [
  "src/corredores/index.ts",
  "src/corredores/tipos.ts",
  "src/corredores/*/meta.ts",
  "src/corredores/*/colunas.ts",
  "src/lib/{config,detect,fonte,format,manifest,marca,texto}.ts",
];
const proibidosNoBuild = [
  {
    regex: "(^|/)(db|sql|fontes|telas)$|(^|/)composables/|^@duckdb/|(^|/)(?!lib/)[^/.]+/fonte$",
    message: "Só no navegador (DuckDB, SQL, ilha): o build não carrega isso.",
  },
];

export default defineConfigWithVueTs(
  { ignores: ["dist/", ".astro/", "node_modules/", "public/", ".claude/", ".idea/", ".vscode/"] },
  js.configs.recommended,
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.strictTypeChecked,
  vueTsConfigs.stylisticTypeChecked,
  {
    rules: {
      // segurança
      eqeqeq: ["error", "smart"],
      "no-param-reassign": "error",
      "no-implicit-coercion": ["error", { allow: ["!!"] }],
      "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      // `||` em texto é de propósito: variável de ambiente vazia cai no padrão
      "@typescript-eslint/prefer-nullish-coalescing": ["error", { ignorePrimitives: { string: true } }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      // leitura
      curly: ["error", "multi-line"],
      "no-else-return": "error",
      "no-lonely-if": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      "no-var": "error",
    },
  },
  {
    files: ["src/**"],
    rules: { "no-console": "error" },
  },
  {
    files: ["**/*.vue"],
    rules: {
      "vue/block-lang": ["error", { script: { lang: "ts" } }],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/define-macros-order": "error",
      "vue/eqeqeq": ["error", "smart"],
      // Inicio, Facetas, Destaque, Copiar, Icone: nomes de uma palavra são o padrão do projeto
      "vue/multi-word-component-names": "off",
      "vue/no-ref-object-reactivity-loss": "error",
      "vue/no-unused-emit-declarations": "error",
      "vue/no-unused-properties": "error",
      "vue/no-unused-refs": "error",
      "vue/no-useless-mustaches": "error",
      "vue/no-useless-v-bind": "error",
      "vue/prefer-template": "error",
      "vue/prefer-true-attribute-shorthand": "error",
      "vue/prefer-use-template-ref": "error",
      "vue/require-explicit-slots": "error",
      "vue/require-typed-ref": "error",
    },
  },
  // O que roda no build (páginas, layout, registro dos corredores) não pode puxar o DuckDB, o SQL nem a ilha:
  // só existem no navegador. lib/fonte.ts é o contrato sem dependências; corredores/*/fonte.ts é o SQL.
  {
    files: ["src/pages/**", "src/layouts/**", "src/components/*.astro", ...modulosDoBuild],
    rules: { "no-restricted-imports": ["error", { patterns: proibidosNoBuild }] },
  },
  {
    files: modulosDoBuild,
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [...proibidosNoBuild, { regex: "\\.vue$", message: "Componente Vue é da ilha, não do build." }] },
      ],
    },
  },
  ...astro.configs.recommended,
  // .astro e os <script> inline deles (arquivos virtuais .astro/*.js) ficam fora do programa TS
  {
    files: ["**/*.astro", "**/*.astro/*.js", "**/*.astro/*.ts"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.browser },
  },
  // scripts e configs rodam no Node, fora do tsconfig
  {
    files: ["**/*.mjs", "*.config.js", "*.config.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
  prettier,
);
