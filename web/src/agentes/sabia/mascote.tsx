import { cn } from "@/lib/utils"
import type { EstadoDoMascote } from "@/components/mascote/tipos"

/**
 * O Sabiá de FRENTE, fiel à marca (docs/marca): cabeça redonda pardo-acinzentada
 * com topete de três pontas, olhos grandes castanhos com mancha clara e
 * sobrancelha escura, bico amarelo em losango, garganta clara, peito laranja,
 * asas pardas dos dois lados, contorno marrom-escuro uniforme.
 *
 * Desenhado por partes para animar de verdade: respira e pisca parado, inclina
 * a cabeça pensando, pula e olha em volta buscando, abre o bico escrevendo,
 * bate as asas ao responder, se chacoalha no erro. Fundo transparente.
 */
export function MascoteSabia({ estado, className }: { estado: EstadoDoMascote; className?: string }) {
  return (
    <svg
      // Folga de 14 em cima: no pulo a cabeça sobe 12, e as bolhas de pensamento
      // vão até y = -8. "Vazar" para fora do quadro não serve: os itens da
      // conversa usam content-visibility, que corta tudo o que passa da caixa.
      viewBox="-2 -14 128 128"
      className={cn("sabia", className)}
      data-estado={estado}
      aria-hidden
    >
      <ellipse className="sombra" cx="60" cy="111" rx="23" ry="3.6" />
      <g className="ave">
        {/* cauda, espiando atrás do corpo */}
        <path className="cauda" d="M47 94 L31 107 Q38 111 45 107 L54 99 Z" fill="#66523F" />
        {/* patas finas, com três dedos */}
        <g className="patas" fill="none" stroke="#6B4A33" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M53 99 L52 106 M47 108 L52 106 L55 109 M52 106 L51 110" />
          <path d="M67 99 L68 106 M73 108 L68 106 L65 109 M68 106 L69 110" />
        </g>
        <g className="corpo">
          {/* corpo em gota: mais estreito em cima, barriga redonda */}
          <path className="contorno" d="M60 50 C79 50 86 67 85 82 C84 96 74 104 60 104 C46 104 36 96 35 82 C34 67 41 50 60 50 Z" fill="#7B6656" />
        </g>
        {/* asas dobradas junto ao corpo; giram pelo ombro, para fora */}
        <g className="asa asa-esq">
          <path className="contorno" d="M41 63 C32 69 30 84 34 95 L37 92 L38 97 L41 93 L43 96 C46 87 46 74 43 66 Z" fill="#66523F" />
          <path d="M35 81 L41 80 M36 87 L42 86" stroke="#3A2A1E" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <g className="asa asa-dir">
          <path className="contorno" d="M79 63 C88 69 90 84 86 95 L83 92 L82 97 L79 93 L77 96 C74 87 74 74 77 66 Z" fill="#66523F" />
          <path d="M85 81 L79 80 M84 87 L78 86" stroke="#3A2A1E" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        {/* a cabeça em duas camadas que se mexem juntas: esta fica ATRÁS do peito */}
        <g className="cabeca cabeca-tras">
          {/* o tufo de penas pontudas, caindo para o lado, como no ícone da marca */}
          <path className="contorno topete" d="M51 19 C52 14 54 11 57 9 L58 14 C60 10 63 7 67 6 L66 12 C69 10 73 10 76 11 C73 13 71 16 70 20 Z" fill="#7B6656" />
          <circle className="contorno" cx="60" cy="40" r="26" fill="#7B6656" />
          {/* o claro suave em volta dos olhos */}
          <ellipse cx="46.5" cy="41" rx="10.5" ry="11.5" fill="#8E7A68" />
          <ellipse cx="73.5" cy="41" rx="10.5" ry="11.5" fill="#8E7A68" />
          <path className="sobrancelha sobrancelha-esq" d="M38 27.5 Q45 23.5 52 26.5" fill="none" stroke="#3A2A1E" strokeWidth="1.9" strokeLinecap="round" />
          <path className="sobrancelha sobrancelha-dir" d="M68 26.5 Q75 23.5 82 27.5" fill="none" stroke="#3A2A1E" strokeWidth="1.9" strokeLinecap="round" />
          {/* olhos ovais em pé, quase cheios pela íris castanha, com a borda de cima grossa */}
          {[46.5, 73.5].map((cx) => (
            <g key={cx} className="olho">
              <ellipse cx={cx} cy="40.5" rx="7.6" ry="9" fill="#FFFDF8" stroke="#2A1D14" strokeWidth="1.5" />
              <g className="pupila">
                <ellipse cx={cx + 0.6} cy="41.4" rx="6" ry="7.3" fill="#6B3A1E" />
                <ellipse cx={cx + 0.6} cy="41.6" rx="4.2" ry="5.3" fill="#150D08" />
                <circle cx={cx + 2.8} cy="37.8" r="2.1" fill="#FFFDF8" />
              </g>
              <path d={`M${cx - 7.6} 40.5 A 7.6 9 0 0 1 ${cx + 7.6} 40.5`} fill="none" stroke="#2A1D14" strokeWidth="2.6" strokeLinecap="round" />
            </g>
          ))}
          {/* olhos de confuso, só no erro */}
          <path
            className="olho-x"
            d="M41 35 L52 46 M52 35 L41 46 M68 35 L79 46 M79 35 L68 46"
            stroke="#2A1D14"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
        {/* o peito laranja sobe até logo abaixo do bico, por cima da borda da cabeça */}
        <g className="peito">
          <path d="M41 58 Q60 70 79 58 C85 66 86 84 79 95 C71 104 49 104 41 95 C34 84 35 66 41 58 Z" fill="#E8812F" />
          <path d="M47 58 Q60 68 73 58 Q67 64 60 65 Q53 64 47 58 Z" fill="#D8C1A3" />
          <path
            d="M53 76 l3 3 l3 -3 M61 76 l3 3 l3 -3 M57 85 l3 3 l3 -3 M51 91 l2.5 2.5 l2.5 -2.5 M64 91 l2.5 2.5 l2.5 -2.5"
            fill="none"
            stroke="#CC6A22"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        </g>
        {/* a camada da FRENTE da cabeça: o bico, por cima do peito */}
        <g className="cabeca cabeca-frente">
          {/* a boca aparece quando a parte de baixo do bico desce */}
          <ellipse className="boca" cx="60" cy="57" rx="6.5" ry="4" fill="#9C3B22" />
          <path className="bico-baixo contorno-fino" d="M50 53.5 L70 53.5 L60 63 Z" fill="#E0981C" />
          <path className="bico-cima contorno-fino" d="M47 50 L60 43 L73 50 L60 58 Z" fill="#F5B52F" />
          <path d="M60 44.5 L60 51" stroke="#E0981C" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </g>
      {/* o que aparece em volta dele */}
      <g className="pensamento" fill="#B89B7E">
        <circle className="p1" cx="88" cy="18" r="3" />
        <circle className="p2" cx="97" cy="9" r="3.6" />
        <circle className="p3" cx="107" cy="-1" r="4.4" />
      </g>
      <text className="duvida" x="90" y="20" fontSize="24" fontWeight="800" fill="#D8672B">
        ?
      </text>
      <g className="brilhos" fill="#F4B63A">
        <path className="b1" d="M16 30 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" />
        <path className="b2" d="M104 56 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 Z" />
        <path className="b3" d="M24 4 l1.3 3 l3 1.3 l-3 1.3 l-1.3 3 l-1.3 -3 l-3 -1.3 l3 -1.3 Z" />
      </g>
    </svg>
  )
}
