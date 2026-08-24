import { createClient } from '@supabase/supabase-js'

import { getEnvironment } from './env'

const environment = getEnvironment()

export const supabase = createClient(
  environment.VITE_SUPABASE_URL,
  environment.VITE_SUPABASE_PUBLISHABLE_KEY,
)
