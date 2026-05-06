import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting auto-complete orders job...');

    // Fetch the auto-complete days setting
    const { data: settingsData, error: settingsError } = await supabase
      .from('referral_commission_settings')
      .select('setting_value')
      .eq('setting_key', 'auto_complete_days')
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching settings:', settingsError);
      throw settingsError;
    }

    // Default to 7 days if setting not found
    const autoCompleteDays = (settingsData?.setting_value as { days?: number })?.days ?? 7;
    
    console.log(`Auto-complete days setting: ${autoCompleteDays}`);

    if (autoCompleteDays === 0) {
      console.log('Auto-complete is disabled (0 days)');
      return new Response(
        JSON.stringify({ success: true, message: 'Auto-complete is disabled', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - autoCompleteDays);

    console.log(`Looking for shipped orders before: ${cutoffDate.toISOString()}`);

    // Find all shipped orders older than the cutoff date
    const { data: ordersToComplete, error: ordersError } = await supabase
      .from('orders')
      .select('id, created_at, buyer_email, product_id')
      .eq('status', 'shipped')
      .lt('updated_at', cutoffDate.toISOString());

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    console.log(`Found ${ordersToComplete?.length || 0} orders to auto-complete`);

    if (!ordersToComplete || ordersToComplete.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No orders to auto-complete', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update orders to completed status
    const orderIds = ordersToComplete.map(o => o.id);
    
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'completed',
        delivered_at: new Date().toISOString()
      })
      .in('id', orderIds);

    if (updateError) {
      console.error('Error updating orders:', updateError);
      throw updateError;
    }

    // Update vendor_earnings to completed for auto-completed orders
    const { error: earningsUpdateError } = await supabase
      .from('vendor_earnings')
      .update({ status: 'completed' })
      .in('order_id', orderIds);
    
    if (earningsUpdateError) {
      console.error('Error updating vendor earnings:', earningsUpdateError);
    } else {
      console.log(`Updated vendor_earnings to completed for ${orderIds.length} orders`);
    }

    console.log(`Successfully auto-completed ${orderIds.length} orders`);

    // Log each completed order
    for (const order of ordersToComplete) {
      console.log(`Auto-completed order: ${order.id} (buyer: ${order.buyer_email})`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Auto-completed ${orderIds.length} orders`,
        updated: orderIds.length,
        orderIds 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Auto-complete orders error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
