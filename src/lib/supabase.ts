import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('🔧 Supabase Configuration:');
console.log('  URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('  Key:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
console.log('  Full URL:', supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  },
  global: {
    headers: {
      'x-client-info': 'meditrack-v1'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Test connection on load
supabase.from('medications').select('count', { count: 'exact', head: true }).then(({ error, count }) => {
  if (error) {
    console.error('❌ Supabase connection test failed:', error);
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    console.error('   Error details:', error.details);
    console.error('   Error hint:', error.hint);
  } else {
    console.log('✅ Supabase connection successful!');
    console.log(`   Medications table accessible (${count ?? 0} records)`);
  }
});

export default supabase;
