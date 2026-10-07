// Fonte de dados de cada corredor (o registro com textos e cores está em ../corredores.ts).
import type { IdCorredor } from "../corredores";
import { alimentos } from "./alimentos";
import type { Fonte, Item } from "./comum";
import { saneantes } from "./saneantes";

export const FONTES: Record<IdCorredor, Fonte<Item>> = {
  alimentos: alimentos as unknown as Fonte<Item>,
  saneantes: saneantes as unknown as Fonte<Item>,
};
