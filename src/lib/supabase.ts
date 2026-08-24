import { createClient } from '@supabase/supabase-js'

import type { Database } from '../types/database.types'
import { getEnvironment } from './env'

const environment = getEnvironment()

export const supabase = createClient<Database>(
  environment.VITE_SUPABASE_URL,
  environment.VITE_SUPABASE_PUBLISHABLE_KEY,
)
