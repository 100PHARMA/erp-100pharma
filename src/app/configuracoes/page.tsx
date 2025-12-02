'use client';

import { useState, useEffect } from 'react';
import { Settings, Building2, FileText, DollarSign, TrendingUp, Award, Save, AlertCircle } from 'lucide-react';
import {
  configuracaoEmpresa,
  configuracaoFiscal,
  parametrosFinanceiros,
  comissaoFase1,
  comissaoFase2,
  bonusVolumeMensal,
  bonusMarcoAnual,
} from '@/lib/data';
import {
  buscarConfiguracaoFinanceira,
  criarConfiguracaoFinanceira,
  type ConfiguracaoFinanceira,
} from '@/lib/configuracoes-financeiras';

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<'empresa' | 'fiscal' | 'financeiro' | 'comissoes' | 'config-financeira'>('empresa');
  const [configFinanceira, setConfigFinanceira] = useState<ConfiguracaoFinanceira | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  // Estados para o formulário de configuração financeira
  const [formConfig, setFormConfig] = useState({
    meta_mensal_vendedor: 7000,
    faixa1_limite: 3000,
    comissao_faixa1_percent: 5,
    faixa2_limite: 7000,
    comissao_faixa2_percent: 8,
    comissao_faixa3_percent: 10,
    incentivo_podologista_por_frasco: 1.0,
    fundo_farmaceutico_por_frasco: 0.28,
  });

  const tabs = [
    { id: 'empresa' as const, label: 'Empresa', icon: Building2 },
    { id: 'fiscal' as const, label: 'Fiscal', icon: FileText },
    { id: 'financeiro' as const, label: 'Financeiro', icon: DollarSign },
    { id: 'comissoes' as const, label: 'Comissões', icon: TrendingUp },
    { id: 'config-financeira' as const, label: 'Configurações Financeiras', icon: Settings },
  ];

  // Carregar configuração financeira ao montar o componente
  useEffect(() => {
    if (activeTab === 'config-financeira') {
      carregarConfiguracao();
    }
  }, [activeTab]);

  const carregarConfiguracao = async () => {
    try {
      setCarregando(true);
      setErro(null);
      const config = await buscarConfiguracaoFinanceira();
      setConfigFinanceira(config);
      setFormConfig({
        meta_mensal_vendedor: config.meta_mensal_vendedor,
        faixa1_limite: config.faixa1_limite,
        comissao_faixa1_percent: config.comissao_faixa1_percent,
        faixa2_limite: config.faixa2_limite,
        comissao_faixa2_percent: config.comissao_faixa2_percent,
        comissao_faixa3_percent: config.comissao_faixa3_percent,
        incentivo_podologista_por_frasco: config.incentivo_podologista_por_frasco,
        fundo_farmaceutico_por_frasco: config.fundo_farmaceutico_por_frasco,
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

      // Validações
      if (formConfig.meta_mensal_vendedor <= 0) {
        throw new Error('Meta mensal deve ser maior que zero');
      }
      if (formConfig.faixa1_limite <= 0 || formConfig.faixa2_limite <= 0) {
        throw new Error('Limites de faixas devem ser maiores que zero');
      }
      if (formConfig.faixa2_limite <= formConfig.faixa1_limite) {
        throw new Error('Limite da Faixa 2 deve ser maior que o limite da Faixa 1');
      }
      if (
        formConfig.comissao_faixa1_percent < 0 ||
        formConfig.comissao_faixa2_percent < 0 ||
        formConfig.comissao_faixa3_percent < 0
      ) {
        throw new Error('Percentagens de comissão não podem ser negativas');
      }

      // Criar novo registro (histórico)
      await criarConfiguracaoFinanceira(formConfig);

      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);

      // Recarregar configuração
      await carregarConfiguracao();
    } catch (error: any) {
      console.error('Erro ao salvar configuração:', error);
      setErro(error.message || 'Erro ao salvar configurações');
    } finally {
      setSalvando(false);
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
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
              Configurações
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              Gestão de parâmetros do sistema
            </p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome da Empresa
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código Postal
                </label>
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
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Percentagem
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                        Descrição
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                        Ativo
                      </th>
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
                      <p className="text-sm text-gray-600">
                        Último número: {serie.ultimoNumero}
                      </p>
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

        {activeTab === 'financeiro' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Parâmetros Financeiros</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custo de Aquisição Padrão (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={parametrosFinanceiros.custoAquisicaoPadrao}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custo Variável Padrão (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={parametrosFinanceiros.custoVariavelPadrao}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Valor por KM (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={parametrosFinanceiros.valorKm}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custo Fixo Mensal (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={parametrosFinanceiros.custoFixoMensal}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Capital de Giro Ideal (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  defaultValue={parametrosFinanceiros.capitalGiroIdeal}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comissoes' && (
          <div className="space-y-8">
            {/* Fase 1 */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Comissões Fase 1 (Faixas)</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percentagem 1 (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={comissaoFase1.percentagem1}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Até {comissaoFase1.limite1.toLocaleString('pt-PT')}€
                  </p>
                </div>

                <div className="bg-blue-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percentagem 2 (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={comissaoFase1.percentagem2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Até {comissaoFase1.limite2.toLocaleString('pt-PT')}€
                  </p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percentagem 3 (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={comissaoFase1.percentagem3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Acima de {comissaoFase1.limite2.toLocaleString('pt-PT')}€
                  </p>
                </div>
              </div>
            </div>

            {/* Fase 2 */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Comissões Fase 2 (Avançada)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comissão Farmácia Nova (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={comissaoFase2.valorComissaoFarmaciaNova}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comissão Farmácia Ativa (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={comissaoFase2.valorComissaoFarmaciaAtiva}
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
                    defaultValue={comissaoFase2.tetoMensalComissaoFarmaciaAtiva}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Limite Farmácias por Vendedor
                  </label>
                  <input
                    type="number"
                    defaultValue={comissaoFase2.limiteFarmaciasPorVendedor}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Bónus Volume */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Bónus por Volume Mensal</h2>
              <div className="space-y-3">
                {bonusVolumeMensal.map((bonus) => (
                  <div key={bonus.id} className="flex items-center gap-4 p-4 bg-orange-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {bonus.quantidadeFrascos.toLocaleString('pt-PT')} frascos
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-orange-600" />
                      <span className="font-bold text-orange-600">
                        {bonus.valorBonus.toLocaleString('pt-PT')}€
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bónus Marcos */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Bónus por Marcos Anuais</h2>
              <div className="space-y-3">
                {bonusMarcoAnual.map((bonus) => (
                  <div key={bonus.id} className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {bonus.quantidadeNovasFarmacias} novas farmácias
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-purple-600" />
                      <span className="font-bold text-purple-600">
                        {bonus.valorBonus.toLocaleString('pt-PT')}€
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA: CONFIGURAÇÕES FINANCEIRAS */}
        {activeTab === 'config-financeira' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Configurações Financeiras</h2>
              <p className="text-sm text-gray-600">
                Configure os parâmetros financeiros globais do sistema. Todos os cálculos de comissões, metas e incentivos usarão estes valores.
              </p>
            </div>

            {/* Mensagens de Feedback */}
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
                {/* Meta Mensal */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">Meta Mensal por Vendedor</h3>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      Meta Mensal (€)
                    </label>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={formConfig.meta_mensal_vendedor}
                      onChange={(e) =>
                        setFormConfig({ ...formConfig, meta_mensal_vendedor: Number(e.target.value) })
                      }
                      className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-semibold"
                    />
                    <p className="text-xs text-blue-700 mt-2">
                      Meta padrão para todos os vendedores (usada no cálculo de percentual de meta)
                    </p>
                  </div>
                </div>

                {/* Faixas de Comissão */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-green-900 mb-4">Faixas de Comissão Progressiva</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Faixa 1 */}
                    <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                      <p className="text-sm font-bold text-green-800 mb-3">Faixa 1</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Limite (€)
                          </label>
                          <input
                            type="number"
                            step="100"
                            min="0"
                            value={formConfig.faixa1_limite}
                            onChange={(e) =>
                              setFormConfig({ ...formConfig, faixa1_limite: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Comissão (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formConfig.comissao_faixa1_percent}
                            onChange={(e) =>
                              setFormConfig({
                                ...formConfig,
                                comissao_faixa1_percent: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">
                        Até {formConfig.faixa1_limite.toLocaleString('pt-PT')}€
                      </p>
                    </div>

                    {/* Faixa 2 */}
                    <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                      <p className="text-sm font-bold text-blue-800 mb-3">Faixa 2</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Limite (€)
                          </label>
                          <input
                            type="number"
                            step="100"
                            min="0"
                            value={formConfig.faixa2_limite}
                            onChange={(e) =>
                              setFormConfig({ ...formConfig, faixa2_limite: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Comissão (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formConfig.comissao_faixa2_percent}
                            onChange={(e) =>
                              setFormConfig({
                                ...formConfig,
                                comissao_faixa2_percent: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">
                        De {formConfig.faixa1_limite.toLocaleString('pt-PT')}€ até{' '}
                        {formConfig.faixa2_limite.toLocaleString('pt-PT')}€
                      </p>
                    </div>

                    {/* Faixa 3 */}
                    <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                      <p className="text-sm font-bold text-purple-800 mb-3">Faixa 3</p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Limite (€)
                          </label>
                          <input
                            type="text"
                            value="Sem limite"
                            disabled
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Comissão (%)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={formConfig.comissao_faixa3_percent}
                            onChange={(e) =>
                              setFormConfig({
                                ...formConfig,
                                comissao_faixa3_percent: Number(e.target.value),
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-3">
                        Acima de {formConfig.faixa2_limite.toLocaleString('pt-PT')}€
                      </p>
                    </div>
                  </div>
                </div>

                {/* Incentivos e Fundos */}
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
                        value={formConfig.incentivo_podologista_por_frasco}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            incentivo_podologista_por_frasco: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-semibold"
                      />
                      <p className="text-xs text-orange-700 mt-2">
                        Valor pago ao podologista por cada frasco vendido
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-orange-800 mb-2">
                        Fundo Farmacêutico por Frasco (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formConfig.fundo_farmaceutico_por_frasco}
                        onChange={(e) =>
                          setFormConfig({
                            ...formConfig,
                            fundo_farmaceutico_por_frasco: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-semibold"
                      />
                      <p className="text-xs text-orange-700 mt-2">
                        Valor destinado ao fundo farmacêutico (Campanha Farmácia Campeã)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Botão Salvar */}
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

                {/* Informação Adicional */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 mb-1">Importante</p>
                      <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                        <li>Ao salvar, um novo registro será criado (histórico mantido)</li>
                        <li>O sistema sempre usará o registro mais recente</li>
                        <li>Todos os cálculos de comissões e metas usarão estes valores</li>
                        <li>As alterações afetarão todos os vendedores do sistema</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save Button (outras abas) */}
        {activeTab !== 'config-financeira' && (
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
