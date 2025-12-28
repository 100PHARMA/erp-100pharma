import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ ERRO: Variáveis de ambiente do Supabase não configuradas!');
  console.error('Por favor, configure:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

/**
 * IMPORTANTE:
 * - persistSession=true: mantém sessão no browser (localStorage)
 * - autoRefreshToken=true: renova token automaticamente
 * - detectSessionInUrl=true: necessário para fluxos de login/password reset magic link etc
 * - storageKey fixo: evita conflito entre projetos/domínios
 * - singleton no browser: evita múltiplas instâncias com estado divergente
 */
let browserClient: SupabaseClient | null = null;

function createBrowserClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'erp-100pharma-auth',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    global: {
      // NÃO precisa setar apikey manualmente; o supabase-js já usa a key do createClient
      headers: {
        'X-Client-Info': 'erp-100pharma',
      },
    },
    db: {
      schema: 'public',
    },
  });
}

export const supabase: SupabaseClient =
  typeof window === 'undefined'
    ? // server-side: ainda pode existir import acidental; evita crash
      (createClient(supabaseUrl, supabaseAnonKey, {
        db: { schema: 'public' },
      }) as SupabaseClient)
    : (browserClient ?? (browserClient = createBrowserClient()));

// Log para debug (apenas em desenvolvimento)
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  console.log('🔧 Supabase configurado:', {
    url: supabaseUrl ? '✅ Configurado' : '❌ Faltando',
    key: supabaseAnonKey ? '✅ Configurado' : '❌ Faltando',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'erp-100pharma-auth',
  });
}
