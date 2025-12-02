import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ ERRO: Variáveis de ambiente do Supabase não configuradas!');
  console.error('Por favor, configure:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Cliente Supabase com configuração otimizada
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    },
  },
  db: {
    schema: 'public',
  },
});

// Log para debug (apenas em desenvolvimento)
if (typeof window !== 'undefined') {
  console.log('🔧 Supabase configurado:', {
    url: supabaseUrl ? '✅ Configurado' : '❌ Faltando',
    key: supabaseAnonKey ? '✅ Configurado' : '❌ Faltando',
  });
}
