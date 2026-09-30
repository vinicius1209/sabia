import path from "node:path";
import { fileURLToPath } from "node:url";
import { definirAgente, type LerConfig } from "../../nucleo/pacote.ts";
import { closeBrowser, ensureLoggedIn, getBrowser } from "./browser.mjs";
import boletim from "./capacidades/boletim.ts";
import calendario from "./capacidades/calendario.ts";
import comunicados from "./capacidades/comunicados.ts";
import diario from "./capacidades/diario.ts";
import horarios from "./capacidades/horarios.ts";

/* ==================================================================
 * O pacote do Sabiá: o agente escolar que opera o ClassApp e o Portal
 * Activesoft. Tudo que é "escola" mora aqui; o núcleo não sabe nada disso.
 *
 * Nome da aluna e da escola vêm da configuração local (~/.sabia),
 * nunca do código: o repositório é público.
 * ================================================================== */

const aqui = path.dirname(fileURLToPath(import.meta.url));

function quemAtende(cfg: LerConfig): string {
  const aluno = cfg("ALUNO_NOME").trim();
  const serie = cfg("ALUNO_SERIE").trim();
  const escola = cfg("ESCOLA_NOME").trim();
  const quem = aluno || "uma aluna";
  const onde = [serie && `do ${serie}`, escola && `do ${escola}`].filter(Boolean).join(" ");
  return `Voce e o assistente escolar de ${quem}${onde ? `, aluna ${onde}` : ""}.`;
}

export { quemAtende };

export default definirAgente({
  id: "sabia",
  nome: "Sabiá",
  descricao: "Consulta o ClassApp e o Portal do Aluno em tempo real. Somente leitura.",

  persona: (cfg) => `${quemAtende(cfg)}
Responde em portugues do Brasil, curto, direto e simpatico.
Se perguntarem algo que nao e da escola (futebol, noticia, conta de matematica,
curiosidade), diga com simpatia que so consulta os sistemas da escola.
Se pedirem uma disciplina que nao aparece nos dados, diga que ela nao esta no
boletim ou no horario. Nunca complete com um valor parecido.
Voce nunca envia mensagem para professor.`,

  saudacao: (cfg) => {
    const nome = cfg("ALUNO_NOME").trim().split(/\s+/)[0];
    return `Oi${nome ? `, ${nome}` : ""}! Eu consulto o ClassApp e o Portal do Aluno em tempo real. Pergunte sobre notas, provas, horários, tarefas ou os avisos da escola.`;
  },

  contexto: (cfg) => [cfg("ESCOLA_NOME"), cfg("ALUNO_NOME")].filter((s) => s.trim()).join(" · "),

  sugestoes: [
    { icone: "📊", texto: "Como estou no boletim?" },
    { icone: "📅", texto: "Quando é minha próxima prova?" },
    { icone: "🕐", texto: "Que aula eu tenho amanhã?" },
    { icone: "📒", texto: "Teve tarefa hoje?" },
    { icone: "📣", texto: "Quais os avisos da escola?" },
  ],

  aviso: "Dados reais, somente leitura. Nada é enviado nem alterado.",

  capacidades: [comunicados, calendario, boletim, horarios, diario],

  campos: [
    {
      chave: "CLASSAPP_PHONE",
      rotulo: "Celular do ClassApp",
      tipo: "telefone",
      obrigatorio: true,
      grupo: "Conta do ClassApp",
      exemplo: "47 99999-0000",
      ajuda: "O mesmo número que você usa em \"Entrar pelo celular\".",
    },
    {
      chave: "CLASSAPP_PASSWORD",
      rotulo: "Senha do ClassApp",
      tipo: "senha",
      obrigatorio: true,
      grupo: "Conta do ClassApp",
      ajuda: "Fica só neste computador, em ~/.sabia. Use só conta sua ou com autorização.",
    },
    {
      chave: "ALUNO_NOME",
      rotulo: "Nome da aluna",
      tipo: "texto",
      obrigatorio: true,
      grupo: "Quem é você",
      exemplo: "Ana Beatriz",
    },
    {
      chave: "ALUNO_SERIE",
      rotulo: "Série",
      tipo: "texto",
      obrigatorio: false,
      grupo: "Quem é você",
      exemplo: "3º ano do Ensino Médio",
    },
    {
      chave: "ESCOLA_NOME",
      rotulo: "Escola",
      tipo: "texto",
      obrigatorio: false,
      grupo: "Quem é você",
      exemplo: "Colégio Exemplo",
    },
  ],

  marca: {
    pasta: path.join(aqui, "marca"),
    mascote: "sabia-01-mascote.png",
    poses: {
      ocioso: "sabia-02-icone.png",
      pensando: "sabia-04-pensando.png",
      buscando: "sabia-05-buscando.png",
      aguardando: "sabia-04-pensando.png",
      pronto: "sabia-07-comemorando.png",
      erro: "sabia-06-confuso.png",
    },
  },

  async preparar({ passo, pedirCodigo }) {
    await ensureLoggedIn({ onStep: passo, request2faCode: pedirCodigo });
  },

  encerrar: () => closeBrowser(),

  async derrubarSessao() {
    const { ctx } = await getBrowser();
    const antes = (await ctx.cookies()).length;
    await ctx.clearCookies();
    return { cookiesRemovidos: antes };
  },
});
