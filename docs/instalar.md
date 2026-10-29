# Instalar o Sabiá em outro computador

Funciona no **Windows, macOS e Linux**. Não precisa baixar o código.

> **Laboratório de escola, oficina, muitas máquinas?** Não use este caminho:
> ele pede Node instalado, terminal e 150 MB de download por máquina. Vá para
> [`docs/oficina.md`](oficina.md), que usa o pacote portátil.

## Antes

1. **Node 22.12 ou mais novo.** Baixe a versão LTS em [nodejs.org](https://nodejs.org)
   e instale com as opções padrão. Para conferir, abra o terminal e rode `node -v`.
2. **Uma IA logada no computador**, de preferência pela assinatura (sem gastar
   com chave):
   - **Claude Code**: instale pelo instalador oficial da Anthropic,
     rode `claude` uma vez e faça o login;
   - ou **Codex**: `npm install -g @openai/codex`, rode `codex` uma vez e faça o login.

   Sem nenhuma das duas, o Sabiá ainda funciona com uma chave da OpenAI ou do
   Gemini (configurada na tela), ou no modo sem IA.
3. **Uma conta do ClassApp** que seja sua, ou com autorização de quem é dono dela.

## Rodar

No terminal (no Windows, o **Prompt de Comando** ou o **PowerShell**):

```bash
npx --yes https://github.com/vinicius1209/sabia/releases/latest/download/sabia.tgz
```

Na primeira vez ele baixa o navegador que vai operar (uns 150 MB, uma vez só)
e abre a tela. Ali aparece um guia de três passos: escolher a IA, preencher a
conta e fazer o primeiro login (o código 2FA é pedido na própria tela).

Para fechar, aperte `Ctrl+C` no terminal.

## Deixar instalado

Para não depender do endereço comprido:

```bash
npm install -g https://github.com/vinicius1209/sabia/releases/latest/download/sabia.tgz
```

Daí em diante:

| comando | o que faz |
|---|---|
| `sabia` | sobe o agente e abre a tela |
| `sabia doctor` | diz o que falta para funcionar |
| `sabia doctor --fontes` | entra em cada fonte e confere se lê com segurança |
| `sabia ajuda` | lista os comandos |

Para atualizar, rode o mesmo `npm install -g` de novo. Para remover:
`npm uninstall -g sabia`.

## Onde ficam os dados

Tudo que é da pessoa (conta, sessão do navegador, conversas) fica em `.sabia`,
na pasta do usuário: `~/.sabia` no Mac e no Linux, `C:\Users\<você>\.sabia` no
Windows. Apagar essa pasta zera o Sabiá naquele computador.

O Sabiá só aceita conexões **deste** computador: ninguém na mesma rede acessa.

## Se der problema

| sintoma | o que fazer |
|---|---|
| **Windows/PowerShell:** "npx.ps1 não pode ser carregado porque a execução de scripts foi desabilitada" | use o **Prompt de Comando** (cmd) em vez do PowerShell, ou troque `npx` por `npx.cmd` no comando |
| "O Sabiá precisa do Node 22.12 ou mais novo" | instale a versão LTS do [nodejs.org](https://nodejs.org) e abra um terminal novo |
| "npx" ou "node" não é reconhecido | o Node não foi instalado, ou o terminal foi aberto antes: feche e abra de novo |
| a tela diz que a CLI não está logada | abra o terminal, rode `claude` (ou `codex`) uma vez e faça o login |
| "A porta 8123 já está em uso" | já tem um Sabiá aberto. Feche o outro terminal, ou use outra porta (a mensagem mostra como) |
| não consegue baixar o navegador | confira a internet (rede de escola às vezes bloqueia) e rode de novo |

`sabia doctor` (ou o comando `npx` com `doctor` no fim) mostra o que está faltando.
