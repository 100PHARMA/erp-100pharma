'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RefreshCw, CheckCircle2, XCircle, Plus } from 'lucide-react';

type VisitaRow = {
  id: string;
  vendedor_id: string;
  cliente_id: string | null;
  data_visita: string;
  estado: 'PENDENTE' | 'REALIZADA' | 'CANCELADA';
  origem?: 'ADMIN' | 'VENDEDOR';
  created_at?: string;
  clientes?: { nome: string } | null;
};

function formatDate(d: string) {
  return new Date(d).toLocaleString('pt-PT');
}

export default function PortalVisitasPage() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [vendedorId, setVendedorId] = useState<string | null>(null);

  const [visitas, setVisitas] = useState<VisitaRow[]>([]);

  // criação
  const [clienteId, setClienteId] = useState<string>('');
  const [dataVisita, setDataVisita] = useState<string>('');
  const [criando, setCriando] = useState(false);

  const pendentes = useMemo(() => visitas.filter(v => v.estado === 'PENDENTE'), [visitas]);
  const realizadas = useMemo(() => visitas.filter(v => v.estado === 'REALIZADA'), [visitas]);

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error('Sem sessão.');

      // pega vendedor_id do perfil
      const { data: perfil, error: pErr } = await supabase
        .from('perfis')
        .select('vendedor_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (pErr) throw pErr;

      const vid = perfil?.vendedor_id;
      if (!vid) throw new Error('Seu usuário não está vinculado a um vendedor (perfis.vendedor_id está null).');

      setVendedorId(vid);

      const { data, error } = await supabase
        .from('vendedor_visitas')
        .select('id,vendedor_id,cliente_id,data_visita,estado,origem,created_at,clientes(nome)')
        .eq('vendedor_id', vid)
        .order('data_visita', { ascending: false });

      if (error) throw error;

      setVisitas((data || []) as any);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar visitas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function criarVisita() {
    if (!vendedorId) return;
    if (!dataVisita) {
      setErro('Selecione uma data/hora para a visita.');
      return;
    }

    setCriando(true);
    setErro(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sem sessão.');

      const payload: any = {
        vendedor_id: vendedorId,
        cliente_id: clienteId || null,
        data_visita: new Date(dataVisita).toISOString(),
        estado: 'PENDENTE',
        origem: 'VENDEDOR',
        created_by: user.id,
        updated_by: user.id,
      };

      const { error } = await supabase.from('vendedor_visitas').insert(payload);
      if (error) throw error;

      setClienteId('');
      setDataVisita('');
      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao criar visita');
    } finally {
      setCriando(false);
    }
  }

  async function atualizarEstado(id: string, estado: VisitaRow['estado']) {
    setErro(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sem sessão.');

      const { error } = await supabase
        .from('vendedor_visitas')
        .update({ estado, updated_by: user.id })
        .eq('id', id);

      if (error) throw error;

      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao atualizar visita');
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-3 text-gray-700">
        <RefreshCw className="w-5 h-5 animate-spin" />
        Carregando visitas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 font-semibold">
          {erro}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-xl font-bold text-gray-900 mb-4">Criar visita</div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-semibold text-gray-700">Cliente (opcional)</label>
            <input
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              placeholder="Cole o UUID do cliente (ou deixe vazio)"
              className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
            />
            <div className="text-xs text-gray-500 mt-1">
              Depois a gente troca isso por um select bonitinho.
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Data e hora</label>
            <input
              value={dataVisita}
              onChange={(e) => setDataVisita(e.target.value)}
              type="datetime-local"
              className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={criarVisita}
              disabled={criando}
              className="w-full bg-gray-900 text-white rounded-xl px-4 py-2 font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Plus className="w-5 h-5" />
              {criando ? 'Criando...' : 'Criar visita'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-bold text-gray-900">Pendentes</div>
            <div className="text-sm text-gray-500">{pendentes.length}</div>
          </div>

          <div className="space-y-3">
            {pendentes.map(v => (
              <div key={v.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">
                      {v.clientes?.nome || (v.cliente_id ? `Cliente: ${v.cliente_id}` : 'Sem cliente')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(v.data_visita)} • origem: {v.origem || '—'}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => atualizarEstado(v.id, 'REALIZADA')}
                      className="bg-green-600 text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Realizada
                    </button>
                    <button
                      onClick={() => atualizarEstado(v.id, 'CANCELADA')}
                      className="bg-gray-200 text-gray-900 rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {pendentes.length === 0 && (
              <div className="text-gray-600 text-sm">Sem visitas pendentes.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-lg font-bold text-gray-900">Realizadas</div>
            <div className="text-sm text-gray-500">{realizadas.length}</div>
          </div>

          <div className="space-y-3">
            {realizadas.map(v => (
              <div key={v.id} className="border border-gray-100 rounded-xl p-4">
                <div className="font-semibold text-gray-900">
                  {v.clientes?.nome || (v.cliente_id ? `Cliente: ${v.cliente_id}` : 'Sem cliente')}
                </div>
                <div className="text-sm text-gray-500">{formatDate(v.data_visita)} • origem: {v.origem || '—'}</div>
              </div>
            ))}

            {realizadas.length === 0 && (
              <div className="text-gray-600 text-sm">Sem visitas realizadas no momento.</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={carregar}
          className="bg-gray-900 text-white rounded-xl px-4 py-2 font-semibold flex items-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Atualizar
        </button>
      </div>
    </div>
  );
}
