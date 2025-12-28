// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ ERRO: Variáveis de ambiente do Supabase não configuradas!');
  console.error('Por favor, configure:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// IMPORTANTE:
// - persistSession: true => grava sessão no storage do browser (senão LOCAL STORAGE fica vazio)
// - autoRefreshToken: true => evita expirar e “deslogar” do nada
// - detectSessionInUrl: true => útil para flows de reset/login magic link (não atrapalha)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'erp-100pharma-auth',
  },
  db: {
    schema: 'public',
  },
});

// Debug opcional
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('🔧 Supabase configurado:', {
    url: supabaseUrl ? '✅ Configurado' : '❌ Faltando',
    key: supabaseAnonKey ? '✅ Configurado' : '❌ Faltando',
    storageKey: 'erp-100pharma-auth',
  });
}
