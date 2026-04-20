import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AccessLevel = "admin" | "both_edit" | "both_view" | "students_only" | "teachers_only";

function getAccessPermissions(accessLevel: AccessLevel) {
  switch (accessLevel) {
    case "admin":
      return {
        can_view_students: true,
        can_edit_students: true,
        can_view_teachers: true,
        can_edit_teachers: true,
      };
    case "both_edit":
      return {
        can_view_students: true,
        can_edit_students: true,
        can_view_teachers: true,
        can_edit_teachers: true,
      };
    case "both_view":
      return {
        can_view_students: true,
        can_edit_students: false,
        can_view_teachers: true,
        can_edit_teachers: false,
      };
    case "teachers_only":
      return {
        can_view_students: false,
        can_edit_students: false,
        can_view_teachers: true,
        can_edit_teachers: true,
      };
    default:
      return {
        can_view_students: true,
        can_edit_students: true,
        can_view_teachers: false,
        can_edit_teachers: false,
      };
  }
}

function isAccessLevel(value: unknown): value is AccessLevel {
  return value === "admin" || value === "both_edit" || value === "both_view" || value === "students_only" || value === "teachers_only";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("Authorization");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase service credentials");
      return new Response(JSON.stringify({ error: "Supabase service credentials are not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is an admin
    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const {
      data: { user: caller },
      error: callerError,
    } = await adminClient.auth.getUser(token);
    if (callerError || !caller) {
      console.error("Could not verify caller", callerError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      console.error(`Admin access required for user ${caller.id}`);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, role, accessLevel } = await req.json();
    const selectedAccessLevel: AccessLevel = isAccessLevel(accessLevel) ? accessLevel : "students_only";
    const selectedRole = selectedAccessLevel === "admin" || role === "admin" ? "admin" : role === "manager" ? "manager" : "user";

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with admin API (auto-confirms email)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      console.error("Could not create user", createError.message);
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The trigger will create a 'user' role automatically.
    // If the requested role is different, update it.
    if (selectedRole !== "user") {
      const { error: roleError } = await adminClient
        .from("user_roles")
        .update({ role: selectedRole })
        .eq("user_id", newUser.user.id);

      if (roleError) {
        console.error("Could not update user role", roleError.message);
        return new Response(JSON.stringify({ error: roleError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: permissionError } = await adminClient
      .from("user_permissions")
      .upsert({
        user_id: newUser.user.id,
        ...getAccessPermissions(selectedAccessLevel),
        can_manage_roles: selectedAccessLevel === "admin" || selectedRole === "admin",
        updated_at: new Date().toISOString(),
      });

    if (permissionError) {
      console.error("Could not save user permissions", permissionError.message);
      return new Response(JSON.stringify({ error: permissionError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ user: { id: newUser.user.id, email } }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create user";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
