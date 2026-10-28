import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zvixsdcwogzmvdtkopjq.supabase.co';
const SUPABASE_ANON_KEY = 'Sb_publishable_1jaATLbD5gwctJa7-7UkKg_KW8mlSMZ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
