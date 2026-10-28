import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zvixsdcwogzmvdtkopjq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_1jaATLbD5gwCtJa7-...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
