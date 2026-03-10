import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Decode the `sub` claim from a Bearer JWT without a network round-trip. */
function extractSubFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const payloadB64 = token.split('.')[1]
    const json = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    return (json.sub as string) || null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Admin client: elevated privileges for all DB and Auth Admin operations
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    // Verify caller identity from JWT (no extra network call)
    const callerId = extractSubFromJwt(authHeader)
    if (!callerId) {
      return jsonResponse({ error: 'Invalid token' }, 401)
    }

    // Verify caller has admin role
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerId)
      .single()

    if (callerProfileError || !callerProfile || callerProfile.role !== 'admin') {
      return jsonResponse({ error: 'Forbidden: admin access required' }, 403)
    }

    // Parse request body
    let user_id: string
    try {
      const body = await req.json()
      user_id = body?.user_id
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
      return jsonResponse({ error: 'user_id is required' }, 400)
    }

    // Verify the target user exists and has role 'collector'
    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', user_id)
      .single()

    if (targetProfileError || !targetProfile) {
      return jsonResponse({ error: 'User not found' }, 404)
    }

    if (targetProfile.role !== 'collector') {
      return jsonResponse({ error: 'Can only delete collector accounts' }, 403)
    }

    // Delete the auth user; the profiles row cascades via ON DELETE CASCADE
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id)

    if (deleteError) {
      console.error('deleteUser error:', deleteError)
      return jsonResponse(
        { error: 'Failed to delete user', detail: deleteError.message },
        500,
      )
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('delete-collector unhandled error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
