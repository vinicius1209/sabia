<p align="center">
  <img src="src/agentes/sabia/marca/sabia-03-acao.png" width="120" alt="Sabiá, o mascote" />
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

## Rodando

Precisa de **Node 24 ou mais novo** (roda TypeScript direto, sem compilar o
servidor) e de uma conta do ClassApp que seja sua, ou com autorização de quem é
dono dela.

```bash
npm install
npx playwright install chromium
npm start
```

O `npm start` compila a tela, sobe o agente e abre o navegador. Na primeira vez
aparece um **guia de três passos**: escolher a IA, preencher a conta e fazer o
primeiro login (o código 2FA é pedido ali mesmo). Nada de editar arquivo.

Se algo não funcionar, `npm run doctor` diz o que falta.

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
   ├── 1. PLANEJAR    o modelo devolve { intencao, mensagem, ferramentas[] }
   │                  validado por Zod. Só pode pedir ferramenta que existe.
   │
   ├── 2. EXECUTAR    o código roda as ferramentas, na ordem do plano.
   │                  O modelo nunca toca no navegador.
   │
   └── 3. RESPONDER   o modelo devolve { resposta, itens[], fonte }
                      também validado, e o texto aparece enquanto é escrito.
```

**A IA decide, o código age.** E tudo que o código consegue calcular, o código
calcula: que dia é hoje, se uma prova já passou, qual coluna do boletim é a
média, de onde veio o dado. Cada uma dessas regras existe porque o modelo já
errou nela. A história está em [`docs/arquitetura.md`](docs/arquitetura.md).

## Qual IA responde

Escolha na tela, a qualquer hora, pelo seletor da caixa de pergunta.

| motor | precisa de | acertos* |
|---|---|---|
| OpenAI (gpt-6-luna, gpt-4.1-mini) | chave de API | 7/7 e 6/7 |
| Claude pela assinatura | Claude Code logado na máquina | 6/7 |
| Codex pela assinatura | Codex logado na máquina (lento para ao vivo) | 7/7 |
| Gemini | chave de API | não medido |
| Sem IA | nada: regras de palavra-chave, ainda lendo os dados reais | plano B |

\* os casos do `npm run bench`. Os motores por assinatura usam o login que você
já tem no Claude Code ou no Codex, sem chave de API.

## Um núcleo, um pacote

O projeto é um **harness genérico** (`src/nucleo`) vestido por um **pacote de
agente** (`src/agentes/sabia`), no mesmo desenho dos agentes da Plow e da
Instinct. O pacote declara quem é o agente, o que ele sabe consultar, o que o
primeiro uso pergunta e como ele faz login. Trocar o pacote troca o agente:

```bash
SABIA_AGENTE=outro npm start   # roda src/agentes/outro
```

Como criar uma capacidade nova, ou um agente inteiro, está em
[`docs/arquitetura.md`](docs/arquitetura.md).

## Onde ficam os dados

Tudo que é da pessoa mora em **`~/.sabia`**, fora do repositório:

- `config.json`: chaves, conta e nome (permissão 600)
- `navegador/`: a sessão, com o "confiar neste dispositivo" de 30 dias
- `conversas/`: as conversas salvas da barra lateral

Variáveis de ambiente vencem o que está lá (e a tela não consegue trocá-las).
Ainda dá para usar um `.env` na raiz, no formato do [`.env.example`](.env.example):
na primeira execução ele é importado para o `~/.sabia`.

## O código de verificação (2FA)

O ClassApp permite **confiar no dispositivo por 30 dias**, então normalmente o
código não é pedido. Se a sessão expirar, o agente **para sozinho na tela de
verificação** e pede os 6 dígitos na própria conversa. A dona da conta digita o
código que chegou no celular dela, e ele segue. Se ninguém digitar dentro do
prazo, ele desiste e avisa. Nada é contornado.

## Desenvolvendo

```bash
npm run dev        # o agente, reiniciando a cada mudança (porta 8123)
npm run dev:web    # a tela no Vite, com recarga instantânea (porta 5173)
npm run check      # tipos do servidor e da tela
npm test           # 96 testes, sem rede e sem navegador, menos de 1s
npm run test:real  # as 5 capacidades contra os sistemas reais
npm run bench      # compara motores no trabalho real do agente
```

`npm test` cobre a lógica que já errou de verdade neste projeto, com funções
puras e dados fictícios no formato real das telas:

- qual coluna do boletim é a média (e não uma prova solta do outro semestre)
- `passou` do calendário, e "evento de hoje não é passado"
- hoje e amanhã na grade, sem depender do modelo
- "Não houve" e "Sem tarefa." no diário não viram tarefa
- contratos recusam ferramenta e intenção inventadas
- o laço: argumentos chegam à ferramenta, a fonte vem do plano, parar no meio para
- o núcleo com um agente de brinquedo, ponta a ponta pelo servidor

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
- **Nenhum dado pessoal no código.** Nome, conta e chaves vivem no `~/.sabia`.
  Os testes usam dados fictícios no formato real.
- **No telão, o mínimo.** Os dados lidos de cada fonte ficam recolhidos; o
  boletim inteiro só aparece se alguém abrir.

## Estrutura

```
src/
  cli.ts          ponto de entrada (iniciar, doctor)
  nucleo/         o harness: laço, motores, protocolo, servidor, config
  agentes/sabia/  o pacote: persona, capacidades, login, mascote
web/              a tela (React + shadcn, no padrão do blocks.so)
ui/               a tela antiga, em /classico, até a nova ser aprovada
test/             unidade (sem rede) e integração (sistemas reais)
docs/             slides, roteiro da apresentação, arquitetura, mascote
scripts/          PDF dos slides, geração do mascote, benchmark de motores
offline/          primeira versão, simulação com dados fictícios
```

## Licença

[MIT](LICENSE)
