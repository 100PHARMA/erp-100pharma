'use client';

import { TrendingUp, Package, ShoppingCart, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Bem-vindo ao Sistema
          </h1>
          <p className="text-gray-600">Escolha uma opção abaixo para começar</p>
        </div>

        {/* Menu Principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <a
            href="/vendas"
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 group cursor-pointer"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-blue-600 p-4 rounded-xl group-hover:bg-blue-700 transition-colors">
                <ShoppingCart className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors mb-2">
                  Vendas
                </h3>
                <p className="text-sm text-gray-600">Gerenciar vendas e orçamentos</p>
              </div>
            </div>
          </a>

          <a
            href="/produtos"
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 group cursor-pointer"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-green-600 p-4 rounded-xl group-hover:bg-green-700 transition-colors">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-green-600 transition-colors mb-2">
                  Produtos
                </h3>
                <p className="text-sm text-gray-600">Controle de estoque</p>
              </div>
            </div>
          </a>

          <a
            href="/clientes"
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 group cursor-pointer"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-purple-600 p-4 rounded-xl group-hover:bg-purple-700 transition-colors">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors mb-2">
                  Clientes
                </h3>
                <p className="text-sm text-gray-600">Cadastro de clientes</p>
              </div>
            </div>
          </a>

          <a
            href="/vendedores"
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 group cursor-pointer"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="bg-orange-600 p-4 rounded-xl group-hover:bg-orange-700 transition-colors">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors mb-2">
                  Vendedores
                </h3>
                <p className="text-sm text-gray-600">Gestão de vendedores</p>
              </div>
            </div>
          </a>
        </div>

        {/* Informação Adicional */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sistema de Gestão</h2>
          <p className="text-gray-600 mb-4">
            Sistema completo para gestão de vendas, produtos, clientes e vendedores.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Gestão de Vendas</h4>
                <p className="text-sm text-gray-600">Controle completo de vendas e orçamentos</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Controle de Estoque</h4>
                <p className="text-sm text-gray-600">Gerencie seus produtos e estoque</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Cadastro de Clientes</h4>
                <p className="text-sm text-gray-600">Mantenha seus clientes organizados</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <TrendingUp className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Gestão de Vendedores</h4>
                <p className="text-sm text-gray-600">Acompanhe performance e comissões</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
