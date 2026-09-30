import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/**
 * A resposta do modelo em markdown, sem HTML cru (o react-markdown não
 * interpreta HTML por padrão: um aviso da escola com <script> vira texto).
 */
export function Markdown({ texto, escrevendo }: { texto: string; escrevendo?: boolean }) {
  return (
    <div
      className={cn(
        "text-[15px]/7 text-foreground [&_a]:text-primary [&_a]:underline [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        // o cursor piscando no fim do texto enquanto o modelo escreve
        escrevendo &&
          "[&>*:last-child]:after:ml-0.5 [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-4 [&>*:last-child]:after:w-[3px] [&>*:last-child]:after:translate-y-0.5 [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:rounded-full [&>*:last-child]:after:bg-primary [&>*:last-child]:after:content-['']"
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{texto}</ReactMarkdown>
    </div>
  )
}
