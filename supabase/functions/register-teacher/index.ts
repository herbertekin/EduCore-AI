
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Vary": "Origin",
};

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin?: string,
) {
  const headers = new Headers(corsHeaders);

  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? "";

  // APP_URL must be an exact origin, e.g. https://educoreai.example.com
  const allowedOrigins = [
    appUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean);

  const originAllowed = allowedOrigins.includes(origin);

  if (req.method === "OPTIONS") {
    if (!originAllowed) {
      return new Response("Origin not allowed", { status: 403 });
    }

    return new Response("ok", {
      status: 200,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Origin": origin,
      },
    });
  }

  if (!originAllowed) {
    return jsonResponse({ error: "Origin not allowed." }, 403);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }

  let invitedUserId: string | null = null;
  let schoolId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Required Supabase environment variables are missing.");

      return jsonResponse(
        { error: "Server configuration is incomplete." },
        500,
        origin,
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Authentication required." },
        401,
        origin,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authorization },
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user's access token.
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { error: "Invalid or expired session." },
        401,
        origin,
      );
    }

    // Safely parse and validate the request body.
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        { error: "Invalid JSON request body." },
        400,
        origin,
      );
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return jsonResponse(
        { error: "Invalid teacher details." },
        400,
        origin,
      );
    }

    const input = body as Record<string, unknown>;

    const rawSchoolId = input.schoolId;
    const rawFullName = input.fullName;
    const rawEmail = input.email;
    const rawPhone = input.phone;

    if (
      typeof rawSchoolId !== "string" ||
      typeof rawFullName !== "string" ||
      typeof rawEmail !== "string" ||
      !(
        rawPhone === undefined ||
        rawPhone === null ||
        typeof rawPhone === "string"
      )
    ) {
      return jsonResponse(
        { error: "Please provide valid teacher details." },
        400,
        origin,
      );
    }

    schoolId = rawSchoolId.trim();

    const fullName = rawFullName.trim();
    const email = rawEmail.trim().toLowerCase();
    const phone =
      typeof rawPhone === "string" && rawPhone.trim()
        ? rawPhone.trim()
        : null;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      !uuidPattern.test(schoolId) ||
      fullName.length < 2 ||
      fullName.length > 120 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (phone !== null && phone.length > 30)
    ) {
      return jsonResponse(
        { error: "Please provide valid teacher details." },
        400,
        origin,
      );
    }

    // Confirm that the requesting user is an administrator
    // of the selected school.
    const { data: membership, error: membershipError } =
      await adminClient
        .from("school_memberships")
        .select("id")
        .eq("school_id", schoolId)
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

    if (membershipError) {
      console.error("Administrator membership lookup failed:", membershipError);

      return jsonResponse(
        { error: "Unable to verify school administrator permissions." },
        500,
        origin,
      );
    }

    if (!membership) {
      return jsonResponse(
        { error: "You are not an administrator of this school." },
        403,
        origin,
      );
    }

    // Invite the teacher. Existing accounts are not silently reused.
    const redirectTo = Deno.env.get("TEACHER_INVITE_REDIRECT_URL");

    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          phone,
        },
        ...(redirectTo ? { redirectTo } : {}),
      });

    if (inviteError || !inviteData.user) {
      console.error("Teacher invitation failed:", inviteError);

      return jsonResponse(
        {
          error: "Unable to invite this email address. Check whether an account already exists.",
        },
        400,
        origin,
      );
    }

    invitedUserId = inviteData.user.id;

    // Upsert supports projects where an Auth trigger has already
    // created the corresponding profile.
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: invitedUserId,
          full_name: fullName,
          phone,
        },
        { onConflict: "id" },
      );

    if (profileError) {
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    // Assign the teacher to this school.
    const { error: schoolError } = await adminClient
      .from("school_memberships")
      .insert({
        school_id: schoolId,
        user_id: invitedUserId,
        role: "teacher",
      });

    if (schoolError) {
      throw new Error(`School assignment failed: ${schoolError.message}`);
    }

    return jsonResponse(
      {
        success: true,
        message: "Teacher invitation sent successfully.",
        teacherId: invitedUserId,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("Teacher registration error:", error);

    // Roll back only records associated with this invitation
    // and this school. Do not delete unrelated memberships.
    if (invitedUserId && schoolId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && serviceRoleKey) {
        const adminClient = createClient(
          supabaseUrl,
          serviceRoleKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          },
        );

        const { error: cleanupMembershipError } = await adminClient
          .from("school_memberships")
          .delete()
          .eq("school_id", schoolId)
          .eq("user_id", invitedUserId)
          .eq("role", "teacher");

        if (cleanupMembershipError) {
          console.error(
            "Membership cleanup failed:",
            cleanupMembershipError,
          );
        }

        const { error: cleanupProfileError } = await adminClient
          .from("profiles")
          .delete()
          .eq("id", invitedUserId);

        if (cleanupProfileError) {
          console.error("Profile cleanup failed:", cleanupProfileError);
        }

        const { error: cleanupUserError } =
          await adminClient.auth.admin.deleteUser(invitedUserId);

        if (cleanupUserError) {
          console.error("Auth user cleanup failed:", cleanupUserError);
        }
      }
    }

    return jsonResponse(
      { error: "Teacher registration failed. Please try again." },
      500,
      origin,
    );
  }
});
