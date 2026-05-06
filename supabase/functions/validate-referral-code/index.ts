import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ValidateRequest = {
  code?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as ValidateRequest;
    const rawCode = (body.code ?? "").trim();
    const code = rawCode.toUpperCase();

    console.log("Validating referral code:", code);

    // Server-side input validation - allow alphanumeric and hyphens
    if (!code || code.length > 36 || !/^[A-Z0-9-]+$/.test(code)) {
      console.log("Invalid code format:", code);
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional auth: if caller is logged in, we can prevent self-referral.
    const authorization = req.headers.get("Authorization");
    let requesterUserId: string | null = null;

    if (authorization) {
      const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authorization } },
      });

      const { data: userData, error: userError } = await authedClient.auth.getUser();
      if (!userError && userData?.user) {
        requesterUserId = userData.user.id;
      }
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Strategy 1: Look for existing referral_links entry matching the code
    const { data: genericLink, error: genericErr } = await admin
      .from("referral_links")
      .select("id, promoter_id, link_code, product_id")
      .ilike("link_code", code)
      .is("product_id", null)
      .limit(1)
      .maybeSingle();

    if (genericErr) {
      console.error("validate-referral-code generic lookup error:", genericErr);
    }

    const { data: anyLink, error: anyErr } = genericLink
      ? { data: null, error: null }
      : await admin
          .from("referral_links")
          .select("id, promoter_id, link_code, product_id")
          .ilike("link_code", code)
          .limit(1)
          .maybeSingle();

    if (anyErr) {
      console.error("validate-referral-code link lookup error:", anyErr);
    }

    let link = genericLink ?? anyLink;
    let promoterId: string | null = null;
    let referralLinkId: string | null = null;
    let linkCode: string = code;

    // Strategy 2: If no link found, check if code matches first 8 chars of a promoter's user_id
    // This handles newly created promoter codes that haven't been stored in referral_links yet
    if (!link?.promoter_id) {
      console.log("No referral_links entry found, checking for user_id match...");
      
      // Get all promoters and check if code matches first 8 chars of their ID
      const { data: promoters, error: promotersErr } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "promoter");

      if (promotersErr) {
        console.error("Error fetching promoters:", promotersErr);
      }

      if (promoters) {
        for (const promoter of promoters) {
          const expectedCode = promoter.user_id.substring(0, 8).toUpperCase();
          if (expectedCode === code) {
            promoterId = promoter.user_id;
            linkCode = expectedCode;
            console.log("Found promoter by user_id prefix:", promoterId);
            
            // Auto-create the referral link for this promoter
            const { data: newLink, error: createErr } = await admin
              .from("referral_links")
              .insert({
                promoter_id: promoterId,
                link_code: linkCode,
                product_id: null,
                clicks: 0,
                conversions: 0
              })
              .select("id, promoter_id, link_code, product_id")
              .single();

            if (createErr) {
              // Link might already exist with different case, try to fetch it
              console.log("Could not create link, trying to fetch existing:", createErr.message);
              const { data: existingLink } = await admin
                .from("referral_links")
                .select("id, promoter_id, link_code, product_id")
                .eq("promoter_id", promoterId)
                .is("product_id", null)
                .limit(1)
                .maybeSingle();
              
              if (existingLink) {
                referralLinkId = existingLink.id;
                linkCode = existingLink.link_code;
              }
            } else if (newLink) {
              referralLinkId = newLink.id;
              linkCode = newLink.link_code;
              console.log("Created new referral link:", referralLinkId);
            }
            break;
          }
        }
      }
    } else {
      promoterId = link.promoter_id as string;
      referralLinkId = link.id;
      linkCode = link.link_code;
    }

    if (!promoterId) {
      console.log("No promoter found for code:", code);
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-referral (only possible when caller is logged in)
    if (requesterUserId && promoterId === requesterUserId) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: "self_referral",
          message: "You cannot use your own referral code",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure referrer is actually a promoter
    const { data: role } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", promoterId)
      .eq("role", "promoter")
      .maybeSingle();

    if (!role) {
      console.log("User is not a promoter:", promoterId);
      return new Response(JSON.stringify({ valid: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email, promoter_tier, avatar_url, created_at")
      .eq("id", promoterId)
      .maybeSingle();

    // Get total sales count for the promoter
    const { count: salesCount } = await admin
      .from("sales")
      .select("*", { count: "exact", head: true })
      .eq("promoter_id", promoterId)
      .eq("status", "completed");

    const promoterName =
      profile?.full_name || (profile?.email ? profile.email.split("@")[0] : null) || "Promoter";

    console.log("Validation successful for promoter:", promoterName, "tier:", profile?.promoter_tier);

    return new Response(
      JSON.stringify({
        valid: true,
        promoter_id: promoterId,
        promoter_name: promoterName,
        promoter_tier: profile?.promoter_tier || "free",
        promoter_avatar: profile?.avatar_url || null,
        promoter_joined: profile?.created_at || null,
        promoter_sales_count: salesCount || 0,
        referral_link_id: referralLinkId,
        link_code: linkCode,
        product_id: link?.product_id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("validate-referral-code error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});