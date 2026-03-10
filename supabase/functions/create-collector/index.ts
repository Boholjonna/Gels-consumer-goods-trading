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

const ANIMALS = [
  'Fox', 'Hawk', 'Bear', 'Wolf', 'Lynx', 'Orca', 'Puma', 'Elk', 'Owl',
  'Crow', 'Viper', 'Falcon', 'Tiger', 'Eagle', 'Shark', 'Raven', 'Cobra',
  'Bison', 'Moose', 'Drake',
]

const ACTIVATION_CHARSET = '23456789ACDEFGHJKMNPQRSTUVWXYZ'

function generateActivationCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ACTIVATION_CHARSET[Math.floor(Math.random() * ACTIVATION_CHARSET.length)]
  }
  return code
}

function randomAnimal(): string {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
}

function randomNumber(): number {
  // Returns a random integer in [100, 999]
  return Math.floor(Math.random() * 900) + 100
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
    let nickname: string, tag: string | undefined
    try {
      const body = await req.json()
      nickname = body?.nickname
      tag = body?.tag
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    if (!nickname || typeof nickname !== 'string' || nickname.trim() === '') {
      return jsonResponse({ error: 'nickname is required' }, 400)
    }

    // Generate a unique display_id: e.g. "COL-Fox-123"
    let displayId: string | null = null

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = `COL-${randomAnimal()}-${randomNumber()}`

      const { data: existing, error: existingError } = await adminClient
        .from('profiles')
        .select('id')
        .eq('display_id', candidate)
        .maybeSingle()

      if (existingError) {
        console.error('display_id uniqueness check error:', existingError)
        return jsonResponse({ error: 'Internal server error' }, 500)
      }

      if (!existing) {
        displayId = candidate
        break
      }
    }

    if (!displayId) {
      return jsonResponse({ error: 'Failed to generate a unique display_id after 20 attempts' }, 500)
    }

    // Derive email from display_id: "bra.fox.123@collector.pos"
    const email = `${displayId.toLowerCase().replace(/-/g, '.')}@collector.pos`

    // Create the auth user via Admin API
    const { data: authData, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
      user_metadata: {
        full_name: nickname.trim(),
        role: 'collector',
      },
    })

    if (createUserError || !authData?.user) {
      console.error('createUser error:', createUserError)
      return jsonResponse(
        { error: 'Failed to create user', detail: createUserError?.message },
        500,
      )
    }

    const newUserId = authData.user.id

    // Update the auto-created profile (handle_new_user trigger runs synchronously)
    const profileUpdate: Record<string, unknown> = {
      nickname: nickname.trim(),
      display_id: displayId,
    }
    if (tag !== undefined && tag !== null) {
      profileUpdate.tag = tag
    }

    const { data: updatedProfile, error: updateProfileError } = await adminClient
      .from('profiles')
      .update(profileUpdate)
      .eq('id', newUserId)
      .select()
      .single()

    if (updateProfileError || !updatedProfile) {
      console.error('profile update error:', updateProfileError)
      // Rollback: remove the auth user we just created
      await adminClient.auth.admin.deleteUser(newUserId)
      return jsonResponse({ error: 'Failed to update profile' }, 500)
    }

    // Generate a unique activation code (6-char from custom charset)
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
    let activationCode: string | null = null

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = generateActivationCode(6)

      const { error: insertCodeError } = await adminClient
        .from('activation_codes')
        .insert({
          user_id: newUserId,
          code: candidate,
          expires_at: expiresAt,
        })

      if (!insertCodeError) {
        activationCode = candidate
        break
      }

      // Only retry on unique constraint violation (Postgres error code 23505)
      const isUniqueViolation =
        insertCodeError.code === '23505' ||
        insertCodeError.message?.toLowerCase().includes('unique')

      if (!isUniqueViolation) {
        console.error('activation_codes insert error:', insertCodeError)
        break
      }
    }

    if (!activationCode) {
      // Rollback: remove the auth user (profile cascades)
      await adminClient.auth.admin.deleteUser(newUserId)
      return jsonResponse(
        { error: 'Failed to generate a unique activation code after 10 attempts' },
        500,
      )
    }

    return jsonResponse({ ...updatedProfile, activation_code: activationCode }, 201)
  } catch (err) {
    console.error('create-collector unhandled error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
