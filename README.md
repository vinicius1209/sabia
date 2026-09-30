<p align="center">
  <img src="ui/marca/sabia-03-acao.png" width="120" alt="Sabiá, o mascote" />
</p>

<h1 align="center">Sabiá</h1>

<p align="center">
  Um agente de IA que <strong>opera software que não foi feito para ele</strong>.<br />
  Você pergunta no chat, e ele abre os sistemas da escola num navegador de verdade,
  navega, lê a tela e responde citando a fonte.
</p>

---

Feito para a **Exposalê** (feira de ciência, cultura e tecnologia do Colégio
Salesiano Itajaí), para mostrar na prática o que é um agente, e como se sabe que
ele está certo. Os slides e o roteiro estão em [`docs/`](docs/).

**Somente leitura.** Ele consulta, nunca envia mensagem para professor nem altera nada.

## O que ele sabe consultar

A escola usa dois sistemas, com dois logins. O Sabiá usa os dois por você.

| capacidade | o que lê | onde |
|---|---|---|
| `ler_comunicados` | avisos que a escola mandou | ClassApp |
| `ler_calendario` | eventos e datas de prova | ClassApp |
| `ler_boletim` | notas por disciplina | Portal Activesoft |
| `ler_horarios` | grade da semana, com hoje e amanhã marcados | Portal Activesoft |
| `ler_diario` | conteúdo dado em aula e tarefas passadas | Portal Activesoft |

O Portal Activesoft não tem login próprio aqui: o agente entra pelo acesso
integrado (SSO) que o próprio ClassApp oferece.

## Como ele pensa: 3 fases

```
pergunta
   │
   ├── 1. PLANEJAR    o modelo devolve { intencao, raciocinio, ferramentas[] }
   │                  validado por Zod. Só pode pedir ferramenta que existe.
   │
   ├── 2. EXECUTAR    o código roda as ferramentas, na ordem do plano.
   │                  O modelo nunca toca no navegador.
   │
   └── 3. RESPONDER   o modelo devolve { resposta, itens[], fonte }
                      também validado por Zod.
```

**A IA decide, o código age.** E tudo que o código consegue calcular, o código
calcula: que dia é hoje, se uma prova já passou, qual coluna do boletim é a
média, de onde veio o dado. Cada uma dessas regras existe porque o modelo já
errou nela. A história está em [`docs/arquitetura.md`](docs/arquitetura.md).

## Rodando

Precisa de **Node 24 ou mais novo** (roda TypeScript direto, sem build) e de
uma conta do ClassApp que seja sua, ou com autorização de quem é dono dela.

```bash
npm install
npx playwright install chromium
cp .env.example .env      # preencha conta, nome e chave da IA
npm start                 # http://localhost:8123
```

Deixe a janela do navegador do agente ao lado do chat: é o efeito da
demonstração, a plateia vê ele entrando nos sistemas.

### Variáveis (`.env`)

| variável | para que serve |
|---|---|
| `CLASSAPP_PHONE` / `CLASSAPP_PASSWORD` | conta do ClassApp (login por celular) |
| `ALUNO_NOME` / `ALUNO_SERIE` / `ESCOLA_NOME` | quem é a dona da conta, para o prompt e o topo da tela |
| `LLM_PROVIDER` | `openai` (padrão), `gemini`, ou `local` (sem IA) |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | chave e modelo da OpenAI (padrão `gpt-6-luna`) |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | alternativa, se trocar o provedor |
| `HOST` | `127.0.0.1` (padrão): só esta máquina acessa |
| `PRAZO_2FA_MS` | quanto esperar alguém digitar o código 2FA (padrão 3 min) |
| `SHOW_BROWSER` | `1` mostra o navegador, `0` roda escondido |
| `PORT` | porta do servidor (padrão 8123) |

Os três motores (`openai`, `gemini`, `local`) obedecem os mesmos contratos Zod.
O `local` não chama IA nenhuma e continua lendo os dados reais: é o plano B se
a internet ou a chave falharem no dia.

## O código de verificação (2FA)

A sessão fica no perfil `.profile-chrome/` (fora do git), e o ClassApp permite
**confiar no dispositivo por 30 dias**, então normalmente o código não é pedido.

Se a sessão expirar, o agente **para sozinho na tela de verificação** e abre um
campo no chat pedindo os 6 dígitos. A dona da conta digita o código que chegou
no celular dela, e ele segue. Se ninguém digitar dentro do prazo, ele desiste e
avisa. A autenticação é sempre feita pela pessoa, na hora. Nada é contornado.

## Testes

```bash
npm run check      # tipos (tsc), 0 erros
npm test           # 72 testes, sem rede e sem navegador, menos de 1s
npm run test:real  # as 5 capacidades contra os sistemas reais (precisa do .env)
npm run bench      # compara modelos no trabalho real do agente
```

`npm test` cobre a lógica que já errou de verdade neste projeto, com funções
puras e dados fictícios no formato real das telas:

- qual coluna do boletim é a média (e não uma prova solta do outro semestre)
- conceito (`CE`) continua conceito, não vira número
- rodapé de assinatura e legenda não entram como disciplina
- `passou` do calendário, e "evento de hoje não é passado"
- hoje e amanhã na grade, sem depender do modelo
- "Não houve" e "Sem tarefa." no diário não viram tarefa
- contratos recusam ferramenta e intenção inventadas
- o motor local escolhe a capacidade certa para cada pergunta

`npm run test:real` confere **invariantes**, não valores (nota muda, formato não).

### Os testes foram verificados sabotando o código

Teste que nunca falha não serve para nada. Cada regra foi quebrada de propósito
para conferir que a suíte acusa:

| sabotagem | resultado |
|---|---|
| a média vira o primeiro número da linha | 4 testes falham |
| inverter a lógica de "já passou" | 2 testes falham |
| tirar uma palavra do filtro de rodapé | **nenhum falhava** |

A última linha achou um teste fraco: o caso de rodapé passava por causa do
limite de tamanho, e não do filtro de palavras. Hoje existe um caso curto para
cada palavra do filtro.

## Segurança e privacidade

- **Só esta máquina acessa** (`HOST=127.0.0.1`). O agente está logado numa conta
  real e responde notas sem pedir senha. `HOST=0.0.0.0` abriria para a rede, e
  qualquer um no wifi leria os dados da conta.
- **Somente leitura.** Nenhuma capacidade altera nada.
- **Nenhum dado pessoal no código.** Nome, conta e chaves vivem no `.env`, que
  não vai para o git. Os testes usam dados fictícios no formato real.
- As telas dos sistemas mostram dados de pessoas reais. Para exibir em público,
  use uma conta com autorização da dona, como foi feito aqui.

## Estrutura

```
src/            o agente (veja docs/arquitetura.md)
  capacidades/  uma capacidade por arquivo
ui/             o chat, com o mascote que muda conforme o que ele faz
test/           unidade (sem rede) e integração (sistemas reais)
docs/           slides, roteiro da apresentação, arquitetura, mascote
scripts/        gerar o PDF dos slides, o mascote, e o benchmark de modelos
offline/        primeira versão, simulação com dados fictícios (plano B sem internet)
```

## Licença

[MIT](LICENSE)
