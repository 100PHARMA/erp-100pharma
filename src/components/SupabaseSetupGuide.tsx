'use client';

import { AlertTriangle, CheckCircle, Copy } from 'lucide-react';
import { useState } from 'react';

export default function SupabaseSetupGuide() {
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const sqlCommands = [
    {
      title: 'Habilitar RLS nas tabelas',
      sql: `ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas ENABLE ROW LEVEL SECURITY;`
    },
    {
      title: 'Políticas para Clientes',
      sql: `CREATE POLICY "Permitir acesso público clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);`
    },
    {
      title: 'Políticas para Produtos',
      sql: `CREATE POLICY "Permitir acesso público produtos" ON produtos FOR ALL USING (true) WITH CHECK (true);`
    },
    {
      title: 'Políticas para Vendas',
      sql: `CREATE POLICY "Permitir acesso público vendas" ON vendas FOR ALL USING (true) WITH CHECK (true);`
    },
    {
      title: 'Políticas para Vendedores',
      sql: `CREATE POLICY "Permitir acesso público vendedores" ON vendedores FOR ALL USING (true) WITH CHECK (true);`
    },
    {
      title: 'Políticas para Itens de Venda',
      sql: `CREATE POLICY "Permitir acesso público itens_venda" ON itens_venda FOR ALL USING (true) WITH CHECK (true);`
    },
    {
      title: 'Políticas para Faturas',
      sql: `CREATE POLICY "Permitir acesso público faturas" ON faturas FOR ALL USING (true) WITH CHECK (true);`
    }
  ];

  const copyToClipboard = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6 pb-6 border-b border-orange-200">
            <div className="bg-orange-100 p-3 rounded-lg">
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Configuração Necessária do Supabase
              </h1>
              <p className="text-gray-600">
                Para que o aplicativo funcione corretamente, você precisa configurar as políticas RLS (Row Level Security) no Supabase.
              </p>
            </div>
          </div>

          {/* Instruções */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">📋 Passo a Passo:</h2>
            <ol className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</span>
                <span>Acesse o <strong>Dashboard do Supabase</strong> em <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">supabase.com/dashboard</a></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</span>
                <span>Selecione seu projeto</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</span>
                <span>No menu lateral, clique em <strong>SQL Editor</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">4</span>
                <span>Clique em <strong>New Query</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">5</span>
                <span>Copie e execute cada comando SQL abaixo (um por vez)</span>
              </li>
            </ol>
          </div>

          {/* SQL Commands */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💻 Comandos SQL:</h2>
            {sqlCommands.map((command, index) => (
              <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{command.title}</h3>
                  <button
                    onClick={() => copyToClipboard(command.sql, index)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    {copiedStep === index ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-gray-900 p-4">
                  <pre className="text-green-400 text-sm overflow-x-auto">
                    <code>{command.sql}</code>
                  </pre>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900 mb-1">Após executar todos os comandos:</p>
                <p className="text-sm text-green-800">
                  Recarregue esta página e o aplicativo estará totalmente funcional com acesso aos dados do Supabase!
                </p>
              </div>
            </div>
          </div>

          {/* Botão para voltar */}
          <div className="mt-6 text-center">
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Voltar ao Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
