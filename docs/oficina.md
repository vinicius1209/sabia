# Sabiá numa oficina: 30 máquinas de Windows, quatro sessões no dia

O caminho normal ([`instalar.md`](instalar.md)) não serve aqui. Ele precisa de
três coisas que um laboratório de escola não dá:

- **administrador**, para instalar o Node;
- **internet**, 150 MB de navegador por máquina (30 máquinas = 4,5 GB, juntos);
- **memória da máquina**, e laboratório costuma reiniciar limpo.

O pacote portátil não precisa de nenhuma das três.

## O pacote

Um ZIP de **368 MB** (uns 870 MB e 7,6 mil arquivos depois de extrair),
anexado em cada versão no GitHub (`sabia-windows-<versão>.zip`), montado pelo
CI num runner Windows. Dentro:

```
Sabia/
  node/node.exe        o Node (no Windows, o .exe se basta)
  app/node_modules/    o Sabiá, o Playwright, o Express
  ms-playwright/       o Chromium já baixado
  Sabia.bat            o duplo clique
  Sabia-sem-IA.bat     o plano B
  LEIA-ME.txt          o mesmo recado, para quem abrir a pasta
  dados/              (nasce no primeiro uso)
```

Nada é instalado, nada vai para o registro do Windows, nada é baixado na hora.
O `.bat` aponta `SABIA_HOME` e `PLAYWRIGHT_BROWSERS_PATH` para dentro da
própria pasta.

Para montar na mão, num Windows: `npm run build:windows`.

## Na véspera

1. Baixe o `sabia-windows-<versão>.zip` da versão mais recente **uma vez**.
2. Extraia, abra o `Sabia.bat` no Bloco de Notas e troque `COLE-A-CHAVE-AQUI`
   pela chave da DeepSeek, na linha

   ```bat
   set "CHAVE=COLE-A-CHAVE-AQUI"
   ```

   **Faça isso uma vez, aqui**, e não em 30 máquinas.
3. **Compacte a pasta `Sabia` de novo** (botão direito → Enviar para → Pasta
   compactada) e ponha esse ZIP no pendrive.

O passo 3 parece bobo, mas não é: a pasta extraída tem 7,6 mil arquivos, e
copiar isso de um pendrive leva minutos por máquina. Um ZIP único de 368 MB
copia em segundos, e extrair no disco local é rápido.

Se você vai usar mais de uma chave (ver abaixo), faça um ZIP por grupo, cada
um com a sua chave.

Use pendrive **USB 3.0**. Em USB 2.0, 368 MB levam uns 2 minutos por máquina,
e com 30 máquinas isso vira uma hora de oficina perdida. Dois ou três
pendrives em paralelo também resolvem.

## No dia, em cada máquina

1. Copie o ZIP do pendrive para a **Área de Trabalho** e extraia ali (botão
   direito → Extrair tudo). Precisa de uns 1,3 GB livres. Não rode do
   pendrive: o Chromium em USB 2.0 é lento o bastante para estragar a oficina.
2. Entre na pasta `Sabia` e dê duplo clique no `Sabia.bat`.
3. O Windows vai dizer "O Windows protegeu o seu computador": **Mais
   informações → Executar assim mesmo**. É por não ter assinatura digital paga.
4. A tela abre no navegador. O aluno escolhe a IA, preenche a conta dele e faz
   o primeiro login — o código de dois fatores é pedido na própria tela.

Baixar o ZIP do GitHub em 30 máquinas ao mesmo tempo **não** é uma alternativa:
são 11 GB pela internet da escola, o mesmo problema que o pacote resolve.
Pendrive, ou uma máquina baixa e compartilha na rede local.

## Entre as sessões

**Apague a pasta `dados`.** Ela guarda a conta, a sessão do navegador e as
conversas de quem usou. Sem apagar, o aluno das 14h abre o Sabiá já dentro da
conta do aluno das 10h.

Com a pasta `dados` dentro do pacote (e não em `C:\Users\<você>\.sabia`),
apagar é só apagar a pasta — não sobra nada no perfil do Windows.

## As chaves da IA

A oficina usa chave de API da DeepSeek, que o `.bat` entrega por
`SABIA_PADRAO_LLM_PROVIDER=deepseek` e `SABIA_PADRAO_DEEPSEEK_API_KEY`.

O prefixo `SABIA_PADRAO_` quer dizer **palpite inicial, e não trava**: valem
quando ninguém escolheu outra coisa, e a tela ainda consegue trocar por cima,
em **Ajustes → Motor de IA**. É o que salva a sessão se a chave furar no meio
da oficina — cola-se outra na tela, sem fechar nada e sem Bloco de Notas. A
troca vale naquela máquina até alguém apagar a pasta `dados`; depois volta a
valer a chave do `.bat`.

(Variável de ambiente comum, sem o prefixo, o Sabiá não deixa a tela trocar —
era assim antes, e deixava a oficina presa à chave que veio do pendrive.)

Dois cuidados:

**Divida em mais de uma chave.** Uma chave para 30 máquinas × 4 sessões é um
ponto único de falha: se ela for estrangulada ou o saldo acabar na segunda
oficina, as quatro caem juntas. Três ou quatro chaves, uma por grupo de
máquinas, limitam o estrago.

**A chave fica legível no `.bat`.** Qualquer aluno abre no Bloco de Notas e
copia. Para uma oficina isso é aceitável, mas use chave com limite de gasto e
**troque todas depois do evento**.

## Quando algo dá errado

| sintoma | o que fazer |
|---|---|
| "O Windows protegeu o seu computador" | Mais informações → Executar assim mesmo |
| a janela preta pisca e fecha | ela não deveria: o `.bat` tem `pause` no erro. Se fechou mesmo, a pasta foi copiada pela metade |
| "A chave da IA nao foi preenchida" | o passo 2 da véspera não foi feito nesta cópia. O Sabiá sobe assim mesmo: dá para colar a chave em Ajustes → Motor de IA |
| "A porta 8123 já está em uso" | já tem um Sabiá aberto nessa máquina |
| o aluno não recebe o código de dois fatores | pavilhão de feira mata o sinal de celular. Tenha contas de demonstração de reserva |
| o aluno quer trocar a conta do ClassApp | Ajustes → a seção da conta → salvar → **Conectar**. Não é no `.bat`: a conta só existe na tela |
| a chave estrangulou ou acabou o saldo | cole outra em Ajustes → Motor de IA, sem fechar o Sabiá |
| a IA parou de responder no meio | troque para o `Sabia-sem-IA.bat`: ele continua lendo os dados reais, respondendo por regras |
| nada funciona, a rede caiu | abra o `offline/index.html` do repositório: é a simulação com dados fictícios |

## O que preparar além do pacote

- **Contas de reserva.** O dois fatores depende de sinal de celular, e
  pavilhão de feira não tem. Alguns alunos vão travar aí.
- **Dado real na tela.** Se os participantes têm conta de verdade, o Sabiá lê
  dado real de aluno em 30 telas ao mesmo tempo. O agente é somente leitura e
  existe a máscara do telão, mas confira se ela cobre a tela do aluno e não só
  a projeção.
