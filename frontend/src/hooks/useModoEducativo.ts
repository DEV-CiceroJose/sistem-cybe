import { useEffect, useState } from "react";

export type ModoEducativo = "iniciante" | "avancado";

const CHAVE = "wsa:modoEducativo";

/** Preferência de nível das explicações educativas, persistida em localStorage. */
export function useModoEducativo() {
  const [modo, setModo] = useState<ModoEducativo>(() => {
    try {
      return localStorage.getItem(CHAVE) === "avancado" ? "avancado" : "iniciante";
    } catch {
      return "iniciante";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, modo);
    } catch {
      /* ignora falhas de storage */
    }
  }, [modo]);

  return { modo, setModo };
}
