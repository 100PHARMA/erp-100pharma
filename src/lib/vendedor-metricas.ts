// src/lib/vendedor-metricas.ts
//
// Fonte única de verdade para métricas de vendedores (MÊS ATUAL ou mês selecionado),
// usando FATURAS EMITIDAS (base SEM IVA) + metas mensais por vendedor (override) com fallback global.
//
// Depende de:
// - public.vendedores
// - public.faturas (tipo='FATURA', estado <> 'CANCELADA', data_emissao, total_sem_iva/subtotal, venda_id, cliente_id)
// - public.vendas (id, vendedor_id)
// - public.venda_itens (venda_id, quantidade)
// - public.vendedor_km (vendedor_id, data, km, valor)
// - public.vendedor_visitas (vendedor_id, cliente_id, data_visita, estado)
// - public.vendedor_metas_mensais (vendedor_id, ano, mes, meta_mensal, faixa*_limite, faixa*_percent)
//
// Observação importante:
// - Comissão e Meta são calculadas sempre sobre BASE SEM IVA (faturas emitidas).

import { supabase } from './supabase';
import { buscarConfiguracaoFinanceira, type ConfiguracaoFinanceira } from './configuracoes-financeiras';
import type { VendedorMetaMensalRow } from './vendedor-metas-mensais';

export type VendedorRow = {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  salario_base?: number | null;
  custo_km?: number | null;
  ativo?: boolean | null;
};

export type VendedorMetricasMes = {
  vendedor_id: string;
  vendedor_nome: string;

  ano: number;
  mes: number;

  // Base do mês (faturas emitidas) — SEM IVA
  base_sem_iva: number;

  // Auditoria
  num_faturas: number;
  clientes_unicos: number;
  frascos: number;
  faturas_pagas: number;
  faturas_pendentes: number;

  // KM e visitas
  km_rodados: number;
  custo_km: number;
  visitas_total: number;
  visitas_pendentes: number;
  visitas_realizadas: number;
  visitas_canceladas: number;

  // Meta e comissão (regra vigente para o vendedor naquele mês)
  meta_mensal_usada: number;
  percentual_meta: number; // 0..200
  faixa_atual: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3';
  comissao_calculada: number;

  // Para debug/explicabilidade
  regra_origem: 'VENDEDOR' | 'GLOBAL';
  faixa1_limite: number;
  faixa1_percent: number;
  faixa2_limite: number;
  faixa2_percent: number;
  faixa3_percent: number;
};

type Range = {
  inicioTsUtc: string; // ISO
  fimTsUtc: string; // ISO (exclusivo)
  inicioDate: string; // YYYY-MM-DD
  fimDate: string; // YYYY-MM-DD (inclusivo)
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function getMonthRange(ano: number, mes: number): Range {
  // mes: 1..12
  const inicio = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
  const fimExclusivo = new Date(Date.UTC(mes === 12 ? ano + 1 : ano, mes === 12 ? 0 : mes, 1, 0, 0, 0));
  // para tabelas date (inclusive), calculamos o último dia do mês:
  const fimInclusive = new Date(Date.UTC(ano, mes, 0, 0, 0, 0));

  const inicioDate = `${ano}-${pad2(mes)}-01`;
  const fimDate = `${fimInclusive.getUTCFullYear()}-${pad2(fimInclusive.getUTCMonth() + 1)}-${pad2(
    fimInclusive.getUTCDate(),
  )}`;

  return {
    inicioTsUtc: inicio.toISOString(),
    fimTsUtc: fimExclusivo.toISOString(),
    inicioDate,
    fimDate,
  };
}

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function calcComissaoProgressiva(base: number, regra: {
  faixa1_limite: number;
  faixa1_percent: number;
  faixa2_limite: number;
  faixa2_percent: number;
  faixa3_percent: number;
}): { comissao: number; faixa: 'FAIXA_1' | 'FAIXA_2' | 'FAIXA_3' } {
  const b = Math.max(0, safeNum(base));
  const f1 = Math.max(0, safeNum(regra.faixa1_limite));
  const f2 = Math.max(0, safeNum(regra.faixa2_limite));
  const p1 = Math.max(0, safeNum(regra.faixa1_percent));
  const p2 = Math.max(0, safeNum(regra.faixa2_percent));
  const p3 = Math.max(0, safeNum(regra.faixa3_percent));

  // Proteções:
  // - se faixa2_limite <= faixa1_limite, tratamos como “não configurado” e cai tudo em faixa1/3 conforme.
  const faixa2Valida = f2 > f1;

  if (b <= f1 || f1 === 0) {
    return { comissao: b * (p1 / 100), faixa: 'FAIXA_1' };
  }

  if (faixa2Valida && b <= f2) {
    const c1 = f1 * (p1 / 100);
    const c2 = (b - f1) * (p2 / 100);
    return { comissao: c1 + c2, faixa: 'FAIXA_2' };
  }

  // faixa3
  const c1 = f1 * (p1 / 100);
  const c2 = faixa2Valida ? (f2 - f1) * (p2 / 100) : 0;
  const excedenteBase = faixa2Valida ? (b - f2) : (b - f1);
  const c3 = Math.max(0, excedenteBase) * (p3 / 100);
  return { comissao: c1 + c2 + c3, faixa: 'FAIXA_3' };
}

function calcPercentualMeta(base: number, meta: number): number {
  const b = Math.max(0, safeNum(base));
  const m = safeNum(meta);
  if (m <= 0) return 0;
  const pct = (b / m) * 100;
  return Math.min(Math.max(pct, 0), 200);
}

function pickRegraParaVendedor(metaRow: VendedorMetaMensalRow | undefined, cfg: ConfiguracaoFinanceira) {
  // meta
  const metaMensal = metaRow?.meta_mensal ?? null;

  // faixas (vendor override se tiver preenchido; senão, global)
  const faixa1_limite =
    metaRow?.faixa1_limite !== null && metaRow?.faixa1_limite !== undefined
      ? safeNum(metaRow.faixa1_limite)
      : safeNum(cfg.faixa1_limite);

  const faixa2_limite =
    metaRow?.faixa2_limite !== null && metaRow?.faixa2_limite !== undefined
      ? safeNum(metaRow.faixa2_limite)
      : safeNum(cfg.faixa2_limite);

  const faixa1_percent =
    metaRow?.faixa1_percent !== null && metaRow?.faixa1_percent !== undefined
      ? safeNum(metaRow.faixa1_percent)
      : safeNum((cfg as any).comissao_faixa1 ?? cfg.comissao_faixa1);

  const faixa2_percent =
    metaRow?.faixa2_percent !== null && metaRow?.faixa2_percent !== undefined
      ? safeNum(metaRow.faixa2_percent)
      : safeNum((cfg as any).comissao_faixa2 ?? cfg.comissao_faixa2);

  const faixa3_percent =
    metaRow?.faixa3_percent !== null && metaRow?.faixa3_percent !== undefined
      ? safeNum(metaRow.faixa3_percent)
      : safeNum((cfg as any).comissao_faixa3 ?? cfg.comissao_faixa3);

  const meta_mensal_usada = metaMensal !== null && metaMensal !== undefined ? safeNum(metaMensal) : safeNum(cfg.meta_mensal);

  // regra_origem: se houver pelo menos meta_mensal preenchida OU algum campo de faixa preenchido, consideramos VENDEDOR
  const temOverride =
    (metaRow?.meta_mensal !== null && metaRow?.meta_mensal !== undefined) ||
    (metaRow?.faixa1_limite !== null && metaRow?.faixa1_limite !== undefined) ||
    (metaRow?.faixa2_limite !== null && metaRow?.faixa2_limite !== undefined) ||
    (metaRow?.faixa1_percent !== null && metaRow?.faixa1_percent !== undefined) ||
    (metaRow?.faixa2_percent !== null && metaRow?.faixa2_percent !== undefined) ||
    (metaRow?.faixa3_percent !== null && metaRow?.faixa3_percent !== undefined);

  return {
    regra_origem: (temOverride ? 'VENDEDOR' : 'GLOBAL') as 'VENDEDOR' | 'GLOBAL',
    meta_mensal_usada,
    faixa1_limite,
    faixa2_limite,
    faixa1_percent,
    faixa2_percent,
    faixa3_percent,
  };
}

/**
 * Carrega métricas mensais para TODOS os vendedores, mesmo sem meta cadastrada.
 * Comissão e meta sempre em € sem IVA (base por faturas emitidas).
 */
export async function getVendedorMetricasMes(ano: number, mes: number): Promise<VendedorMetricasMes[]> {
  const periodo = getMonthRange(ano, mes);

  // 1) Config global mais recente
  const cfg = await buscarConfiguracaoFinanceira();

  // 2) Vendedores
  const { data: vendedoresData, error: vendErr } = await supabase
    .from('vendedores')
    .select('id,nome,email,telefone,salario_base,custo_km,ativo')
    .order('nome', { ascending: true });

  if (vendErr) throw vendErr;

  const vendedores = (vendedoresData ?? []) as VendedorRow[];

  // 3) Metas do mês (override por vendedor)
  const { data: metasData, error: metasErr } = await supabase
    .from('vendedor_metas_mensais')
    .select('*')
    .eq('ano', ano)
    .eq('mes', mes);

  if (metasErr) throw metasErr;

  const metas = (metasData ?? []) as VendedorMetaMensalRow[];
  const metaByVendedor = new Map<string, VendedorMetaMensalRow>();
  for (const m of metas) {
    if (m?.vendedor_id) metaByVendedor.set(m.vendedor_id, m);
  }

  // 4) Faturas emitidas no mês (base sem IVA) + vendedor via vendas
  // Nota: depende de relacionamento faturas.venda_id -> vendas.id no Supabase
  const { data: faturasData, error: faturasErr } = await supabase
    .from('faturas')
    .select('id, numero, venda_id, cliente_id, tipo, estado, data_emissao, total_sem_iva, subtotal, vendas!inner(id, vendedor_id)')
    .eq('tipo', 'FATURA')
    .neq('estado', 'CANCELADA')
    .gte('data_emissao', periodo.inicioTsUtc)
    .lt('data_emissao', periodo.fimTsUtc);

  if (faturasErr) throw faturasErr;

  const faturas = (faturasData ?? []) as any[];

  // 4.1) Mapear faturas por vendedor + coletar venda_ids
  const agg = new Map<
    string,
    {
      base_sem_iva: number;
      num_faturas: number;
      faturas_pagas: number;
      faturas_pendentes: number;
      clientes: Set<string>;
      vendaIds: Set<string>;
    }
  >();

  const allVendaIds = new Set<string>();

  for (const f of faturas) {
    const venda = f?.vendas;
    const vendedorId = venda?.vendedor_id as string | undefined;
    if (!vendedorId) continue;

    const base = safeNum(f?.total_sem_iva ?? f?.subtotal ?? 0);
    const clienteId = (f?.cliente_id as string | null) ?? null;
    const vendaId = (f?.venda_id as string | null) ?? null;

    if (!agg.has(vendedorId)) {
      agg.set(vendedorId, {
        base_sem_iva: 0,
        num_faturas: 0,
        faturas_pagas: 0,
        faturas_pendentes: 0,
        clientes: new Set<string>(),
        vendaIds: new Set<string>(),
      });
    }

    const a = agg.get(vendedorId)!;
    a.base_sem_iva += base;
    a.num_faturas += 1;

    if (String(f?.estado).toUpperCase() === 'PAGA') a.faturas_pagas += 1;
    if (String(f?.estado).toUpperCase() === 'PENDENTE') a.faturas_pendentes += 1;

    if (clienteId) a.clientes.add(clienteId);
    if (vendaId) {
      a.vendaIds.add(vendaId);
      allVendaIds.add(vendaId);
    }
  }

  // 5) Frascos por venda (dedup por venda_id)
  let frascosPorVenda = new Map<string, number>();
  if (allVendaIds.size > 0) {
    const vendaIdList = Array.from(allVendaIds);

    // Para não estourar limite de URL se tiver muitos ids, fazemos batching
    const BATCH = 500;
    frascosPorVenda = new Map<string, number>();

    for (let i = 0; i < vendaIdList.length; i += BATCH) {
      const chunk = vendaIdList.slice(i, i + BATCH);
      const { data: itensData, error: itensErr } = await supabase
        .from('venda_itens')
        .select('venda_id, quantidade')
        .in('venda_id', chunk);

      if (itensErr) throw itensErr;

      for (const it of itensData ?? []) {
        const vid = it.venda_id as string;
        const q = safeNum(it.quantidade);
        frascosPorVenda.set(vid, (frascosPorVenda.get(vid) ?? 0) + q);
      }
    }
  }

  // 6) KM do mês
  const { data: kmData, error: kmErr } = await supabase
    .from('vendedor_km')
    .select('id, vendedor_id, data, km, valor')
    .gte('data', periodo.inicioDate)
    .lte('data', periodo.fimDate);

  if (kmErr) throw kmErr;

  const kmRows = (kmData ?? []) as any[];
  const kmAgg = new Map<string, { km: number; valor: number }>();
  for (const r of kmRows) {
    const vid = r.vendedor_id as string | undefined;
    if (!vid) continue;
    const km = safeNum(r.km);
    const valor = safeNum(r.valor);
    kmAgg.set(vid, {
      km: (kmAgg.get(vid)?.km ?? 0) + km,
      valor: (kmAgg.get(vid)?.valor ?? 0) + valor,
    });
  }

  // 7) Visitas do mês
  const { data: visitasData, error: visitasErr } = await supabase
    .from('vendedor_visitas')
    .select('id, vendedor_id, data_visita, estado')
    .gte('data_visita', periodo.inicioDate)
    .lte('data_visita', periodo.fimDate);

  if (visitasErr) throw visitasErr;

  const visitas = (visitasData ?? []) as any[];
  const visitaAgg = new Map<
    string,
    { total: number; pendente: number; realizada: number; cancelada: number }
  >();

  for (const v of visitas) {
    const vid = v.vendedor_id as string | undefined;
    if (!vid) continue;
    const estado = String(v.estado ?? '').toUpperCase();

    if (!visitaAgg.has(vid)) {
      visitaAgg.set(vid, { total: 0, pendente: 0, realizada: 0, cancelada: 0 });
    }
    const a = visitaAgg.get(vid)!;
    a.total += 1;
    if (estado === 'PENDENTE') a.pendente += 1;
    else if (estado === 'REALIZADA') a.realizada += 1;
    else if (estado === 'CANCELADA') a.cancelada += 1;
  }

  // 8) Montar resultado para TODOS os vendedores (mesmo sem movimento/meta)
  const out: VendedorMetricasMes[] = vendedores.map((vend) => {
    const a = agg.get(vend.id);
    const base_sem_iva = safeNum(a?.base_sem_iva ?? 0);
    const num_faturas = safeNum(a?.num_faturas ?? 0);
    const clientes_unicos = a ? a.clientes.size : 0;

    // frascos: soma dedup por venda_id
    let frascos = 0;
    if (a?.vendaIds?.size) {
      for (const vid of a.vendaIds) {
        frascos += safeNum(frascosPorVenda.get(vid) ?? 0);
      }
    }

    const faturas_pagas = safeNum(a?.faturas_pagas ?? 0);
    const faturas_pendentes = safeNum(a?.faturas_pendentes ?? 0);

    const km = kmAgg.get(vend.id);
    const km_rodados = safeNum(km?.km ?? 0);
    const custo_km = safeNum(km?.valor ?? 0);

    const vis = visitaAgg.get(vend.id);
    const visitas_total = safeNum(vis?.total ?? 0);
    const visitas_pendentes = safeNum(vis?.pendente ?? 0);
    const visitas_realizadas = safeNum(vis?.realizada ?? 0);
    const visitas_canceladas = safeNum(vis?.cancelada ?? 0);

    const metaRow = metaByVendedor.get(vend.id);
    const regra = pickRegraParaVendedor(metaRow, cfg);

    const { comissao, faixa } = calcComissaoProgressiva(base_sem_iva, {
      faixa1_limite: regra.faixa1_limite,
      faixa1_percent: regra.faixa1_percent,
      faixa2_limite: regra.faixa2_limite,
      faixa2_percent: regra.faixa2_percent,
      faixa3_percent: regra.faixa3_percent,
    });

    const percentual_meta = calcPercentualMeta(base_sem_iva, regra.meta_mensal_usada);

    return {
      vendedor_id: vend.id,
      vendedor_nome: vend.nome,

      ano,
      mes,

      base_sem_iva: Number(base_sem_iva.toFixed(2)),

      num_faturas: Math.trunc(num_faturas),
      clientes_unicos: Math.trunc(clientes_unicos),
      frascos: Math.trunc(frascos),
      faturas_pagas: Math.trunc(faturas_pagas),
      faturas_pendentes: Math.trunc(faturas_pendentes),

      km_rodados: Number(km_rodados.toFixed(2)),
      custo_km: Number(custo_km.toFixed(2)),

      visitas_total: Math.trunc(visitas_total),
      visitas_pendentes: Math.trunc(visitas_pendentes),
      visitas_realizadas: Math.trunc(visitas_realizadas),
      visitas_canceladas: Math.trunc(visitas_canceladas),

      meta_mensal_usada: Number(regra.meta_mensal_usada.toFixed(2)),
      percentual_meta: Number(percentual_meta.toFixed(2)),
      faixa_atual: faixa,
      comissao_calculada: Number(comissao.toFixed(2)),

      regra_origem: regra.regra_origem,
      faixa1_limite: Number(regra.faixa1_limite.toFixed(2)),
      faixa1_percent: Number(regra.faixa1_percent.toFixed(2)),
      faixa2_limite: Number(regra.faixa2_limite.toFixed(2)),
      faixa2_percent: Number(regra.faixa2_percent.toFixed(2)),
      faixa3_percent: Number(regra.faixa3_percent.toFixed(2)),
    };
  });

  // Ordenar por base_sem_iva desc (ranking)
  out.sort((a, b) => b.base_sem_iva - a.base_sem_iva);

  return out;
}

/**
 * Helper: mês atual (UTC) — útil para telas "Mês Atual"
 */
export function getAnoMesAtualUtc(): { ano: number; mes: number } {
  const now = new Date();
  return { ano: now.getUTCFullYear(), mes: now.getUTCMonth() + 1 };
}
