import { createClient } from '@supabase/supabase-js';

// Configure with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (see .env.example).
// The anon key is public by design; access is governed by the database's row-level security.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hitowyopdadwrgpargph.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdG93eW9wZGFkd3JncGFyZ3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODc2MjcsImV4cCI6MjA5NDA2MzYyN30.e8gcRNhseq2CdkLYZLadDhn5zPhw6XWjqVAnDWsRxJs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Supabase Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
