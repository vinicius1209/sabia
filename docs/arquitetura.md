# Arquitetura do Sabiá

## O que ele é

Um agente de IA que **opera software que não foi feito para ele**. Não tem API,
não tem integração: ele abre o ClassApp e o Portal Activesoft num navegador de
verdade, navega, lê a tela e responde.

## As 5 capacidades de hoje

| ferramenta | o que lê | onde |
|---|---|---|
| `ler_comunicados` | avisos que a escola mandou | ClassApp |
| `ler_calendario` | eventos e datas de prova | ClassApp |
| `ler_boletim` | notas por disciplina | Portal Activesoft |
| `ler_horarios` | grade da semana, que aula em cada dia | Portal Activesoft |
| `ler_diario` | conteúdo dado em aula e tarefas passadas | Portal Activesoft |

Todas são **somente leitura**. Nenhuma altera nada.

## O laço: 3 fases determinísticas

```
pergunta
   │
   ├── 1. PLANEJAR    o modelo devolve { intencao, raciocinio, ferramentas[] }
   │                  validado por Zod. Só pode pedir ferramenta que existe.
   │
   ├── 2. EXECUTAR    NÓS rodamos, na ordem do plano.
   │                  O modelo nunca toca no navegador.
   │
   └── 3. RESPONDER   o modelo devolve { resposta, itens[], fonte }
                      também validado por Zod.
```

**A regra que rege tudo: o modelo decide, o código age.**

E o corolário, que custou caro para aprender: **tudo que o código consegue
calcular, o código calcula.** O modelo erra em coisas determinísticas.

| decisão | quem faz | por quê |
|---|---|---|
| qual fonte consultar | modelo | exige interpretar a pergunta |
| em que ordem | modelo (no plano) | idem |
| que dia é hoje | **código** | modelo não sabe a data |
| se um evento já passou | **código** (`passou`) | modelo errava a comparação |
| que dia é "amanhã" | **código** (`ehAmanha`) | mesma armadilha |
| qual coluna é a média | **código** (`offsetDaMedia`) | modelo pegava a nota errada |
| de onde veio o dado | **código** (a partir do plano) | modelo respondia "nenhuma" |

## Os arquivos, por responsabilidade

```
src/
  capacidades/     UMA CAPACIDADE POR ARQUIVO. Cada uma traz o contrato Zod do
                   que devolve, a lógica PURA de interpretação (testável sem
                   navegador), a descrição que o modelo lê, a navegação, e o
                   plano B sem IA.
    index.ts       O registro. Deriva dele o enum de ferramentas, o prompt,
                   a validação e o roteamento do motor local.
    _portal.ts     O que as capacidades do Portal Activesoft compartilham.
  contracts.ts     Os contratos do AGENTE: o formato do plano e da resposta.
  agent.ts         As 3 fases + os adaptadores de modelo (OpenAI, Gemini, local).
  browser.mjs      Sessão, login, 2FA com pessoa no meio, auto-recuperação.
  doisfatores.ts   A espera pelo código 2FA, com prazo e cancelamento.
  contexto.ts      A única fonte de "agora" (data, hora, fuso da escola).
  perfil.ts        Quem é a dona da conta. Vem do .env, nunca do código.
  local.ts         Motor sem IA, plano B se a internet cair.
  server.ts        HTTP + eventos (SSE) para a interface acompanhar cada passo.
```

A separação que mais importa: dentro de cada capacidade, **a função `montarX()`
é pura, e o `ler()` é sujo.** A lógica que mais erra (qual coluna, que dia) mora
na parte pura, e por isso tem teste rápido. O navegador fica isolado no `ler()`.

---

# Como adicionar uma capacidade nova

**Uma capacidade = um arquivo.** Antes isso exigia editar 7 lugares espalhados, e
dava para registrar a ferramenta e esquecer de descrevê-la ao modelo (aí ela
existia e ele nunca escolhia). Hoje é assim:

### Passo 0 · Olhar a tela antes de escrever código

Duas lições que economizam horas:

- **Leia o `href` do menu, não adivinhe a URL.** Chutar `horarios.asp` deu 404;
  o link certo (`quadroHorarios_selecionarTurma.asp?IdAluno=N`) estava no menu.
  Por isso existe `irParaItemDoMenu()`.
- **Veja se é tabela ou texto.** O boletim e os horários são tabelas (use
  `lerTabelas()`). O diário de classe é texto corrido em blocos.

### Passo 1 · Criar `src/capacidades/<nome>.ts`

O arquivo tem quatro partes, nesta ordem:

```ts
export const Saida = z.object({ ... })        // 1. o contrato do que devolve

export function montarX(bruto) { ... }         // 2. lógica PURA (testável)

export default defineCapacidade({
  nome, rotulo, fonte, icone,
  descricao: "...",                            // 3. o que o MODELO lê
  entrada: z.object({ ... }),
  saida: Saida,
  async ler(args, passo) { ... },              //    a navegação
  local: { sinais, intencao, raciocinio, responder }, // 4. o plano B sem IA
});
```

A `descricao` mora aqui de propósito: ela **é** o trecho do prompt. Não tem como
registrar a capacidade e esquecer de contar ao modelo.

### Passo 2 · Uma linha no registro

```ts
// src/capacidades/index.ts
import diario from "./diario.ts";
export const CAPACIDADES = [comunicados, calendario, boletim, horarios, diario];
```

**Acabou.** A partir daqui é tudo derivado sozinho:

| derivado | de onde |
|---|---|
| o enum que o modelo pode pedir | `nome` |
| a descrição das fontes no prompt | `descricao` |
| o cartão na tela | `rotulo`, `fonte`, `icone` |
| validação de entrada e saída | `entrada`, `saida` |
| o roteamento do plano B | `local.sinais` (pontuação forte/fraco) |

### Passo 3 · Testar

```bash
npm run check   # o compilador cobra o que faltou
npm test        # a lógica pura, em milissegundos
npm start       # a real
```

Escreva os testes da lógica pura **antes** de abrir o navegador. Os 4 testes do
diário rodam em milissegundos e cobrem o caso que mais importa: `"Não houve"`
não pode virar tarefa.

## O que falta para virar produto

Honestidade sobre os limites atuais:

- **Plano de 1 passo.** Ele não replaneja se uma ferramenta falha.
- **Memória curta.** O histórico morre quando o servidor reinicia.
- **Uma pergunta por vez.** O servidor serializa.
- **Somente leitura.** Escrever exigiria confirmação humana antes de cada ação.
- **Um usuário.** Sem multiusuário, sem controle de custo por pessoa.
