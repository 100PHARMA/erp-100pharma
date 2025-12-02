"use client";

import { Button } from "@/components/ui/button";

export default function TestePdfPage() {
  function handleCliqueTeste() {
    alert("Clique de teste recebido");
    console.log("DEBUG: clique de teste recebido na página de teste");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-12 text-center">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-8">
          Página de Teste de Clique
        </h1>
        
        <Button
          onClick={handleCliqueTeste}
          size="lg"
          className="text-xl px-12 py-6 h-auto"
        >
          Clique de Teste
        </Button>
      </div>
    </div>
  );
}
