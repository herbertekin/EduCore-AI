import { supabase } from './supabase'

export async function testConnection() {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name')
    .limit(5)

  if (error) {
    console.error('Supabase connection failed:', error)
    return
  }

  console.log('Supabase connection successful:', data)
}