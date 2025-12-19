'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  Award,
  Save,
  AlertCircle,
  Target,
  Users,
  RefreshCw,
} from 'lucide-react';

import {
  configuracaoEmpresa,
  configuracaoFiscal,
  bonusVolumeMensal,
  bonusMarcoAnual,
} from '@/lib/data';

import {
  buscarConfiguracaoFinanceira,
  criarConfiguracaoFinanceira,
  type ConfiguracaoFinanceira,
} from '@/lib/configuracoes-financeiras';

import {
  listarVendedores,
  listarMetasMensaisDoMes,
  upsertMetaMensal,
  type VendedorMetaMensalRow,
  type VendedorRow,
} from '@/lib/vendedor-metas-mensais';

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function monthInputValueFrom(ano: number, mes: number) {
  return `${ano}-${pad2(mes)}`;
}

function parseMonthInput(value: string): { ano: number; mes: number } | null {
  // value esperado: YYYY-MM
  if (!value || value.length < 7) return null;
  const [y, m] = value.split('-');
  const ano = Number(y);
  const mes = Number(m);
  if (!ano || !mes || mes < 1 || mes > 12) return null;
  return { ano, mes };
}

function clampPercent(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<
    'empresa' | 'fiscal' | 'financeiro' | 'comissoes' | 'config-financeira'
  >('empresa');

  const [configFinanceira, setConfigFinanceira] = useState<ConfiguracaoFinanceira | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // ----------------------------
  // FORM: Configurações Financeiras (globais)
  // ----------------------------
  const [formConfig, setFormConfig] = useState({
    // Meta e Faixas
    meta_mensal: 0,
    faixa1_limite: 0,
    comissao_faixa1: 0,
    faixa2_limite: 0,
    comissao_faixa2: 0,
    comissao_faixa3: 0,
    // Incentivos e Fundos
    incentivo_podologista: 0,
    fundo_farmaceutico: 0,
    // Parâmetros Financeiros
    custo_aquisicao_padrao: 0,
    custo_variavel_padrao: 0,
    valor_km: 0,
    custo_fixo_mensal: 0,
    capital_giro_ideal: 0,
    // Comissões Avançadas
    comissao_farmacia_nova: 0,
    comissao_farmacia_ativa: 0,
    teto_mensal_farmacia_ativa: 0,
    limite_farmacias_vendedor: 0,
  });

  // ----------------------------
  // UI: Metas mensais por vendedor (vendedor_metas_mensais)
  // ----------------------------
  const now = useMemo(() => new Date(), []);
  const [metasMesAno, setMetasMesAno] = useState(() => {
    const ano = now.getFullYear();
    const mes = now.getMonth() + 1;
    return { ano, mes };
  });

  const [vendedores, setVendedores] = useState<VendedorRow[]>([]);
  const [metasByVendedor, setMetasByVendedor] = useState<Record<string, VendedorMetaMensalRow>>({});
  const [carregandoMetas, setCarregandoMetas] = useState(false);
  const [salvandoMetas, setSalvandoMetas] = useState(false);
  const [erroMetas, setErroMetas] = useState<string | null>(null);
  const [sucessoMetas, setSucessoMetas] = useState(false);

  const tabs = [
    { id: 'empresa' as const, label: 'Empresa', icon: Building2 },
    { id: 'fiscal' as const, label: 'Fiscal', icon: FileText },
    { id: 'financeiro' as const, label: 'Financeiro', icon: DollarSign },
    { id: 'comissoes' as const, label: 'Comissões', icon: TrendingUp },
    { id: 'config-financeira' as const, label: 'Configurações Financeiras', icon: Settings },
  ];

  // Carregar configuração financeira ao montar o componente ou trocar para abas relevantes
  useEffect(() => {
    if (activeTab === 'config-financeira' || activeTab === 'financeiro' || activeTab === 'comissoes') {
      carregarConfiguracao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Sempre que entrar na aba de config financeira: carregar vendedores + metas do mês selecionado
  useEffect(() => {
    if (activeTab === 'config-financeira') {
      carregarVendedoresEMetas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, metasMesAno.ano, metasMesAno.mes]);

  const carregarConfiguracao = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const config = await buscarConfiguracaoFinanceira();
      setConfigFinanceira(config);

      setFormConfig({
        meta_mensal: config.meta_mensal || 0,
        faixa1_limite: config.faixa1_limite || 0,
        comissao_faixa1: config.comissao_faixa1 || 0,
        faixa2_limite: config.faixa2_limite || 0,
        comissao_faixa2: config.comissao_faixa2 || 0,
        comissao_faixa3: config.comissao_faixa3 || 0,
        incentivo_podologista: config.incentivo_podologista || 0,
        fundo_farmaceutico: config.fundo_farmaceutico || 0,
        custo_aquisicao_padrao: config.custo_aquisicao_padrao || 0,
        custo_variavel_padrao: config.custo_variavel_padrao || 0,
        valor_km: config.valor_km || 0,
        custo_fixo_mensal: config.custo_fixo_mensal || 0,
        capital_giro_ideal: config.capital_giro_ideal || 0,
        comissao_farmacia_nova: config.comissao_farmacia_nova || 0,
        comissao_farmacia_ativa: config.comissao_farmacia_ativa || 0,
        teto_mensal_farmacia_ativa: config.teto_mensal_farmacia_ativa || 0,
        limite_farmacias_vendedor: config.limite_farmacias_vendedor || 0,
      });
    } catch (error: any) {
      console.error('Erro ao carregar configuração:', error);
      setErro('Erro ao carregar configurações: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  const salvarConfiguracao = async () => {
    try {
      setSalvando(true);
      setErro(null);
      setSucesso(false);

      // Validações básicas
      if (formConfig.meta_mensal < 0) throw new Error('Meta mensal não pode ser negativa');
      if (formConfig.faixa1_limite < 0 || formConfig.faixa2_limite < 0)
        throw new Error('Limites de faixas não podem ser negativos');
      if (
        formConfig.faixa2_limite > 0 &&
        formConfig.faixa1_limite > 0 &&
        formConfig.faixa2_limite <= formConfig.faixa1_limite
      ) {
        throw new Error('Limite da Faixa 2 deve ser maior que o limite da Faixa 1');
      }

      // INSERT (histórico)
      await criarConfiguracaoFinanceira(formConfig);

      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);

      await carregarConfiguracao();

      // Importante: se você quiser que os defaults na UI de metas por vendedor
      // reflitam imediatamente, basta forçar um refresh da tabela:
      if (activeTab === 'config-financeira') {
        await carregarVendedoresEMetas();
      }
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      setErro(error.message || 'Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  };

  const carregarVendedoresEMetas = async () => {
    try {
      setCarregandoMetas(true);
      setErroMetas(null);

      // 1) vendedores
      const vs = await listarVendedores();
      setVendedores(vs);

      // 2) metas do mês
      const metas = await listarMetasMensaisDoMes(metasMesAno.ano, metasMesAno.mes);

      const map: Record<string, VendedorMetaMensalRow> = {};
      for (const m of metas) {
        map[m.vendedor_id] = m;
      }

      setMetasByVendedor(map);
    } catch (e: any) {
      console.error('Erro ao carregar vendedores/metas:', e);
      setErroMetas(e?.message ?? 'Erro ao carregar metas mensais');
    } finally {
      setCarregandoMetas(false);
    }
  };

  const getRowForVendedor = (vendedorId: string): VendedorMetaMensalRow => {
    const existing = metasByVendedor[vendedorId];
    if (existing) return existing;

    // Sem meta cadastrada: usar defaults globais (A)
    return {
      vendedor_id: vendedorId,
      ano: metasMesAno.ano,
      mes: metasMesAno.mes,
      meta_mensal: formConfig.meta_mensal ?? 0,

      faixa1_limite: formConfig.faixa1_limite ?? 0,
      faixa1_percent: formConfig.comissao_faixa1 ?? 0,

      faixa2_limite: formConfig.faixa2_limite ?? 0,
      faixa2_percent: formConfig.comissao_faixa2 ?? 0,

      // faixa3_limite pode ficar null (sem limite), mas guardamos mesmo assim se quiser
      faixa3_limite: null,
      faixa3_percent: formConfig.comissao_faixa3 ?? 0,
    };
  };

  const updateMetaRow = (vendedorId: string, patch: Partial<VendedorMetaMensalRow>) => {
    setMetasByVendedor((prev) => {
      const base = getRowForVendedor(vendedorId);
      const next: VendedorMetaMensalRow = {
        ...base,
        ...patch,
        vendedor_id: vendedorId,
        ano: metasMesAno.ano,
        mes: metasMesAno.mes,
      };
      return { ...prev, [vendedorId]: next };
    });
  };

  const validarLinhaMeta = (row: VendedorMetaMensalRow) => {
    const meta = Number(row.meta_mensal ?? 0);
    const f1 = Number(row.faixa1_limite ?? 0);
    const f2 = Number(row.faixa2_limite ?? 0);
    const p1 = Number(row.faixa1_percent ?? 0);
    const p2 = Number(row.faixa2_percent ?? 0);
    const p3 = Number(row.faixa3_percent ?? 0);

    if (meta < 0) return 'Meta mensal não pode ser negativa';
    if (f1 < 0 || f2 < 0) return 'Limites não podem ser negativos';
    if (f1 > 0 && f2 > 0 && f2 <= f1) return 'Faixa 2 deve ser maior que Faixa 1';
    if (p1 < 0 || p2 < 0 || p3 < 0) return 'Percentuais não podem ser negativos';
    if (p1 > 100 || p2 > 100 || p3 > 100) return 'Percentuais não podem passar de 100%';
    return null;
  };

  const salvarMetasDoMes = async () => {
    try {
      setSalvandoMetas(true);
      setErroMetas(null);
      setSucessoMetas(false);

      if (vendedores.length === 0) throw new Error('Nenhum vendedor encontrado.');

      // montar payload de TODOS os vendedores (mesmo sem meta cadastrada)
      const payloads: VendedorMetaMensalRow[] = vendedores.map((v) => {
        const r = getRowForVendedor(v.id);

        // normalizar números
        const normalized: VendedorMetaMensalRow = {
          ...r,
          vendedor_id: v.id,
          ano: metasMesAno.ano,
          mes: metasMesAno.mes,
          meta_mensal: Number(r.meta_mensal ?? 0),

          faixa1_limite: Number(r.faixa1_limite ?? 0),
          faixa1_percent: clampPercent(Number(r.faixa1_percent ?? 0)),

          faixa2_limite: Number(r.faixa2_limite ?? 0),
          faixa2_percent: clampPercent(Number(r.faixa2_percent ?? 0)),

          faixa3_limite: r.faixa3_limite === null ? null : Number(r.faixa3_limite ?? 0),
          faixa3_percent: clampPercent(Number(r.faixa3_percent ?? 0)),
        };

        const err = validarLinhaMeta(normalized);
        if (err) {
          throw new Error(`Vendedor "${v.nome}": ${err}`);
        }

        return normalized;
      });

      // Upsert por vendedor (simples e seguro)
      await Promise.all(payloads.map((p) => upsertMetaMensal(p)));

      setSucessoMetas(true);
      setTimeout(() => setSucessoMetas(false), 3000);

      // Recarregar para refletir ids e dados do banco
      await carregarVendedoresEMetas();
    } catch (e: any) {
      console.error('Erro ao salvar metas:', e);
      setErroMetas(e?.message ?? 'Erro ao salvar metas mensais');
    } finally {
      setSalvandoMetas(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Configurações</h1>
            <p className="text-gray-600 text-sm sm:text-base">Gestão de parâmetros do sistema</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-lg mb-6 overflow-x-auto">
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium text-sm transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        {activeTab === 'empresa' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Dados da Empresa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome da Empresa</label>
                <input
                  type="text"
                  defaultValue={configuracaoEmpresa.nomeEmpresa}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">NIF</label>
                <input
                  type="text"
                  defaultValue={configuracaoEmpresa.nif}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Morada</label>
                <input
                  type="text"
                  defaultValue={configuracaoEmpresa.morada}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Código Postal</label>
                <input
                  type="text"
                  defaultValue={configuracaoEmpresa.codigoPostal}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Localidade</label>
                <input
                  type="text"
                  defaultValue={configuracaoEmpresa.localidade}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telefone</label>
                <input
                  type="text"
                  defaultValue={configuracaoEmpresa.telefone}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  defaultValue={configuracaoEmpresa.email}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                <input
                  type="text"
                  defaultValue={configuracaoEmpresa.website}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">IBAN</label>
                <input
                  type="text"
                  defaultValue={configuracaoEmpresa.iban}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fiscal' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Configurações Fiscais</h2>

            {/* Tabela IVA */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Taxas de IVA</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Percentagem</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Descrição</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Ativo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {configuracaoFiscal.tabelaIVA.map((taxa) => (
                      <tr key={taxa.id}>
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900">{taxa.percentagem}%</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-gray-600">{taxa.descricao}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            defaultChecked={taxa.ativo}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Séries de Fatura */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Séries de Fatura</h3>
              <div className="space-y-4">
                {configuracaoFiscal.seriesFatura.map((serie) => (
                  <div key={serie.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">Série: {serie.serie}</p>
                      <p className="text-sm text-gray-600">Último número: {serie.ultimoNumero}</p>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        defaultChecked={serie.ativo}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Ativo</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA FINANCEIRO */}
        {activeTab === 'financeiro' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Parâmetros Financeiros</h2>

            {carregando ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando configurações...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custo de Aquisição Padrão (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formConfig.custo_aquisicao_padrao}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, custo_aquisicao_padrao: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custo Variável Padrão (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formConfig.custo_variavel_padrao}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, custo_variavel_padrao: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Valor por KM (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formConfig.valor_km}
                      onChange={(e) => setFormConfig({ ...formConfig, valor_km: Number(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custo Fixo Mensal (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formConfig.custo_fixo_mensal}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, custo_fixo_mensal: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Capital de Giro Ideal (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formConfig.capital_giro_ideal}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, capital_giro_ideal: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <button
                    onClick={salvarConfiguracao}
                    disabled={salvando}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {salvando ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span className="font-medium">Guardar Alterações</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ABA COMISSÕES */}
        {activeTab === 'comissoes' && (
          <div className="space-y-8">
            {carregando ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando configurações...</p>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Comissões Avançadas</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Comissão Farmácia Nova (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formConfig.comissao_farmacia_nova}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, comissao_farmacia_nova: Number(e.target.value) })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Comissão Farmácia Ativa (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formConfig.comissao_farmacia_ativa}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, comissao_farmacia_ativa: Number(e.target.value) })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Teto Mensal Farmácia Ativa (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formConfig.teto_mensal_farmacia_ativa}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            teto_mensal_farmacia_ativa: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Limite Farmácias por Vendedor</label>
                      <input
                        type="number"
                        min="0"
                        value={formConfig.limite_farmacias_vendedor}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            limite_farmacias_vendedor: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Bónus por Volume Mensal</h2>
                  <div className="space-y-3">
                    {bonusVolumeMensal.map((bonus) => (
                      <div key={bonus.id} className="flex items-center gap-4 p-4 bg-orange-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{bonus.quantidadeFrascos.toLocaleString('pt-PT')} frascos</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-orange-600" />
                          <span className="font-bold text-orange-600">{bonus.valorBonus.toLocaleString('pt-PT')}€</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Bónus por Marcos Anuais</h2>
                  <div className="space-y-3">
                    {bonusMarcoAnual.map((bonus) => (
                      <div key={bonus.id} className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{bonus.quantidadeNovasFarmacias} novas farmácias</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-purple-600" />
                          <span className="font-bold text-purple-600">{bonus.valorBonus.toLocaleString('pt-PT')}€</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <button
                    onClick={salvarConfiguracao}
                    disabled={salvando}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {salvando ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span className="font-medium">Guardar Alterações</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ABA: CONFIGURAÇÕES FINANCEIRAS */}
        {activeTab === 'config-financeira' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Configurações Financeiras</h2>
              <p className="text-sm text-gray-600">
                Configure os parâmetros globais e as metas mensais por vendedor. Comissões, metas e incentivos usarão estes valores.
              </p>
            </div>

            {/* Feedback (globais) */}
            {erro && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">Erro</p>
                  <p className="text-sm text-red-700">{erro}</p>
                </div>
              </div>
            )}

            {sucesso && (
              <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs">✓</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">Sucesso!</p>
                  <p className="text-sm text-green-700">Configurações salvas com sucesso.</p>
                </div>
              </div>
            )}

            {carregando ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Carregando configurações...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Meta global */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">Meta Mensal Global (padrão)</h3>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">Meta Mensal (€)</label>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={formConfig.meta_mensal}
                      onChange={(e) => setFormConfig({ ...formConfig, meta_mensal: Number(e.target.value) })}
                      className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                    />
                    <p className="text-xs text-blue-700 mt-2">
                      Meta padrão (fallback). Se um vendedor não tiver meta cadastrada no mês, a página “Metas” pode usar este valor.
                    </p>
                  </div>
                </div>

                {/* Faixas globais */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-green-900 mb-4">Faixas de Comissão Progressiva (globais)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                      <p className="text-sm font-bold text-green-800 mb-3">Faixa 1</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Limite (€)</label>
                          <input
                            type="number"
                            step="100"
                            min="0"
                            value={formConfig.faixa1_limite}
                            onChange={(e) => setFormConfig({ ...formConfig, faixa1_limite: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Comissão (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formConfig.comissao_faixa1}
                            onChange={(e) =>
                              setFormConfig({ ...formConfig, comissao_faixa1: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">Até {formConfig.faixa1_limite.toLocaleString('pt-PT')}€</p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                      <p className="text-sm font-bold text-blue-800 mb-3">Faixa 2</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Limite (€)</label>
                          <input
                            type="number"
                            step="100"
                            min="0"
                            value={formConfig.faixa2_limite}
                            onChange={(e) => setFormConfig({ ...formConfig, faixa2_limite: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Comissão (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formConfig.comissao_faixa2}
                            onChange={(e) =>
                              setFormConfig({ ...formConfig, comissao_faixa2: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">
                        De {formConfig.faixa1_limite.toLocaleString('pt-PT')}€ até {formConfig.faixa2_limite.toLocaleString('pt-PT')}€
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm font-bold text-purple-800 mb-3">Faixa 3</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Limite (€)</label>
                          <input
                            type="text"
                            value="Sem limite"
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Comissão (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formConfig.comissao_faixa3}
                            onChange={(e) =>
                              setFormConfig({ ...formConfig, comissao_faixa3: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">Acima de {formConfig.faixa2_limite.toLocaleString('pt-PT')}€</p>
                    </div>
                  </div>
                </div>

                {/* Incentivos */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-orange-900 mb-4">Incentivos e Fundos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-orange-800 mb-2">
                        Incentivo Podologista por Frasco (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formConfig.incentivo_podologista}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, incentivo_podologista: Number(e.target.value) })
                        }
                        className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-semibold"
                      />
                      <p className="text-xs text-orange-700 mt-2">Valor pago ao podologista por cada frasco vendido</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-orange-800 mb-2">
                        Fundo Farmacêutico por Frasco (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formConfig.fundo_farmaceutico}
                        onChange={(e) =>
                          setFormConfig({ ...formConfig, fundo_farmaceutico: Number(e.target.value) })
                        }
                        className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-semibold"
                      />
                      <p className="text-xs text-orange-700 mt-2">Valor destinado ao fundo farmacêutico (Farmácia Campeã)</p>
                    </div>
                  </div>
                </div>

                {/* BOTÃO salvar config global */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={salvarConfiguracao}
                    disabled={salvando}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-4 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {salvando ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>Guardar Configurações</span>
                      </>
                    )}
                  </button>
                </div>

                {/* =======================
                    METAS MENSAIS POR VENDEDOR (REAL)
                   ======================= */}
                <div className="rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="p-6 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-xl">
                          <Target className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">Metas Mensais por Vendedor</h3>
                          <p className="text-sm text-gray-600">
                            Define metas e faixas por vendedor para o mês. Se não existir cadastro, o sistema usa os valores globais (fallback).
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-700">Mês:</label>
                          <input
                            type="month"
                            value={monthInputValueFrom(metasMesAno.ano, metasMesAno.mes)}
                            onChange={(e) => {
                              const parsed = parseMonthInput(e.target.value);
                              if (parsed) setMetasMesAno(parsed);
                            }}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          />
                        </div>

                        <button
                          onClick={carregarVendedoresEMetas}
                          disabled={carregandoMetas}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${carregandoMetas ? 'animate-spin' : ''}`} />
                          Atualizar
                        </button>
                      </div>
                    </div>

                    {/* feedback metas */}
                    {erroMetas && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900">Erro nas metas</p>
                          <p className="text-sm text-red-700">{erroMetas}</p>
                        </div>
                      </div>
                    )}

                    {sucessoMetas && (
                      <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                        <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs">✓</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900">Metas salvas!</p>
                          <p className="text-sm text-green-700">As metas do mês foram atualizadas com sucesso.</p>
                        </div>
                      </div>
                    )}

                    {/* conteúdo metas */}
                    {carregandoMetas ? (
                      <div className="py-10 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                          <p className="text-gray-600">Carregando metas...</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
                          <Users className="w-4 h-4" />
                          <span>{vendedores.length} vendedores</span>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vendedor</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Meta (€)</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">F1 Limite (€)</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">F1 %</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">F2 Limite (€)</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">F2 %</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">F3 %</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {vendedores.map((v) => {
                                const r = getRowForVendedor(v.id);
                                const hasDb = Boolean(metasByVendedor[v.id]?.id);

                                return (
                                  <tr key={v.id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{v.nome}</span>
                                        <span
                                          className={`text-xs px-2 py-1 rounded-full ${
                                            hasDb ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                                          }`}
                                        >
                                          {hasDb ? 'cadastrado' : 'fallback global'}
                                        </span>
                                      </div>
                                    </td>

                                    <td className="py-3 px-4 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={Number(r.meta_mensal ?? 0)}
                                        onChange={(e) => updateMetaRow(v.id, { meta_mensal: Number(e.target.value) })}
                                        className="w-32 text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </td>

                                    <td className="py-3 px-4 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={Number(r.faixa1_limite ?? 0)}
                                        onChange={(e) => updateMetaRow(v.id, { faixa1_limite: Number(e.target.value) })}
                                        className="w-32 text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </td>

                                    <td className="py-3 px-4 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={Number(r.faixa1_percent ?? 0)}
                                        onChange={(e) => updateMetaRow(v.id, { faixa1_percent: Number(e.target.value) })}
                                        className="w-24 text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </td>

                                    <td className="py-3 px-4 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={Number(r.faixa2_limite ?? 0)}
                                        onChange={(e) => updateMetaRow(v.id, { faixa2_limite: Number(e.target.value) })}
                                        className="w-32 text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </td>

                                    <td className="py-3 px-4 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={Number(r.faixa2_percent ?? 0)}
                                        onChange={(e) => updateMetaRow(v.id, { faixa2_percent: Number(e.target.value) })}
                                        className="w-24 text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </td>

                                    <td className="py-3 px-4 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={Number(r.faixa3_percent ?? 0)}
                                        onChange={(e) => updateMetaRow(v.id, { faixa3_percent: Number(e.target.value) })}
                                        className="w-24 text-right px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="mt-6 flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={salvarMetasDoMes}
                            disabled={salvandoMetas || vendedores.length === 0}
                            className="sm:w-auto w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {salvandoMetas ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                <span>Salvando metas...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-5 h-5" />
                                <span>Guardar Metas do Mês</span>
                              </>
                            )}
                          </button>

                          <div className="text-sm text-gray-600 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            <span>
                              Requisito: a tabela deve ter constraint única para <b>(vendedor_id, ano, mes)</b> para o upsert funcionar corretamente.
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Info global */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-1">Importante</p>
                      <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                        <li>Ao salvar configurações globais, um novo registro será criado (histórico mantido)</li>
                        <li>O sistema sempre usará o registro global mais recente</li>
                        <li>Metas por vendedor sobrescrevem o fallback global para o mês</li>
                        <li>As alterações impactam dashboards e cálculos (metas e comissões)</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button (aba empresa e fiscal - não conectadas ao Supabase ainda) */}
        {(activeTab === 'empresa' || activeTab === 'fiscal') && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105">
              <Save className="w-5 h-5" />
              <span className="font-medium">Guardar Alterações</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

