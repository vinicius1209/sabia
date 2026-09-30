# Arquitetura do Sabiá

## O que ele é

Um agente de IA que **opera software que não foi feito para ele**. Não tem API,
não tem integração: ele abre o ClassApp e o Portal Activesoft num navegador de
verdade, navega, lê a tela e responde.

## Núcleo e pacote

O projeto tem duas metades, como os agentes da Plow e da Instinct: um **harness**
genérico e um **pacote** que diz quem é o agente.

```
┌─────────────────────────────── núcleo (src/nucleo) ───────────────────────────────┐
│  laço de 3 fases · motores de IA · protocolo · servidor · config e conversas      │
│  não sabe o que é escola                                                           │
└──────────────────────────────────────┬────────────────────────────────────────────┘
                                       │ veste
┌──────────────────────────── pacote (src/agentes/sabia) ───────────────────────────┐
│  persona · 5 capacidades · campos do primeiro uso · login com 2FA · mascote        │
└────────────────────────────────────────────────────────────────────────────────────┘
```

O pacote é um objeto só, declarado com `definirAgente()` em
`src/agentes/sabia/index.ts`. O teste `test/nucleo.test.ts` monta um agente de
brinquedo (previsão do tempo, sem nada de escola) e roda ele ponta a ponta pelo
servidor: é a prova de que o núcleo é genérico de verdade.

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
   ├── 0. PREPARAR    o pacote garante a sessão (login; pode parar pedindo o 2FA)
   │
   ├── 1. PLANEJAR    o modelo devolve { intencao, mensagem, ferramentas[] }
   │                  validado por Zod. Só pode pedir ferramenta que existe.
   │
   ├── 2. EXECUTAR    o CÓDIGO roda as ferramentas, na ordem do plano.
   │                  O modelo nunca toca no navegador.
   │
   └── 3. RESPONDER   o modelo devolve { resposta, itens[], fonte }, também
                      validado. O texto chega na tela enquanto é escrito.
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
| que dia é "amanhã" | **código** (`ehAmanha`) | mesma armadilha (e numa sexta, amanhã é sábado sem aula, nunca a segunda) |
| qual coluna é a média | **código** (`offsetDaMedia`) | modelo pegava a nota errada |
| de onde veio o dado | **código** (a partir do plano) | modelo respondia "nenhuma" |

O laço não guarda estado. O histórico de cada conversa mora num arquivo e
chega de fora a cada pergunta, então sobrevive a reiniciar o servidor.

**Parar é parar.** O sinal de "Parar" (ou a aba fechada) chega até o motor: a
CLI é morta, a conexão com a OpenAI ou o Gemini é fechada, e a espera pelo
código 2FA é cancelada. Mesmo um motor que ignore o sinal não segura a tela: o
laço corre a chamada contra o sinal e desiste na hora. Sem isso, "Parar"
esperava o modelo terminar (até ~20 s na CLI) e o servidor ficava "ocupado".

**O relógio pode congelar.** `contexto.ts` é a única fonte de "agora", e
`congelarRelogio()` (ou `SABIA_AGORA=2026-09-26T10:00:00-03:00`) fixa a data.
O benchmark usa isso: os dados fictícios são de 26/09, e o cabeçalho do prompt
tem que dizer o mesmo dia, senão o modelo "erra" por culpa do teste.

## Os motores

A IA fica atrás de uma interface com dois métodos, `plano()` e `resposta()`.
Qualquer motor serve, desde que devolva o formato validado.

| motor | como | acertos* | tempo por chamada |
|---|---|---|---|
| Claude Sonnet | **assinatura**, `claude -p --json-schema` | 5 a 7/7 | ~3,5 s, transmite |
| Claude Haiku | **assinatura**, `claude -p --json-schema` | 6/7 | ~5 s |
| Antigravity (Gemini 3.8 Flash low) | **assinatura**, `agy -p --json-schema` | 7/7 | ~8 a 14 s |
| Codex | **assinatura**, `codex exec --output-schema` | 7/7 | ~9 s |
| OpenAI gpt-6-luna | API, structured outputs | 7/7 | ~2,5 s |
| OpenAI gpt-4.1-mini | API, structured outputs | 6/7 | ~1,4 s |
| Gemini | API, `responseJsonSchema` | não medido | |
| Sem IA | regras de palavra-chave | plano B | instantâneo |

\* os 7 casos do `npm run bench`, set/2026. Os erros do Claude são consultar
uma fonte a mais, não responder errado. O Flash "medium" do agy ficou de fora:
pensou até estourar 2 min e devolveu o plano fora do formato.

**O padrão é o Automático** (`LLM_PROVIDER` vazio ou `auto`): a primeira CLI por
assinatura instalada, na ordem da tabela; sem nenhuma, uma chave de API que
exista; sem chave, o Sem IA. Ninguém gasta com chave sem ter escolhido gastar.

Os motores por assinatura usam as mesmas CLIs que o Frota orquestra (claude,
codex, agy), logadas na máquina. Cada chamada roda numa pasta vazia, sem
ferramentas e sem MCP: senão a CLI carregaria o `CLAUDE.md` de quem estiver por
perto e viraria um agente de código dentro do nosso agente. As armadilhas do
`agy` vieram do adaptador do Frota, que já apanhou delas: sem
`--dangerously-skip-permissions` o modo `-p` trava esperando aprovação, ele tem
teto de tempo próprio (`--print-timeout`), e o `response` mistura narração com
resposta (só o `structured_output` vale).

Só o Claude transmite a resposta aos pedaços: no `stream-json`, a saída
estruturada chega como chamada à ferramenta `StructuredOutput`, e os
`input_json_delta` dela são o JSON sendo escrito. O `agy` e o Codex entregam o
JSON inteiro no fim.

Dois achados dessa integração:
- O filtro de segurança do Claude às vezes **recusava** o plano, e o detalhe
  dizia `reasoning_extraction`: um campo de saída chamado `raciocinio` parecia
  tentativa de extrair o raciocínio interno do modelo. O campo virou `mensagem`
  (é só uma frase de status para a tela), e o adaptador tenta de novo uma vez.
- O validador da CLI do Claude não conhece o `$schema` do draft 2020-12, que é o
  padrão do Zod: o schema vai no formato draft-7.

## Os dados sem margem para interpretação

O modelo erra menos quando o dado já diz o que é. Cada capacidade entrega o dado
com o significado junto, e a descrição dela diz o que NÃO dá para afirmar:

- **Boletim:** as 28 colunas lidas pelo cabeçalho de dois níveis (1º SEM, 2º SEM,
  MA, RECF, MF). A `media` é a que vale agora e `mediaDe` diz de onde ela é (no
  meio do ano, só o 1º semestre); `faltasTotal` é o do ano; as parciais vêm com
  a sigla; a legenda oficial do rodapé vai junto, sem a linha com nome e
  matrícula. Sigla fora da legenda (RS, AJUSTE) é citada sem explicação, e
  aprovado ou reprovado nunca é dito: a média mínima não está nos dados.
- **Calendário:** `ehAvaliacao` separa prova de feriado e oficina; a segunda
  chamada vem marcada à parte; evento sem data vai para o fim; e "não achei"
  vale só para os meses lidos.
- **Comunicados, horários, diário:** dizem o que falta (só o título de um
  aviso, a grade padrão sem feriados, o que o professor registrou).

O `npm run bench` tem um conjunto só dessas armadilhas (`CASOS=interpretacao`),
tiradas de erros que aconteceram de verdade. Claude Sonnet e gpt-6-luna fazem
10/10 em duas rodadas.

## Quando a página muda de formato

A leitura depende de telas que a escola pode mudar sem avisar. Três camadas:

1. **Ler pelo significado.** Colunas pelo nome (cabeçalho em dois níveis), não
   pela posição. Coluna nova com dados coerentes continua sendo lida sozinha.
2. **Nunca adivinhar (fail closed).** Cada capacidade trata página irreconhecível
   como ERRO, nunca como vazio: horários sem grade, calendário sem mês,
   comunicados vazios três vezes, diário com marcadores mas sem disciplinas. O
   boletim vira `formato: "indisponivel"` com o motivo e só os nomes das colunas
   (nenhum valor), e ainda confere os valores (nota de 0 a 10, conceito da
   legenda, faltas inteiras). No núcleo, dado fora do contrato Zod não chega ao
   modelo: a ferramenta falha e a resposta diz que não conseguiu ler.
   Antes, o boletim sem tabela caía no texto cru da página, com nome, nascimento
   e filiação da aluna, e isso ia para o modelo.
3. **Avisar que mudou.** `ler()` recebe um terceiro argumento, `estrutura`, e
   descreve a FORMA da página. `src/nucleo/estruturas.ts` guarda a primeira como
   referência em `~/.sabia/estruturas.json` e compara nas seguintes; quando muda,
   `/api/estado` traz a mudança, a tela mostra um aviso com a data, e ele fica até
   alguém clicar em "Já conferi" (ou até a página voltar ao que era).
   `npm run doctor -- --fontes` entra em cada fonte e confere, com o app fechado.

Página que carrega pela metade não é mudança de formato: comunicados esperam o
texto dos itens (não só os links), e o boletim relê até três vezes antes de
declarar indisponível.

## A memória da conversa

`src/nucleo/memoria.ts`, no desenho de memória do Frota (`docs/context-handoff.md`
no mycockpit):

- **A memória é do app, não do modelo.** Nenhuma sessão nativa guarda nada, então
  trocar de motor no meio da conversa (Claude → OpenAI) não perde contexto.
- **Orçamento, não despejo.** As 3 últimas trocas vão inteiras (pergunta,
  resposta, destaques, hora); as antigas, em uma linha; tudo dentro de 6.000
  caracteres, com aviso explícito quando algo fica de fora. Os DADOS brutos das
  leituras antigas não voltam: o boletim sozinho tem ~9 mil caracteres.
- **O pedido atual nunca é cortado** e aparece uma vez só, depois da conversa.
- **O dado de agora vence a memória.** A conversa ajuda a entender "essa
  matéria"; número novo só vem da fonte lida agora.

E uma regra no código, porque instrução no prompt não bastou: se o plano diz
que a pergunta é sobre um assunto com fonte (ou é "conversa" mas a pergunta
dispara os sinais do plano B, como "média"), e não pede leitura nenhuma, o
`completarPlano` acrescenta a leitura. Medido: o gpt-6-luna respondia "qual é
MESMO a média?" de memória, com a nota antiga. `CASOS=continuacao` no bench
cobra isso (Claude Sonnet e gpt-6-luna 6/6 em duas rodadas).

## O protocolo

`src/nucleo/protocolo.ts` define tudo que o servidor e a tela trocam. A tela
importa esses tipos direto do servidor: se um lado mudar, o outro não compila.

Cada pergunta é um `POST /api/perguntar` cuja resposta é um fluxo de eventos
(SSE), na ordem em que acontecem:

```
conversa → passo* → plano → (ferramenta_inicio → passo* → ferramenta_fim)* → texto* → resposta
                                                   2fa_pedido / 2fa_fim podem aparecer no meio
                                                   erro encerra no lugar da resposta
```

O `ferramenta_fim` leva os dados lidos, e a tela monta com eles o cartão daquela
capacidade. Os pedaços de `texto` só existem ao vivo; o que fica salvo na
conversa é a resposta final.

## Onde ficam os dados

Tudo que é da pessoa mora em `~/.sabia` (ou `SABIA_HOME`), fora do repositório:

| o quê | onde | permissão |
|---|---|---|
| chaves, conta, nome | `config.json` | 600 |
| sessão do navegador (o "confiar neste dispositivo") | `navegador/` | 700 |
| conversas, com os dados lidos | `conversas/<id>.json` | 600 |

Precedência da configuração: variável de ambiente de verdade, depois o
`config.json`, depois o `.env` do projeto. Na primeira execução, o `.env` e a
sessão antiga (`.profile-chrome/`) são copiados para lá, para ninguém refazer
login nem 2FA.

## A tela

`web/` é um app React com Vite, Tailwind e shadcn no estilo `base-nova`, seguindo
os blocos de chat do [blocks.so](https://github.com/ephraimduncan/blocks)
(`chat-03` para a conversa e a barra lateral, `ai-02` para o seletor de motor).

- **O mascote é o indicador de estado**, e é um desenho em SVG de frente, fiel
  ao ícone da marca, com as partes separadas
  (`web/src/agentes/sabia/mascote.tsx`): respira e pisca parado,
  inclina a cabeça pensando, pula e bica buscando, abre o bico escrevendo, bate
  as asas quando responde, se chacoalha no erro. Fundo transparente. A galeria
  de estados fica em `/#mascotes`. Pacote sem mascote animado usa as poses PNG
  da marca.
- **A trilha recolhe** no fim ("Trabalhou por 27s · 1 fonte") e abre com cada
  passo, agrupado sob a ferramenta que o deu.
- **Cada capacidade tem um cartão próprio** (tabela de notas, linha do tempo de
  provas, grade por dia), fechado por padrão: no telão, o boletim inteiro só
  aparece se alguém abrir. Capacidade sem cartão cai num genérico, e um cartão
  que quebre com um dado inesperado também.
- **Primeiro uso guiado**: escolher a IA, preencher a conta, conectar com o 2FA
  na própria tela. Nada de editar arquivo.

## Os arquivos, por responsabilidade

```
src/
  cli.ts                 ponto de entrada: iniciar ou doctor
  nucleo/
    agente.ts            o laço de 3 fases
    registro.ts          deriva das capacidades: contratos, prompt, execução, plano B
    capacidade.ts        o formato de uma capacidade (defineCapacidade)
    pacote.ts            o formato de um pacote de agente (definirAgente)
    prompt.ts            prompt de sistema e da pergunta
    protocolo.ts         os eventos e respostas entre servidor e tela
    servidor.ts          HTTP + fluxos SSE; veste o pacote que receber
    config.ts            ~/.sabia, precedência, migração do .env
    conversas.ts         as conversas salvas
    doisfatores.ts       a espera pelo código 2FA, com prazo e cancelamento
    contexto.ts          a única fonte de "agora" (data, hora, fuso)
    motores/             openai, gemini, cli (assinatura), local, e o catálogo
  agentes/sabia/
    index.ts             O PACOTE: persona, campos, marca, preparar()
    capacidades/         uma capacidade por arquivo
    browser.mjs          sessão, login, 2FA com pessoa no meio, auto-recuperação
    mascara.ts           o borrão do telão (nome, foto, matrícula...), falha fechada
    marca/               as poses do mascote
web/src/
  hooks/use-sabia.ts     o estado da tela
  lib/turno.ts           eventos → o que a tela mostra (ao vivo e ao reabrir)
  components/chat/       conversa, trilha, composer, seletor de motor, 2FA
  agentes/sabia/         os cartões das 5 capacidades
```

A separação que mais importa: dentro de cada capacidade, **a função `montarX()`
é pura, e o `ler()` é sujo.** A lógica que mais erra (qual coluna, que dia) mora
na parte pura, e por isso tem teste rápido. O navegador fica isolado no `ler()`.

---

# Como adicionar uma capacidade nova

**Uma capacidade = um arquivo.** Antes isso exigia editar 7 lugares espalhados, e
dava para registrar a ferramenta e esquecer de descrevê-la ao modelo (aí ela
existia e ele nunca escolhia).

### Passo 0 · Olhar a tela antes de escrever código

- **Leia o `href` do menu, não adivinhe a URL.** Chutar `horarios.asp` deu 404;
  o link certo (`quadroHorarios_selecionarTurma.asp?IdAluno=N`) estava no menu.
  Por isso existe `irParaItemDoMenu()`.
- **Veja se é tabela ou texto.** O boletim e os horários são tabelas (use
  `lerTabelas()`). O diário de classe é texto corrido em blocos.

### Passo 1 · Criar `src/agentes/sabia/capacidades/<nome>.ts`

```ts
export const Saida = z.object({ ... })         // 1. o contrato do que devolve

export function montarX(bruto) { ... }          // 2. lógica PURA (testável)

export default defineCapacidade({
  nome, rotulo, fonte, icone, intencao,
  descricao: "...",                             // 3. o que o MODELO lê
  entrada: z.object({ ... }),
  saida: Saida,
  async ler(args, passo) { ... },               //    a navegação
  resumir: (d) => "...",                        //    a linha do cartão
  local: { sinais, raciocinio, responder },     // 4. o plano B sem IA
});
```

A `descricao` mora aqui de propósito: ela **é** o trecho do prompt.

### Passo 2 · Uma linha no pacote

```ts
// src/agentes/sabia/index.ts
capacidades: [comunicados, calendario, boletim, horarios, diario, nova],
```

**Acabou.** A partir daqui é tudo derivado sozinho:

| derivado | de onde |
|---|---|
| o enum que o modelo pode pedir | `nome` |
| os assuntos possíveis do plano | `intencao` |
| a descrição das fontes no prompt | `descricao` |
| a linha da ferramenta na trilha | `rotulo`, `fonte`, `icone`, `resumir` |
| validação de entrada e saída | `entrada`, `saida` |
| o roteamento do plano B | `local.sinais` (pontuação forte/fraco) |

### Passo 3 (opcional) · Um cartão na tela

Sem nada, os dados aparecem no cartão genérico. Para um cartão próprio, crie o
componente em `web/src/agentes/sabia/artefatos.tsx` e registre com `cartao()`.
O tipo dos dados vem do seu `Saida`: se o contrato mudar, o cartão não compila.

### Passo 4 · Testar

```bash
npm run check   # o compilador cobra o que faltou, no servidor e na tela
npm test        # a lógica pura, em milissegundos
npm start       # a real
```

---

# Como criar outro agente

1. Crie `src/agentes/<id>/index.ts` exportando um `definirAgente({...})`: nome,
   persona, saudação, sugestões, campos do primeiro uso, capacidades, marca, e
   `preparar()` se as fontes precisarem de login.
2. Rode com `SABIA_AGENTE=<id> npm start`.
3. Cartões próprios são opcionais (`web/src/agentes/<id>/`).

O `test/nucleo.test.ts` tem um pacote completo de exemplo, em menos de 50 linhas.

## O que falta para virar produto

Honestidade sobre os limites atuais:

- **Plano de 1 passo.** Ele não replaneja se uma ferramenta falha.
- **Memória por conversa.** Uma conversa nova começa do zero; ele não junta o
  que aprendeu em uma com a outra.
- **Uma pergunta por vez.** O navegador é um só, então o servidor serializa.
- **Somente leitura.** Escrever exigiria confirmação humana antes de cada ação.
- **Um usuário.** Sem multiusuário, sem controle de custo por pessoa.
- **`npx sabia` ainda não.** O Node não roda TypeScript de dentro de
  `node_modules`; publicar no npm exigiria compilar antes.
