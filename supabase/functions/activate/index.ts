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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let code: string
  try {
    const body = await req.json()
    code = body?.code
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (!code || typeof code !== 'string' || code.trim() === '') {
    return jsonResponse({ error: 'code is required' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    // Look up the activation code
    const { data: activationCode, error: codeError } = await supabase
      .from('activation_codes')
      .select('id, user_id, is_used, expires_at')
      .eq('code', code.trim().toUpperCase())
      .maybeSingle()

    if (codeError) {
      console.error('activation_codes lookup error:', codeError)
      return jsonResponse({ error: 'Internal server error' }, 500)
    }

    if (!activationCode) {
      return jsonResponse({ error: 'Invalid activation code' }, 400)
    }

    if (activationCode.is_used) {
      return jsonResponse({ error: 'Activation code has already been used' }, 400)
    }

    if (new Date(activationCode.expires_at) < new Date()) {
      return jsonResponse({ error: 'Activation code has expired' }, 400)
    }

    // Fetch the user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, is_active')
      .eq('id', activationCode.user_id)
      .single()

    if (profileError || !profile) {
      console.error('profile lookup error:', profileError)
      return jsonResponse({ error: 'User profile not found' }, 400)
    }

    if (!profile.is_active) {
      return jsonResponse({ error: 'User account is deactivated' }, 403)
    }

    // Mark the activation code as used
    const { error: updateError } = await supabase
      .from('activation_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', activationCode.id)

    if (updateError) {
      console.error('activation code update error:', updateError)
      return jsonResponse({ error: 'Failed to process activation code' }, 500)
    }

    // Generate a magic link via the Admin Auth API
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: profile.email,
    })

    if (linkError || !linkData) {
      console.error('generateLink error:', linkError)
      // Attempt to roll back the used flag so the code can be retried
      await supabase
        .from('activation_codes')
        .update({ is_used: false, used_at: null })
        .eq('id', activationCode.id)
      return jsonResponse({ error: 'Failed to generate authentication link' }, 500)
    }

    const { properties } = linkData

    return jsonResponse({
      token_hash: properties.hashed_token,
      email: profile.email,
      otp: properties.email_otp,
      user_id: activationCode.user_id,
    })
  } catch (err) {
    console.error('activate unhandled error:', err)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
