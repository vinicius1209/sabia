# Sabiá · Exposalê

> **Formato:** ~1h por ciclo, em laboratório de informática, turma sentada.
> Ciclos 2, 3, 5 e 6: a mesma sessão, 4 vezes, para 4 turmas.
> **Os alunos não acessam o Sabiá do computador deles.** Ele fica preso a esta
> máquina (`HOST=127.0.0.1`), e isso vira assunto no slide 15.

**A apresentação que vai no telão são os 19 slides do Google Slides:**
<https://docs.google.com/presentation/d/1EfQsSfBFS8g0mUrLuA9ZIwIy_bZQS5yo_G7PyhNe4EE/edit>

Arquivos:
- `Sabia-ExpoSale.pdf` · a versão anterior, de 15 slides, **com a numeração antiga**
- `slides.html` · a fonte daquele PDF (gerar de novo com `npm run pdf`)
- `marca/` · o mascote nas 7 poses, com fundo transparente

Os números deste roteiro seguem o Google Slides, não o PDF.

---

## A dupla

- **Vinicius** · conduz, explica, responde as perguntas técnicas
- **Nathália** · digita no chat, e na parte final é quem digita as perguntas da turma

Os dois são **apresentadores convidados**. Falem com a turma ("vocês"), não como
colega de sala. A conta usada é da Nathália, **com a autorização dela** — e agora
isso é dito logo na abertura, nos slides 2 e 3, não só lá no 15.

---

## Como preencher 1 hora

Slide não sustenta uma hora. O que sustenta é a demonstração e o desafio.

| tempo | o quê | slides |
|---|---|---|
| 4 min | turma chega e senta | 1 no ar |
| 4 min | quem somos, e de onde veio a ideia | 2 e 3 |
| 4 min | o problema | 4 e 5 |
| 3 min | como ler o mascote | 6 |
| **12 min** | **demonstração ao vivo** | 7 |
| 6 min | o que é um agente, e as três fases | 8 e 9 |
| **12 min** | **o que eu aprendi errando** (o melhor pedaço) | 10 a 14 |
| 4 min | cuidados, e o que ele ainda não é | 15 e 16 |
| 2 min | profissões | 17 |
| **9 min** | **tentem enganar o Sabiá** | 18 |
| — | fechamento, no ar enquanto a turma sai | 19 |

Se sobrar tempo, estique o desafio. Se faltar, encurte o slide 9 e o 16.

---

## Roteiro falado

### Quem somos (slides 2 e 3)
Abre apresentando os dois, e já entrega de quem é a conta da demo:
> "Somos irmãos. Eu construí o Sabiá, e ela é a aluna que ele atende.
> Tudo o que vocês vão ver sai da conta dela, com a autorização dela."

No 3, a origem do projeto:
> "O problema era dela, não meu. Ela reclamava que pra ver nota entrava num
> sistema, e pra ver prova entrava em outro. Eu sou irmão dela, e programador."

Esse par faz dois trabalhos: apresenta a dupla e já responde a pergunta de
privacidade antes de ela ser feita.

### O problema (slides 4 e 5)
> "Quem aqui usa o ClassApp? E quem já entrou no Portal do Aluno pra ver nota?
> São cinco coisas que vocês consultam, espalhadas em dois sistemas, com dois logins."

Slide 5, a pergunta que guiou tudo:
> "E se, em vez de vocês aprenderem dois sistemas, um agente usasse os dois por vocês?"

### Fica de olho no Sabiá (slide 6)
Prepara o olhar da turma para a demo:
> "O passarinho muda conforme o que ele está fazendo. Pensando, buscando, pronto,
> ou confuso quando algo dá errado. Um bom agente não te deixa no escuro."

### Demonstração (slide 7) · não corte, é o coração
Nathália digita, Vinicius narra o navegador ao lado:
1. "Como estou no boletim?" → ele abre o Portal do Aluno na frente de todos
2. "Quando é a próxima prova?" → acha a data futura certa
3. "E em física?" → entende pergunta de continuação
4. "Tem tarefa de segunda?" → vai no diário daquele dia

Enquanto roda:
> **"Repara que ele não tem resposta pronta. Ele está entrando no sistema agora."**

Na feira o motor é o **Automático (Claude pela assinatura)**, e cada pergunta de
boletim leva **perto de 1 minuto**: uns 15 s planejando, 15 s lendo o portal e
20 s escrevendo. As quatro perguntas somam uns 5 minutos. **Não fique em
silêncio**, narre o que o avatar mostra: "tá pensando... agora entrou no
portal... achou... tá escrevendo."

No navegador ao lado, **nome, foto, matrícula, nascimento e filiação aparecem
borrados** de propósito (as notas não). Se alguém perguntar:
> "O Sabiá lê tudo, mas o telão só mostra o que precisa. O borrão é só na tela."

### O que é um agente (slides 8 e 9)
> "Um chatbot só conversa. Um agente percebe, decide, age, e tem um objetivo.
> O Sabiá opera um software que não foi feito pra ele."

> "Ele planeja o que buscar, vai buscar, e responde citando a fonte.
> **A IA decide, mas quem age é o código.**"

### Aprendi errando (slides 10 a 14) · o que mais impressiona
Projeto que "funciona" tem muito. Projeto que mostra **como o autor sabe que
funciona** quase não tem. Conte como história, na ordem:

- **10, a abertura do bloco:** slide escuro, só pra marcar que mudou de assunto.
  Respire aqui. "Agora a melhor parte: o que deu errado."
- **11, a data:** "Ele dizia que a próxima prova era dia 9. Só que já era dia 26.
  Uma IA não sabe que dia é hoje. Eu tive que contar pra ela."
- **12, a coluna:** "Mostrava 6,0 em Física, e a média era 8,5. Ele lia a coluna errada."
- **13, a certeza:** "Esse é o pior tipo de erro: ele respondia com toda a certeza, e
  estava errado. Pedi a tarefa de segunda e ele me mostrou a de hoje."
- **14, a sabotagem:** "Aí eu escrevi quase 180 testes e **quebrei meu próprio código de
  propósito**. Quando eu estraguei a média, 6 testes acusaram. Ótimo. Quando eu tirei
  uma palavra de um filtro, **nenhum** acusou. O teste era fraco, e eu não sabia."

### Cuidados (slides 15 e 16)
Fale antes de perguntarem:
> "Ele só lê, nunca manda mensagem nem muda nada. E só funciona neste computador.
> Por isso vocês não usam do computador de vocês: qualquer um na rede veria as
> notas dela. E repararam que o nome dela apareceu borrado no navegador? Isso
> também foi pensado."

Como a conta da Nathália já foi citada no slide 2, aqui é só retomar: "lembra que
eu disse que a conta é dela?"

No 16, seja honesto sobre o limite: cada conversa nova começa do zero (ele não junta o que aprendeu em uma com a outra) e ele não atende a escola
inteira. Isso passa mais confiança do que prometer tudo.

### Profissões (slide 17)
> "Isso é o que empresas de agentes de IA fazem, em escala de empresa. Dá pra
> começar com lógica, um pouco de Python ou JavaScript, e um problema seu."

### Tentem enganar o Sabiá (slide 18)
A turma grita a pergunta, **a Nathália digita**, todo mundo vê no telão.
Os quatro tipos de pegadinha do slide foram testados de verdade:

| pegadinha | exemplo | o que ele faz |
|---|---|---|
| matéria que não existe | "qual minha nota de astronomia?" | diz que não está no boletim, não inventa |
| prova que já passou | "quando é a prova de história?" | avisa que já foi, e que não tem outra |
| tarefa de outro dia | "qual foi a tarefa de sexta passada?" | calcula a data e abre o diário daquele dia |
| não é da escola | "quem ganhou a copa de 2022?" | recusa com simpatia, não responde de memória |

Se ele errar alguma: **comemore**. "Boa, anota aí, é assim que se acha bug." É a
mesma lição dos slides 11 a 14, ao vivo.

### Fechamento (slide 19)
Deixe no ar enquanto a turma sai. A frase que fecha:
> "Se você reparou num problema, você já começou. Esse aqui nasceu de uma
> reclamação da minha irmã sobre dois logins."

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
| pergunta travou ou demorou demais | **Parar** corta na hora (mata a chamada ao modelo) e libera a próxima |
| internet ruim para a IA | no seletor da caixa de pergunta, troque para **Sem IA** · continua lendo os sistemas de verdade |
| o Claude falhou ou está lento | troque para **OpenAI** (a mais rápida, usa a chave) ou **Antigravity** no mesmo seletor |
| sem internet nenhuma | `offline/index.html` · simulação com dados fictícios |
| o 2FA não chega | siga pelos slides 8 a 17 e volte à demo depois |
| ele erra uma pergunta | "boa, anota aí, é assim que eu acho bug" |
| a janela do navegador ficou em branco | é a máscara falhando **fechada** (prefere não mostrar a mostrar o nome). O chat segue funcionando; continue por ele |
| aviso de "página mudou" no chat | a escola mexeu numa tela. Ele recusa em vez de errar; siga com as outras perguntas |
| o Google Slides não abre na hora | baixe o PDF da apresentação antes de sair de casa (Arquivo · Fazer download · PDF) |

## Checklist antes de cada ciclo

- [ ] `npm run doctor` com tudo marcado, e `npm test` passando
- [ ] `npm run doctor -- --fontes`: as cinco fontes lidas com segurança (✓)
- [ ] motor no seletor da caixa de pergunta: **Automático**, usando o **Claude**
- [ ] se o código foi atualizado, feche e abra o Sabiá de novo (o servidor antigo segue com o código velho)
- [ ] rodar as 4 perguntas da demo uma vez (a primeira é mais lenta, aquece o navegador)
- [ ] conferir no navegador: nome, foto e matrícula **borrados**, notas legíveis
- [ ] janela do navegador ao lado do chat, as duas visíveis no projetor
- [ ] celular da Nathália por perto (código 2FA)
- [ ] notebook na tomada
- [ ] Google Slides aberto em modo apresentação, slide 1 no ar enquanto a turma senta
