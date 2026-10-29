# Oficina de 1 hora: programação, agentes, e o Sabiá no meio

> **Formato:** laboratório, turma sentada em frente a uma máquina cada.
> **Equipe:** duas pessoas. Uma conduz do telão, a outra anda pela sala.
> **O aluno não faz login em lugar nenhum.** A parte prática roda em
> [`oficina/index.html`](../oficina/index.html): um arquivo, dado fictício, sem
> internet, sem conta, sem chave de IA.
>
> Este é o roteiro da **oficina**. O da apresentação sentada, sem máquina para
> o aluno, continua em [`apresentacao.md`](apresentacao.md), e os dois usam os
> mesmos slides.

---

## A ideia que amarra a hora

Não são três assuntos (programação, depois agentes, depois conclusão). É **um
agente em três degraus**, e o aluno sobe o primeiro com as próprias mãos:

| degrau | quem faz | o que é |
|---|---|---|
| 1 · regra + dado de brinquedo | **o aluno**, nos primeiros 23 min | `oficina/index.html` |
| 2 · regra + dado real | o Sabiá no **Sem IA** | o plano B do seletor |
| 3 · IA + dado real | o Sabiá completo | a demonstração no telão |

A frase que faz a virada, lá pelo minuto 23:

> "O que vocês acabaram de escrever é a mesma coisa que o Sabiá faz. A diferença
> é que o de vocês tem nota inventada num arquivo, e o dele está entrando no
> portal da escola agora."

Isso não é comparação: é literalmente o mesmo desenho. O degrau 2 existe de
verdade no Sabiá, e é por isso que a ponte se sustenta.

---

## A hora

Mão no teclado no minuto 3, não no minuto 30. Ninguém senta numa oficina para
assistir slide.

| min | o quê | quem conduz | quem anda pela sala |
|---|---|---|---|
| 0–3 | abertura, sem slide | abre a página no telão | confere máquina por máquina |
| 3–8 | **Passo 1** · seu nome, sua matéria | dita o passo | atende quem travou |
| 8–14 | **Passo 2** · uma regra nova | dita e narra | atende |
| 14–19 | **Passo 3** · o erro que já estava lá | conduz a descoberta | atende |
| 19–23 | **Passo 4** · quebre de propósito | dita a sabotagem | atende |
| 23–26 | a ponte · três fases, três degraus | slides 7 e 6 | abre o Sabiá real |
| 26–38 | **o Sabiá ao vivo**, dado de verdade | narra o navegador | digita as perguntas |
| 38–46 | **tentem enganar o Sabiá** | provoca a turma | digita |
| 46–52 | o que eu aprendi errando | slides 8 a 11, curtos | — |
| 52–60 | profissões, e como levar pra casa | slide 14 | — |

**Se atrasar**, corte o Passo 4 (os minutos 19–23): a lição dele volta inteira
nos slides 8 a 11. **Se sobrar**, estique o "tentem enganar". Nunca corte a
demonstração ao vivo nem o Passo 3 — são os dois momentos que a turma lembra.

---

## Antes da turma entrar

A página precisa estar **aberta em cada máquina**. Em ordem de preferência:

1. **Uma URL na rede do laboratório.** Numa máquina com a pasta do projeto:

   ```bash
   npx --yes serve oficina -l tcp://0.0.0.0:8080
   ```

   O `tcp://0.0.0.0` não é enfeite: sem ele o `serve` atende só a própria
   máquina, e nenhum aluno abre a página. Para achar o endereço a escrever no
   quadro: `ipconfig getifaddr en0` no macOS, `ipconfig` no Windows. A turma
   digita `http://<esse-ip>:8080`.

   É dado fictício, então servir na rede local não tem problema nenhum — a
   regra do `HOST=127.0.0.1` do Sabiá existe para proteger **nota real**, e
   aqui não tem nota de ninguém. Teste de uma segunda máquina antes da turma
   chegar: firewall de laboratório às vezes bloqueia porta alta.
2. **A pasta pública do laboratório.** Copie `oficina/index.html` para o
   compartilhamento da escola e passe o caminho.
3. **Pendrive.** São 40 KB: copia em um segundo, ao contrário do pacote do
   Sabiá.

Confira antes: **abra a página e clique em Conferir.** Tem que dar **4 de 5** —
o teste vermelho é o erro do Passo 3, e ele é de propósito.

**Entre as sessões, feche a aba.** O código do aluno vive na aba (`sessionStorage`)
e morre com ela. Se a aba continuar aberta, a turma seguinte herda o assistente
da turma anterior — o mesmo cuidado da pasta `dados` em [`oficina.md`](oficina.md).
O botão **Voltar ao começo** resolve caso a caso.

### Checklist

- [ ] a página abre em todas as máquinas, pelo caminho escolhido
- [ ] **Conferir** dá 4 de 5 numa máquina de teste
- [ ] o telão mostra a página em tamanho legível do fundo da sala
- [ ] o Sabiá real já está aberto e aquecido na máquina da dupla (rodar as 4
      perguntas da demo uma vez — a primeira é sempre a mais lenta)
- [ ] `npm run doctor -- --fontes` com as cinco fontes lidas com segurança
- [ ] celular da dona da conta por perto (código 2FA)
- [ ] `offline/index.html` aberto numa aba, caso a rede caia na hora da demo

---

## Minutos 0 a 3 · a abertura

Sem slide. A página no telão, e uma frase:

> "O computador não sabe nada. Ele faz exatamente o que está escrito, e nada
> além disso. Em vinte minutos vocês vão escrever um assistente de escola, achar
> um erro nele, e consertar."

Enquanto isso, quem anda pela sala confere que a página abriu em todas as
máquinas. **Não comece o Passo 1 antes disso** — um aluno sem a página na tela
nos primeiros três minutos está perdido pela hora inteira.

---

## Minutos 3 a 23 · os quatro passos

A página conduz: cada passo tem a instrução e o trecho a digitar. **Mas quem
marca o ritmo é o telão, não o aluno.** Todos no mesmo passo, no mesmo minuto.
Exploração livre com trinta máquinas e duas pessoas vira trinta erros
diferentes e a hora perdida.

Em cada passo: leia a instrução em voz alta, **mande digitar** (o botão
`copiar` existe para quem travou, não para a turma inteira), espere, e só então
mande clicar em **▶ Rodar**.

### Passo 1 · Ponha você no código (minutos 3 a 8)

O aluno troca o nome e acrescenta uma matéria. O assistente passa a chamá-lo
pelo nome e a responder a nota que ele mesmo inventou.

> "Repara no que aconteceu: você escreveu um número num arquivo, e ele passou a
> saber esse número. Ele não aprendeu nada. Ele leu."

**O fecho do passo** é mandar perguntar a nota de uma matéria que ninguém
escreveu:

> "Ele podia ter chutado um número. Nenhum número seria mais errado que o outro.
> Ele disse que não sabe. Guardem isso, a gente volta nisso no fim."

### Passo 2 · Uma capacidade nova (minutos 8 a 14)

Quatro linhas, e o assistente responde uma coisa que não respondia um minuto
atrás. Use a palavra do projeto:

> "Isso tem nome: vocês deram uma **capacidade** nova a ele. O Sabiá tem cinco,
> e cada uma é um pedaço de código como esse — só que em vez de devolver um
> texto que vocês escreveram, ele vai buscar num sistema da escola."

Este é o passo com mais chance de erro de digitação (parêntese, chave, crase).
A página avisa em português e diz a linha. Quem anda pela sala resolve isso —
é o momento de mais corrida.

### Passo 3 · O erro que já estava lá (minutos 14 a 19)

**O melhor momento da hora.** Não entregue a resposta. Mande perguntar
*"quais trabalhos estão pendentes?"*, deixe a turma ler a tela, e espere.

> "Olhem as datas que ele devolveu. Agora olhem a data de hoje, ali no canto."

Alguém vai gritar. Espere alguém gritar.

> "Ele está mandando vocês entregarem trabalho que venceu faz um mês, com toda a
> confiança do mundo. E ele não está mentindo — **ninguém contou a ele que dia é
> hoje**. Esse é o erro mais perigoso que existe: ele parece certo."

Aí vem o conserto, de uma linha. E depois dele, a frase que é a tese do projeto
inteiro:

> "Reparem quem consertou. Não foi a inteligência artificial. Foi o código.
> **Tudo que o código consegue calcular, o código calcula.**"

Mande clicar em **Conferir**: o teste que estava vermelho desde que a página
abriu fica verde. É a primeira vez que a turma vê um teste servindo para
alguma coisa.

### Passo 4 · Quebre de propósito (minutos 19 a 23)

Apagar `|boletim` e ver cinco testes virarem quatro.

> "Teste que nunca falha não serve para nada. Eu escrevi quase 180 testes para o Sabiá
> e **quebrei meu próprio código de propósito** para ver se eles acusavam.
> Quando eu estraguei a média, seis acusaram. Ótimo. Quando eu tirei uma palavra
> de um filtro — exatamente o que vocês acabaram de fazer — **nenhum** acusou.
> O teste era fraco, e eu não sabia."

É o slide 11 inteiro, e a turma acabou de viver a parte difícil.

---

## Minutos 23 a 26 · a ponte

Dois slides, rápido. O **7** (as três fases) e o **6** (agente, não chatbot).

> "O que vocês escreveram tem as regras e tem o dado, os dois na mão de vocês.
> O Sabiá separa: a IA lê a pergunta e decide o que buscar, o código vai buscar
> no sistema da escola, e a IA escreve a resposta. **A IA decide, o código age.**"

E a frase dos três degraus (lá em cima). Enquanto isso, a outra pessoa da dupla
põe o Sabiá real no telão, ao lado do navegador que ele opera.

---

## Minutos 26 a 38 · o Sabiá ao vivo

Igual à apresentação: as quatro perguntas, uma digita e a outra narra o
navegador. O roteiro falado e os cuidados (a máscara do telão, o 2FA, o
"não fique em silêncio") estão em
[`apresentacao.md`](apresentacao.md), na seção *Demonstração (slide 5)*.

Uma frase a mais, que só funciona nesta versão da sessão:

> "O de vocês demorou meio segundo para responder. Esse aqui demora quase um
> minuto. A diferença é que o de vocês leu um arquivo que vocês escreveram, e
> esse está abrindo o portal, fazendo login e lendo a tela agora."

E, quando a turma reclamar da demora, é a deixa do degrau 2:

> "Dá pra ir mais rápido." *(troca o motor para **Sem IA**)* "Agora ele responde
> na hora, por regras de palavra — igualzinho ao de vocês. E continua lendo a
> nota de verdade. O que ele perdeu foi entender pergunta torta."

---

## Minutos 38 a 46 · tentem enganar o Sabiá

A turma grita a pergunta, a dupla digita, todo mundo vê no telão. As quatro
pegadinhas estão no slide 15 e na tabela da
[`apresentacao.md`](apresentacao.md#tentem-enganar-o-sabiá-slide-15).

Nesta versão tem um gancho a mais: a turma já viu um assistente dizer "não sei"
no Passo 1.

> "Lembram que o de vocês não chutou a nota de uma matéria que não existia?
> Vamos ver se esse chuta."

Se ele errar alguma: **comemore.** "Boa, anota aí, é assim que se acha bug."

---

## Minutos 46 a 60 · o fecho

**Errando (46–52).** Slides 8 a 11, agora bem curtos — a turma já sentiu na mão
o que eles contam. O slide 8 (a data) tem o melhor fecho possível:

> "Esse é o mesmo erro que vocês consertaram no Passo 3. Eu levei três semanas
> para achar. Vocês levaram dois minutos, porque eu já sabia onde estava."

**Profissões e levar pra casa (52–60).** Slide 14, e o endereço:

> "A página que vocês mexeram cabe num anexo de e-mail. O Sabiá inteiro está no
> GitHub, de graça, com todos os testes à vista. Dá pra começar com lógica, um
> pouco de Python ou JavaScript, e um problema que seja seu."

---

## Quando algo dá errado

| sintoma | o que fazer |
|---|---|
| a página não abre numa máquina | mande o aluno dividir a tela com o colega do lado; dois por máquina funciona bem nos quatro passos |
| "Não rodou" e o aluno não acha o erro | clique no **ir para a linha** do próprio aviso; ele seleciona a linha |
| o aluno se perdeu e não quer mais mexer | **Voltar ao começo**, e entra no próximo passo junto com a turma |
| a página congelou | recarregue (F5): o código dele volta, porque mora na aba |
| a turma inteira travou no mesmo ponto | pare, projete a sua tela e faça o passo junto, linha por linha |
| **Conferir** dá 4 de 5 e ninguém mexeu ainda | é o esperado: o teste vermelho é o erro do Passo 3 |
| rede caiu antes da demo | `offline/index.html`, simulação com dado fictício |
| o resto (2FA, motor lento, página mudou) | o plano B da [`apresentacao.md`](apresentacao.md#plano-b) |

---

## Por que este formato, e não os alunos no Sabiá de verdade

O pacote portátil de Windows ([`oficina.md`](oficina.md)) põe o Sabiá rodando em
trinta máquinas sem instalar nada. Ele funciona, mas numa hora com duas pessoas
ele custa caro:

- **o login.** Cada aluno na própria conta significa trinta primeiros acessos, e
  o código de dois fatores depende de sinal de celular;
- **a chave da IA.** Trinta máquinas × quatro sessões numa chave só é um ponto
  único de falha, e a chave fica legível no `.bat`;
- **o dado real.** Nota de verdade em trinta telas ao mesmo tempo;
- **o tempo.** Copiar e extrair 368 MB por máquina.

Nenhum desses existe quando a parte prática é um arquivo de 40 KB com dado
inventado, e o dado real aparece só no telão, numa conta só, com autorização da
dona dela.

O pacote portátil continua valendo para **duas horas ou mais**, quando dá tempo
de levar a turma ao degrau 2. Para uma hora, ele cobra mais do que entrega.
