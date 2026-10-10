// A fonte de dados de cada corredor (só no navegador: carrega o DuckDB).
import type { Fonte } from "../lib/fonte";
import { fonte as alimentos } from "./alimentos/fonte";
import { fonte as cosmeticos } from "./cosmeticos/fonte";
import { fonte as saneantes } from "./saneantes/fonte";
import type { IdCorredor } from "./tipos";

export const FONTES: Record<IdCorredor, Fonte> = { alimentos, saneantes, cosmeticos };
