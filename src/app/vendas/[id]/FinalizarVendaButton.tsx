'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type FinalizarVendaButtonProps = {
  vendaId: string;        // UUID da venda
  estadoInicial: string;  // 'ABERTA' | 'FECHADA' (ou outros)
  vendaNumero: string;    // Número da venda (ex: VD-001) para exibição
};

type FaturaMin = {
  id: string;
  venda_id: string;
  tipo?: string | null;
  created_at?: string | null;
};

export default function FinalizarVendaButton({
  vendaId,
  estadoInicial,
  vendaNumero,
}: FinalizarVendaButtonProps) {
  const [estado, setEstado] = useState(estadoInicial);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const buscarFaturaDaVenda = async (): Promise<FaturaMin | null> => {
    // Busca a FATURA mais recente desta venda.
    // Se a coluna `tipo` existir (no seu schema existe), filtramos por 'FATURA'.
    const { data, error } = await supabase
      .from('faturas')
      .select('id, venda_id, tipo, created_at')
      .eq('venda_id', vendaId)
      .eq('tipo', 'FATURA')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao buscar fatura da venda:', error);
      return null;
    }

    return data ?? null;
  };

  const normalizarFatura = (data: any): FaturaMin | null => {
    if (!data) return null;
    // Alguns RPCs retornam array de registros
    if (Array.isArray(data)) return data[0] ?? null;
    // Outros retornam objeto direto
    return data;
  };

  const handleClick = async () => {
    if (loading) return;
    if (estado === 'FECHADA') return;

    const confirmar = confirm(
      `Deseja finalizar a venda ${vendaNumero} e emitir a fatura?\n\n` +
        'Esta ação irá:\n' +
        '- Fechar a venda\n' +
        '- Criar/recuperar a fatura\n' +
        '- Registrar saídas no estoque\n' +
        '- Atualizar quantidades dos produtos'
    );

    if (!confirmar) return;

    try {
      setLoading(true);

      console.log('🎯 Chamando RPC finalizar_venda_e_criar_fatura');
      console.log('📋 Venda ID (UUID):', vendaId);
      console.log('📋 Venda Número:', vendaNumero);

      const { data, error } = await supabase.rpc('finalizar_venda_e_criar_fatura', {
        p_venda_id: vendaId,
      });

      if (error) {
        console.error('❌ Erro ao finalizar venda (RPC):', error);
        toast.error(error.message || 'Erro ao finalizar venda');
        return;
      }

      // 1) Tentar obter a fatura pelo retorno do RPC
      let fatura = normalizarFatura(data);

      // 2) Se o RPC não devolveu id, buscar no banco pela venda_id
      if (!fatura?.id) {
        fatura = await buscarFaturaDaVenda();
      }

      // 3) Se ainda assim não achou, é erro real (não navegar no escuro)
      if (!fatura?.id) {
        console.error('❌ RPC executou sem erro, mas não foi possível obter a fatura.');
        toast.error(
          'A venda foi processada, mas não foi possível localizar a fatura. Verifique a tabela faturas.'
        );
        // Ainda assim, atualiza tela
        setEstado('FECHADA');
        router.refresh();
        return;
      }

      // Atualizar estado local
      setEstado('FECHADA');

      toast.success('Venda finalizada e fatura emitida com sucesso!');

      // Navegar diretamente para a fatura (fluxo antigo “automático”)
      router.push(`/faturas/${fatura.id}`);

      // Refresh depois do push (evita “engolir” a navegação em alguns casos)
      router.refresh();
    } catch (err: any) {
      console.error('❌ Erro ao processar venda:', err);
      toast.error(`Erro ao finalizar venda: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Se já está fechada, não mostrar o botão
  if (estado === 'FECHADA') return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-2 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
    >
      {loading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Finalizando...
        </>
      ) : (
        <>
          <CheckCircle className="w-5 h-5" />
          Finalizar venda e emitir fatura
        </>
      )}
    </button>
  );
}
