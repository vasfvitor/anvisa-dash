// Fonte de dados de cada corredor (o registro com textos e cores está em ../corredores.ts).
import type { IdCorredor } from "../corredores";
import { alimentos } from "./alimentos";
import type { Fonte } from "./comum";
import { saneantes } from "./saneantes";

export const FONTES: Record<IdCorredor, Fonte> = {
  alimentos,
  saneantes,
};
