import { createContext, useContext, useState, type ReactNode } from "react";
import { autenticarApi, TOKEN_KEY } from "../services/api";

interface AuthCtx {
  autenticado: boolean;
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  async function login(usuario: string, senha: string) {
    const t = await autenticarApi(usuario, senha);
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
  }
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  return <Ctx.Provider value={{ autenticado: !!token, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
