'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { ChaveModulo } from './regras';

// Lista de modulos desligados, lida no servidor pelo layout logado e repassada
// pras telas esconderem atalhos (botao do chat, aba Feiras, QR de captura...).
const ModulosCtx = createContext<readonly string[]>([]);

export function ModulosProvider({ desligados, children }: { desligados: readonly string[]; children: ReactNode }) {
  return <ModulosCtx.Provider value={desligados}>{children}</ModulosCtx.Provider>;
}

export function useModuloLigado(chave: ChaveModulo) {
  return !useContext(ModulosCtx).includes(chave);
}

export function useModulosDesligados() {
  return useContext(ModulosCtx);
}
