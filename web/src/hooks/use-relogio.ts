import { useEffect, useState } from "react"

/** Date.now() atualizado a cada segundo, só enquanto `ligado`. */
export function useRelogio(ligado: boolean) {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ligado) return
    const id = window.setInterval(() => setAgora(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [ligado])
  return agora
}
