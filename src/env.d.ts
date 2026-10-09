interface ImportMetaEnv {
  /** manifest de um build local dos dados (README, "Desenvolvimento"); vazio usa o de produção */
  readonly PUBLIC_MANIFEST_URL?: string;
}

// O TypeScript puro (o que o ESLint usa) não lê .vue e trataria cada import como erro de tipo; vue-tsc
// resolve o arquivo de verdade e só cai nesta declaração se não achar o componente.
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const componente: DefineComponent;
  export default componente;
}
