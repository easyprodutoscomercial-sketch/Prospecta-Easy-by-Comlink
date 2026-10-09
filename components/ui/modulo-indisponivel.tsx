// Tela dos links publicos quando o modulo foi desligado em Admin -> Modulos do sistema.
export default function ModuloIndisponivel() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-[#1e0f35] border border-purple-800/30 rounded-xl p-6 text-center">
        <h1 className="text-lg font-bold text-white mb-2">Página indisponível</h1>
        <p className="text-sm text-purple-200/70">Este link não está ativo no momento.</p>
      </div>
    </div>
  );
}
