import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all promoters (users with promoter role)
    const { data: promoters, error: promotersError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "promoter");

    if (promotersError) {
      throw new Error(`Error fetching promoters: ${promotersError.message}`);
    }

    if (!promoters || promoters.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No promoters to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the first tier info
    const { data: firstTier } = await supabase
      .from("daily_sales_tiers")
      .select("tier_name, commission_percent")
      .eq("is_active", true)
      .order("min_sales", { ascending: true })
      .limit(1)
      .single();

    // Get the highest tier for motivation
    const { data: maxTier } = await supabase
      .from("daily_sales_tiers")
      .select("tier_name, commission_percent")
      .eq("is_active", true)
      .order("commission_percent", { ascending: false })
      .limit(1)
      .single();

    const notifications = promoters.map((promoter) => ({
      user_id: promoter.user_id,
      title: "🌅 New Day, New Opportunities!",
      message: `Good morning! Your daily sales tier has reset to ${firstTier?.tier_name || "Tier 1"} (${firstTier?.commission_percent || 10}%). Start selling now and climb up to ${maxTier?.tier_name || "Tier 5"} with ${maxTier?.commission_percent || 100}% commission!`,
      type: "tier_reset",
      metadata: {
        reset_date: new Date().toISOString().split("T")[0],
        starting_tier: firstTier?.tier_name,
        starting_commission: firstTier?.commission_percent,
        max_tier: maxTier?.tier_name,
        max_commission: maxTier?.commission_percent,
      },
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notifications);

    if (insertError) {
      throw new Error(`Error inserting notifications: ${insertError.message}`);
    }

    console.log(`Daily tier reset notifications sent to ${promoters.length} promoters`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent daily tier reset notifications to ${promoters.length} promoters` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in daily-tier-reset-notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
