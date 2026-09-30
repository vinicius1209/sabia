# Sabiá · Exposalê

> **Formato:** ~1h por ciclo, em laboratório de informática, turma sentada.
> Ciclos 2, 3, 5 e 6: a mesma sessão, 4 vezes, para 4 turmas.
> **Os alunos não acessam o Sabiá do computador deles.** Ele fica preso a esta
> máquina (`HOST=127.0.0.1`), e isso vira assunto no slide 12.

Arquivos:
- `Sabia-ExpoSale.pdf` · os 15 slides (gerar de novo com `npm run pdf`)
- `slides.html` · a fonte dos slides
- `marca/` · o mascote nas 7 poses, com fundo transparente

---

## A dupla

- **Vinicius** · conduz, explica, responde as perguntas técnicas
- **Nathalia** · digita no chat, e na parte final é quem digita as perguntas da turma

Os dois são **apresentadores convidados**. Falem com a turma ("vocês"), não como
colega de sala. A conta usada é da irmã do Vinicius, **com a autorização dela**.

---

## Como preencher 1 hora

Slide não sustenta uma hora. O que sustenta é a demonstração e o desafio.

| tempo | o quê | slides |
|---|---|---|
| 5 min | turma chega e senta | 1 no ar |
| 5 min | o problema | 2 e 3 |
| 3 min | como ler o mascote | 4 |
| **12 min** | **demonstração ao vivo** | 5 |
| 6 min | o que é um agente, e as três fases | 6 e 7 |
| **12 min** | **o que eu aprendi errando** (o melhor pedaço) | 8 a 11 |
| 4 min | cuidados, e o que ele ainda não é | 12 e 13 |
| 3 min | profissões | 14 |
| **10 min** | **tentem enganar o Sabiá** | 15 |

Se sobrar tempo, estique o desafio. Se faltar, encurte o slide 7 e o 13.

---

## Roteiro falado

### O problema (slides 2 e 3)
> "Quem aqui usa o ClassApp? E quem já entrou no Portal do Aluno pra ver nota?
> São cinco coisas que vocês consultam, espalhadas em dois sistemas, com dois logins."

Slide 3, a pergunta que guiou tudo:
> "E se, em vez de vocês aprenderem dois sistemas, um agente usasse os dois por vocês?"

### Fica de olho no Sabiá (slide 4)
Prepara o olhar da turma para a demo:
> "O passarinho muda conforme o que ele está fazendo. Pensando, buscando, pronto,
> ou confuso quando algo dá errado. Um bom agente não te deixa no escuro."

### Demonstração (slide 5) · não corte, é o coração
Nathalia digita, Vinicius narra o navegador ao lado:
1. "Como estou no boletim?" → ele abre o Portal do Aluno na frente de todos
2. "Quando é a próxima prova?" → acha a data futura certa
3. "E em física?" → entende pergunta de continuação
4. "Tem tarefa de segunda?" → vai no diário daquele dia

Enquanto roda:
> **"Repara que ele não tem resposta pronta. Ele está entrando no sistema agora."**

O boletim leva uns 20 segundos. **Não fique em silêncio**, narre o que o avatar
mostra: "tá pensando... agora entrou no portal... achou."

### O que é um agente (slides 6 e 7)
> "Um chatbot só conversa. Um agente percebe, decide, age, e tem um objetivo.
> O Sabiá opera um software que não foi feito pra ele."

> "Ele planeja o que buscar, vai buscar, e responde citando a fonte.
> **A IA decide, mas quem age é o código.**"

### Aprendi errando (slides 8 a 11) · o que mais impressiona
Projeto que "funciona" tem muito. Projeto que mostra **como o autor sabe que
funciona** quase não tem. Conte como história, na ordem:

- **8, a data:** "Ele dizia que a próxima prova era dia 9. Só que já era dia 26.
  Uma IA não sabe que dia é hoje. Eu tive que contar pra ela."
- **9, a coluna:** "Mostrava 6,0 em Física, e a média era 8,5. Ele lia a coluna errada."
- **10, a certeza:** "Esse é o pior tipo de erro: ele respondia com toda a certeza, e
  estava errado. Pedi a tarefa de segunda e ele me mostrou a de hoje."
- **11, a sabotagem:** "Aí eu escrevi 70 testes e **quebrei meu próprio código de
  propósito**. Quando eu estraguei a média, 4 testes acusaram. Ótimo. Quando eu tirei
  uma palavra de um filtro, **nenhum** acusou. O teste era fraco, e eu não sabia."

### Cuidados (slides 12 e 13)
Fale antes de perguntarem:
> "Ele só lê, nunca manda mensagem nem muda nada. E só funciona neste computador.
> Por isso vocês não usam do computador de vocês: qualquer um na rede veria as
> notas dela."

No 13, seja honesto sobre o limite: cada conversa nova começa do zero (ele não junta o que aprendeu em uma com a outra) e ele não atende a escola
inteira. Isso passa mais confiança do que prometer tudo.

### Profissões (slide 14)
> "Isso é o que empresas de agentes de IA fazem, em escala de empresa. Dá pra
> começar com lógica, um pouco de Python ou JavaScript, e um problema seu."

### Tentem enganar o Sabiá (slide 15)
A turma grita a pergunta, **a Nathalia digita**, todo mundo vê no telão.
Os quatro tipos de pegadinha do slide foram testados de verdade:

| pegadinha | exemplo | o que ele faz |
|---|---|---|
| matéria que não existe | "qual minha nota de astronomia?" | diz que não está no boletim, não inventa |
| prova que já passou | "quando é a prova de história?" | avisa que já foi, e que não tem outra |
| tarefa de outro dia | "qual foi a tarefa de sexta passada?" | calcula a data e abre o diário daquele dia |
| não é da escola | "quem ganhou a copa de 2022?" | recusa com simpatia, não responde de memória |

Se ele errar alguma: **comemore**. "Boa, anota aí, é assim que se acha bug." É a
mesma lição dos slides 8 a 11, ao vivo.

---

## Se pedir o código 2FA, comemore

Não é problema, é um dos melhores momentos:
> "Olha, ele **parou sozinho** e está pedindo autorização. Ele não guarda a senha
> de ninguém. Só a dona da conta pode liberar."

A dona da conta digita o código que chegou no celular dela, e vocês acabaram de
responder a pergunta de segurança antes de ela ser feita. Se ninguém digitar em
3 minutos, ele desiste sozinho e avisa.

---

## Plano B

| problema | solução |
|---|---|
| internet ruim para a IA | no seletor da caixa de pergunta, troque para **Sem IA** · continua lendo os sistemas de verdade |
| a chave da OpenAI falhou | troque para **Claude pela assinatura** no mesmo seletor |
| sem internet nenhuma | `offline/index.html` · simulação com dados fictícios |
| o 2FA não chega | siga pelos slides 6 a 14 e volte à demo depois |
| ele erra uma pergunta | "boa, anota aí, é assim que eu acho bug" |

## Checklist antes de cada ciclo

- [ ] `npm run doctor` com tudo marcado, e `npm test` passando
- [ ] rodar as 4 perguntas da demo uma vez (a primeira é mais lenta, aquece o navegador)
- [ ] janela do navegador ao lado do chat, as duas visíveis no projetor
- [ ] celular da dona da conta por perto (código 2FA)
- [ ] notebook na tomada
- [ ] slide 1 no ar enquanto a turma senta
