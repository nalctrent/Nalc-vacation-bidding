import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zvixsdcwogzmvdtkopjq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aXhzZGN3b2d6bXZkdGtvcGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjcwNDUsImV4cCI6MjEwODgwMzA0NX0.LDHZC7SjEBdSVvdm1aVXvZ7MmueIwHwEnK5z6EQfYws';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
