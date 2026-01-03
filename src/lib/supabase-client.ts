'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

// Singleton no browser (cookie-based auth)
export const supabase = createSupabaseBrowserClient();
