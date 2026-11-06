
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin':
    Deno.env.get('APP_URL') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({
      success: false,
      error: 'Method not allowed.',
    }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const appUrl = Deno.env.get('APP_URL');

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
      console.error('Missing required Edge Function environment variables.');

      return jsonResponse({
        success: false,
        error: 'Server configuration is incomplete.',
      }, 500);
    }

    const authorization = req.headers.get('Authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return jsonResponse({
        success: false,
        error: 'Authentication is required.',
      }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authorization },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the currently signed-in administrator.
    const {
      data: { user: requester },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !requester) {
      return jsonResponse({
        success: false,
        error: 'Your session is invalid. Please sign in again.',
      }, 401);
    }

    // Validate request body.
    const body = await req.json().catch(() => null);

    const teacherId = body?.teacherId;
    const schoolId = body?.schoolId;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      typeof teacherId !== 'string' ||
      !uuidPattern.test(teacherId) ||
      typeof schoolId !== 'string' ||
      !uuidPattern.test(schoolId)
    ) {
      return jsonResponse({
        success: false,
        error: 'A valid teacher and school are required.',
      }, 400);
    }

    // Confirm administrator membership.
    const { data: adminMembership, error: membershipError } =
      await supabaseAdmin
        .from('school_memberships')
        .select('id')
        .eq('school_id', schoolId)
        .eq('user_id', requester.id)
        .eq('role', 'admin')
        .maybeSingle();

    if (membershipError) {
      console.error('Administrator verification failed:', membershipError);

      return jsonResponse({
        success: false,
        error: 'Could not verify school administrator permissions.',
      }, 500);
    }

    if (!adminMembership) {
      return jsonResponse({
        success: false,
        error: 'You are not authorized to manage teachers in this school.',
      }, 403);
    }

    // Retrieve teacher.
    const { data: teacher, error: teacherError } = await supabaseAdmin
      .from('teachers')
      .select('id, school_id, full_name, email, auth_user_id, status')
      .eq('id', teacherId)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (teacherError) {
      console.error('Teacher lookup failed:', teacherError);

      return jsonResponse({
        success: false,
        error: 'Could not retrieve teacher record.',
      }, 500);
    }

    if (!teacher) {
      return jsonResponse({
        success: false,
        error: 'Teacher record not found.',
      }, 404);
    }

    if (teacher.status !== 'active') {
      return jsonResponse({
        success: false,
        error: 'This teacher is inactive. Activate the record first.',
      }, 400);
    }

    if (!teacher.email?.trim()) {
      return jsonResponse({
        success: false,
        error: 'Add an email address to this teacher record first.',
      }, 400);
    }

    if (teacher.auth_user_id) {
      return jsonResponse({
        success: false,
        error: 'This teacher is already linked to a login account.',
      }, 409);
    }

    const teacherEmail = teacher.email.trim().toLowerCase();

    // Check whether another teacher in this school already uses this email.
    const { data: duplicateTeacher, error: duplicateError } =
      await supabaseAdmin
        .from('teachers')
        .select('id, full_name')
        .eq('school_id', schoolId)
        .ilike('email', teacherEmail)
        .neq('id', teacherId)
        .maybeSingle();

    if (duplicateError) {
      console.error('Duplicate teacher check failed:', duplicateError);

      return jsonResponse({
        success: false,
        error: 'Could not verify teacher email uniqueness.',
      }, 500);
    }

    if (duplicateTeacher) {
      return jsonResponse({
        success: false,
        error: 'Another teacher in this school already uses this email.',
      }, 409);
    }

    // Send invitation.
    const { data: invitation, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        teacherEmail,
        {
          data: {
            full_name: teacher.full_name,
          },
          redirectTo: appUrl,
        },
      );

    if (inviteError) {
      console.error('Teacher invitation failed:', {
        message: inviteError.message,
        code: inviteError.code,
        status: inviteError.status,
        name: inviteError.name,
        teacherId,
        teacherEmail,
      });

      const status =
        inviteError.status === 429 ? 429 :
        inviteError.status >= 500 ? 502 :
        400;

      return jsonResponse({
        success: false,
        stage: 'invitation',
        error: inviteError.message,
        errorCode: inviteError.code ?? null,
        errorStatus: inviteError.status ?? null,
      }, status);
    }

    const invitedUser = invitation.user;

    if (!invitedUser) {
      return jsonResponse({
        success: false,
        invitationSent: true,
        error: 'Invitation returned no user account. Administrator review required.',
      }, 500);
    }

    // Ensure profile exists.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        {
          id: invitedUser.id,
          full_name: teacher.full_name,
        },
        { onConflict: 'id' },
      );

    if (profileError) {
      console.error('Profile creation failed:', profileError);

      return jsonResponse({
        success: false,
        invitationSent: true,
        userId: invitedUser.id,
        stage: 'profile',
        error: 'Invitation sent, but profile setup failed. Do not resend the invitation.',
      }, 500);
    }

    // Create school membership.
    const { error: schoolMembershipError } = await supabaseAdmin
      .from('school_memberships')
      .upsert(
        {
          school_id: schoolId,
          user_id: invitedUser.id,
          role: 'teacher',
        },
        {
          onConflict: 'school_id,user_id,role',
          ignoreDuplicates: true,
        },
      );

    if (schoolMembershipError) {
      console.error('School membership creation failed:', schoolMembershipError);

      return jsonResponse({
        success: false,
        invitationSent: true,
        userId: invitedUser.id,
        stage: 'membership',
        error: 'Invitation sent, but school membership setup failed. Do not resend the invitation.',
      }, 500);
    }

    // Link the Auth account to the teacher.
    const { data: linkedTeacher, error: linkError } =
      await supabaseAdmin
        .from('teachers')
        .update({
          auth_user_id: invitedUser.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teacherId)
        .eq('school_id', schoolId)
        .is('auth_user_id', null)
        .select('id')
        .maybeSingle();

    if (linkError || !linkedTeacher) {
      console.error('Teacher account linking failed:', linkError);

      return jsonResponse({
        success: false,
        invitationSent: true,
        userId: invitedUser.id,
        stage: 'teacher_link',
        error: 'Invitation sent, but teacher linking failed. Do not resend the invitation.',
      }, 500);
    }

    return jsonResponse({
      success: true,
      message: 'Login invitation sent successfully.',
    });

  } catch (error) {
    console.error('Enable teacher login unexpected error:', error);

    return jsonResponse({
      success: false,
      error: error instanceof Error
        ? error.message
        : 'An unexpected server error occurred.',
    }, 500);
  }
});
