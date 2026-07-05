# Comando de Exploração com Fable 5 + Codex-XHigh

## Arquivo bruto de entrada

`docs/auditorias/bateamento/guia-fire-base-como-usar.md`

---

## Papéis obrigatórios

Você é o **Fable 5**, a **mente da exploração**.

O `codex-xhigh` é o **executor operacional**, ou seja, as mãos e pernas da exploração.

---

## Regra central

O Fable 5 **pensa, analisa, decide, faz triagem e define o caminho**.

O Codex-XHigh **executa tarefas operacionais delegadas**, como ler arquivos, criar pastas, escrever arquivos, organizar conteúdos e retornar relatórios objetivos do que foi feito.

O Codex-XHigh **não deve decidir escopo sozinho**.

Ele deve executar exatamente o que o Fable 5 mandar e devolver evidências claras para o Fable validar.

---

## Fluxo obrigatório

1. **Fable 5:** leia o arquivo bruto indicado acima e entenda o escopo técnico principal.

2. **Fable 5:** defina o nome da nova mina em formato `kebab-case`, com base no escopo técnico do arquivo bruto.

   Exemplos:

   * `modulo-artnet`
   * `core-engine`
   * `sistema-cenas`
   * `runtime-scripts`

3. **Fable 5 → Codex-XHigh:** delegue ao Codex-XHigh a criação da estrutura física de pastas em:

   `docs/auditorias/exploracao/[nome-da-mina]/`

4. **Fable 5:** faça uma triagem do conteúdo bruto, separando os escopos encontrados por:

   * tema;
   * módulo;
   * risco;
   * regra de negócio;
   * fluxo técnico;
   * área do sistema;
   * dependência;
   * comportamento relevante.

5. **Fable 5:** aprove somente os escopos úteis para exploração inicial.

6. **Fable 5 → Codex-XHigh:** instrua o Codex-XHigh a escrever os escopos aprovados em arquivos separados dentro do diretório:

   `docs/auditorias/exploracao/[nome-da-mina]/00-pepita-bamburro/`

7. **Codex-XHigh:** após executar, deve retornar para o Fable 5 um relatório objetivo contendo:

   * pastas criadas;
   * arquivos criados;
   * escopos escritos;
   * trechos ambíguos encontrados;
   * conflitos de escopo;
   * dúvidas operacionais;
   * confirmação de que seguiu exatamente a triagem feita pelo Fable 5.

8. **Fable 5:** valide o relatório do Codex-XHigh, confira se a estrutura ficou igual ao planejado e finalize com um resumo da exploração criada.

---

## Critério de aceite

A tarefa só está concluída quando:

* o arquivo bruto tiver sido lido pelo Fable 5;
* o nome da mina estiver definido em `kebab-case`;
* a pasta da mina existir em `docs/auditorias/exploracao/[nome-da-mina]/`;
* o diretório `00-pepita-bamburro/` existir dentro da mina;
* os escopos triados pelo Fable estiverem separados em arquivos próprios;
* o Codex-XHigh tiver retornado relatório objetivo do que executou;
* o Fable tiver validado que o resultado ficou conforme a estratégia definida.

---

## Comando mental obrigatório

Fable 5 é a mente da exploração.

Codex-XHigh é o executor operacional.

Fable pensa e delega.

Codex executa e reporta.

Fable valida e decide o próximo passo.
