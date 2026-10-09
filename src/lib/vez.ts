// Respostas fora de ordem: cada pedido pega uma vez e só a mais nova vale. Serve onde uma resposta antiga
// pode chegar depois de uma nova (digitação rápida, troca de corredor).
export interface Vezes {
  /** Começa uma vez nova; a função devolvida diz se ela ainda é a mais nova. */
  nova(): () => boolean;
  /** Nenhuma vez em andamento vale mais. */
  invalidar(): void;
}

export function vezes(): Vezes {
  let atual = 0;
  return {
    nova() {
      const minha = ++atual;
      return () => minha === atual;
    },
    invalidar() {
      atual++;
    },
  };
}
