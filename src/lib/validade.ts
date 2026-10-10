// Como mostrar a validade da liberação (saneantes e cosméticos). O grupo (Em dia, Vencida, Sem data) vem do
// SQL, calculado com a data do dia, para o selo bater com a faceta.
import { fmtData, toDate } from "./format";

export interface Validade {
  classe: "ok" | "perigo" | "neutro";
  curto: string;
  /** data fora do comum (a ANVISA publica vencimentos até 3033) */
  estranha: boolean;
  /** a data já passou, mas a ANVISA lista o produto como liberado (comum nos cosméticos) */
  antiga: boolean;
  /** explicação para o hover, quando o selo sozinho pode confundir */
  dica?: string;
}

const ANTIGA =
  "A data publicada já passou, mas a ANVISA ainda lista o produto como liberado. Confira na consulta oficial.";

/**
 * `ativo` é a situação na ANVISA: um liberado com data passada não diz "venceu" ao lado de "Liberado" (os dois
 * juntos se contradizem); diz que a data é antiga e explica no hover.
 */
export function validade(grupo: string, dt: string | null, ativo: boolean): Validade {
  const d = toDate(dt);
  if (!d) {
    return {
      classe: "neutro",
      curto: "Sem data de vencimento",
      estranha: false,
      antiga: false,
    };
  }
  const estranha = d.getUTCFullYear() > 2100;
  if (grupo === "Vencida" && ativo) {
    return {
      classe: "neutro",
      curto: `Data antiga: ${fmtData(dt)}`,
      estranha,
      antiga: true,
      dica: ANTIGA,
    };
  }
  if (grupo === "Vencida") {
    return {
      classe: "perigo",
      curto: `Liberação venceu em ${fmtData(dt)}`,
      estranha,
      antiga: false,
    };
  }
  return {
    classe: "ok",
    curto: `Liberado até ${fmtData(dt)}`,
    estranha,
    antiga: false,
  };
}
