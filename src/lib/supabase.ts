import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hitowyopdadwrgpargph.supabase.co';
const supabaseAnonKey = 'PASTE_YOUR_ANON_KEY_HERE';

// Initialize only if key is provided
export const supabase = supabaseAnonKey !== 'PASTE_YOUR_ANON_KEY_HERE'
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

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
