// Como mostrar a validade de um saneante. O grupo (Vigente, Vencido, Sem data) vem do SQL, calculado
// com a data do dia, para o selo bater com a faceta.
import { fmtData, fmtMesAno, toDate } from "./format";

export interface Validade {
  classe: "ok" | "perigo" | "neutro";
  curto: string;
  longo: string;
  /** data fora do comum (a ANVISA publica vencimentos até 3033) */
  estranha: boolean;
}

export function validade(grupo: string, dt: string | null): Validade {
  const d = toDate(dt);
  if (!d) {
    return { classe: "neutro", curto: "Sem vencimento informado", longo: "A ANVISA não informa a data de vencimento deste produto.", estranha: false };
  }
  const estranha = d.getUTCFullYear() > 2100;
  if (grupo === "Vencido") {
    return { classe: "perigo", curto: `Vencido em ${fmtMesAno(dt)}`, longo: `A regularização venceu em ${fmtData(dt)}.`, estranha };
  }
  return { classe: "ok", curto: `Vigente até ${fmtMesAno(dt)}`, longo: `A regularização vale até ${fmtData(dt)}.`, estranha };
}
