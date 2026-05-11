import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hitowyopdadwrgpargph.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdG93eW9wZGFkd3JncGFyZ3BoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIyMDEyMDAsImV4cCI6MTk0Nzc3MTIwMH0.6Rkl3L8cKhZp4ZnvE9qJ9Q8xJ7vL2mK3yZ5aB8cD1eI';

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
