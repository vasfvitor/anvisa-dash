// Como mostrar a validade da liberação de um saneante. O grupo (Em dia, Vencida, Sem data) vem do SQL, calculado
// com a data do dia, para o selo bater com a faceta.
import { fmtData, toDate } from "../../lib/format";

export interface Validade {
  classe: "ok" | "perigo" | "neutro";
  curto: string;
  /** data fora do comum (a ANVISA publica vencimentos até 3033) */
  estranha: boolean;
}

export function validade(grupo: string, dt: string | null): Validade {
  const d = toDate(dt);
  if (!d) {
    return {
      classe: "neutro",
      curto: "Sem data de vencimento",
      estranha: false,
    };
  }
  const estranha = d.getUTCFullYear() > 2100;
  if (grupo === "Vencida") {
    return {
      classe: "perigo",
      curto: `Liberação venceu em ${fmtData(dt)}`,
      estranha,
    };
  }
  return {
    classe: "ok",
    curto: `Liberado até ${fmtData(dt)}`,
    estranha,
  };
}
