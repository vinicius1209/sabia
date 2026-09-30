import { cn } from "@/lib/utils"
import type { EstadoDoMascote } from "@/components/mascote/tipos"

/**
 * O Sabiá desenhado em SVG, com as partes separadas para animar de verdade:
 * respira e pisca parado, inclina a cabeça pensando, bica e salta buscando,
 * bate as asas quando responde, abre o bico enquanto escreve, se arrepia no
 * erro. Fundo transparente. As poses em PNG continuam nos slides.
 *
 * Mesmo estilo do mascote ilustrado: vetor chapado, contorno escuro uniforme,
 * dorso pardo, peito laranja, garganta clara, bico amarelo.
 */
export function MascoteSabia({ estado, className }: { estado: EstadoDoMascote; className?: string }) {
  return (
    <svg
      // Folga de 14 em cima: no pulo a cabeça sobe 12, e as bolhas de pensamento
      // vão até y = -1. "Vazar" para fora do quadro não serve: os itens da
      // conversa usam content-visibility, que corta tudo o que passa da caixa.
      viewBox="-2 -14 128 128"
      className={cn("sabia", className)}
      data-estado={estado}
      aria-hidden
    >
      <ellipse className="sombra" cx="60" cy="111" rx="24" ry="3.6" />
      <g className="ave">
        {/* patas */}
        <g className="patas" fill="none" stroke="#7A5638" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M53 94 L51 106 M46 107 L51 106 L56 107" />
          <path d="M65 94 L67 106 M62 107 L67 106 L72 107" />
        </g>
        {/* cauda */}
        <path className="cauda" d="M36 74 L15 95 Q21 99 27 96 L45 82 Z" fill="#5E4330" />
        <g className="corpo">
          <path
            d="M60 36 C82 36 88 60 86 76 C84 92 72 99 58 99 C42 99 32 88 32 72 C32 54 42 36 60 36 Z"
            fill="#6E5039"
          />
          <path d="M63 48 C79 50 85 64 83 78 C81 91 72 97 62 96 C52 95 46 86 47 73 C48 60 53 48 63 48 Z" fill="#DB6A2C" />
          <path d="M57 86 C62 90 70 90 76 86" fill="none" stroke="#C0561F" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
        </g>
        {/* asa: gira pelo ombro */}
        <path className="asa" d="M44 55 C33 58 27 72 30 84 C32 91 37 94 42 91 C48 86 51 76 50 66 C49 60 47 56 44 55 Z" fill="#5C4130" />
        <path className="asa-penas" d="M35 80 L42 79 M36 86 L42 84" stroke="#3B2A1E" strokeWidth="1.4" strokeLinecap="round" />
        <g className="cabeca">
          <circle cx="63" cy="36" r="20" fill="#6E5039" />
          <path d="M58 44 C62 54 72 56 79 49 C78 44 74 41 68 41 C63 41 59 42 58 44 Z" fill="#EAD3B4" />
          {/* bico: a parte de baixo abre enquanto ele escreve */}
          <path className="bico-baixo" d="M79 38 L92 41.5 L79 44 Z" fill="#E09A1F" />
          <path className="bico-cima" d="M78 33.5 L96 38.5 L79 41 Z" fill="#F4B63A" />
          <g className="olho">
            <circle cx="71" cy="31" r="6.2" fill="#FFFDF8" />
            <circle className="pupila" cx="72.6" cy="31.6" r="3.6" fill="#231710" />
            <circle cx="74" cy="30" r="1.3" fill="#FFFDF8" />
          </g>
          {/* olhos de confuso, só no erro */}
          <path className="olho-x" d="M67.5 27.5 L74.5 34.5 M74.5 27.5 L67.5 34.5" stroke="#231710" strokeWidth="2.4" strokeLinecap="round" />
          <path className="topete" d="M52 19 C54 13 59 12 60 17 C62 12 67 13 66 19" fill="#6E5039" />
        </g>
      </g>
      {/* o que aparece em volta dele */}
      <g className="pensamento" fill="#B89B7E">
        <circle className="p1" cx="88" cy="16" r="3" />
        <circle className="p2" cx="97" cy="9" r="3.6" />
        <circle className="p3" cx="107" cy="3" r="4.2" />
      </g>
      <text className="duvida" x="92" y="22" fontSize="24" fontWeight="800" fill="#D8672B">?</text>
      <g className="brilhos" fill="#F4B63A">
        <path className="b1" d="M22 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" />
        <path className="b2" d="M100 58 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 Z" />
        <path className="b3" d="M30 8 l1.3 3 l3 1.3 l-3 1.3 l-1.3 3 l-1.3 -3 l-3 -1.3 l3 -1.3 Z" />
      </g>
    </svg>
  )
}
