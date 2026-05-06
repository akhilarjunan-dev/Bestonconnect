import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DELHIVERY_API_KEY = Deno.env.get('DELHIVERY_API_KEY')!
const DELHIVERY_CLIENT_NAME = Deno.env.get('DELHIVERY_CLIENT_NAME')!
const DELHIVERY_BASE_URL = 'https://track.delhivery.com' // Production URL

interface DeliveryAddress {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface VendorProfile {
  business_name: string;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_pincode: string;
  pickup_phone: string;
  pickup_email?: string;
}

interface CreateShipmentRequest {
  order_id: string;
  product_name: string;
  quantity: number;
  total_amount: number;
  delivery_address: DeliveryAddress;
  vendor_profile?: VendorProfile;
  weight?: number; // in grams
  dimensions?: { length: number; width: number; height: number }; // in cm
  payment_mode?: 'Prepaid' | 'COD';
}

// Helper: Register a warehouse in Delhivery if not already registered
async function ensureWarehouseRegistered(
  warehouseName: string,
  pickup: VendorProfile
): Promise<void> {
  try {
    console.log(`[Delhivery] Ensuring warehouse registered: ${warehouseName}`)
    const response = await fetch(`${DELHIVERY_BASE_URL}/api/backend/clientwarehouse/create/`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DELHIVERY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: warehouseName,
        phone: pickup.pickup_phone,
        city: pickup.pickup_city,
        pin: pickup.pickup_pincode,
        address: pickup.pickup_address,
        country: 'India',
        state: pickup.pickup_state,
        registered_name: pickup.business_name,
        return_address: pickup.pickup_address,
        return_pin: pickup.pickup_pincode,
        return_city: pickup.pickup_city,
        return_state: pickup.pickup_state,
        return_country: 'India',
        return_phone: pickup.pickup_phone,
      }),
    })
    const result = await response.json()
    console.log(`[Delhivery] Warehouse registration result:`, result)
  } catch (err) {
    console.error(`[Delhivery] Warehouse registration error (non-blocking):`, err)
  }
}

// Get the warehouse name to use for a given pickup location
function getWarehouseName(pickupLocation: VendorProfile, isVendor: boolean): string {
  if (!isVendor) return DELHIVERY_CLIENT_NAME
  // Use a sanitized version of business_name as warehouse identifier
  return pickupLocation.business_name.trim().substring(0, 50)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action, ...data } = await req.json()
    console.log(`[Delhivery] Action: ${action}`, data)

    // Check if Delhivery is enabled
    const { data: enabledSetting } = await supabase
      .from('delhivery_settings')
      .select('setting_value')
      .eq('setting_key', 'delhivery_enabled')
      .single()

    const isEnabled = (enabledSetting?.setting_value as { enabled?: boolean })?.enabled ?? false

    if (!isEnabled && action !== 'check_status') {
      return new Response(
        JSON.stringify({ success: false, error: 'Delhivery integration is disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Create Shipment
    if (action === 'create_shipment') {
      const shipmentData = data as CreateShipmentRequest
      
      // Priority: 1) Vendor profile from product's vendor_id, 2) Admin default location
      let pickupLocation: VendorProfile | null = null

      // Try to get vendor pickup profile from the product's vendor_id
      if (shipmentData.order_id) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('product_id')
          .eq('id', shipmentData.order_id)
          .single()

        if (orderData?.product_id) {
          const { data: product } = await supabase
            .from('products')
            .select('vendor_id')
            .eq('id', orderData.product_id)
            .single()

          if (product?.vendor_id) {
            const { data: vendorProfile } = await supabase
              .from('vendor_profiles')
              .select('*')
              .eq('user_id', product.vendor_id)
              .single()

            if (vendorProfile && vendorProfile.pickup_address) {
              pickupLocation = vendorProfile as VendorProfile
              console.log('[Delhivery] Using vendor pickup location:', vendorProfile.business_name)
            }
          }
        }
      }

      // Fallback to admin default pickup location
      if (!pickupLocation) {
        const { data: defaultPickup } = await supabase
          .from('delhivery_settings')
          .select('setting_value')
          .eq('setting_key', 'default_pickup_location')
          .single()
        
        pickupLocation = defaultPickup?.setting_value as VendorProfile
        console.log('[Delhivery] Using admin default pickup location')
      }

      if (!pickupLocation || !pickupLocation.pickup_address) {
        return new Response(
          JSON.stringify({ success: false, error: 'No pickup location configured. Please set a default pickup address in Delhivery Settings.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Determine if this is a vendor product and get the warehouse name
      const isVendorProduct = pickupLocation !== null && pickupLocation !== (await supabase
        .from('delhivery_settings')
        .select('setting_value')
        .eq('setting_key', 'default_pickup_location')
        .single()).data?.setting_value

      // Check if vendor product by re-checking the product vendor_id
      let isVendor = false
      if (shipmentData.order_id) {
        const { data: orderCheck } = await supabase.from('orders').select('product_id').eq('id', shipmentData.order_id).single()
        if (orderCheck) {
          const { data: prodCheck } = await supabase.from('products').select('vendor_id').eq('id', orderCheck.product_id).single()
          isVendor = !!prodCheck?.vendor_id
        }
      }

      const warehouseName = getWarehouseName(pickupLocation, isVendor)

      // Register warehouse in Delhivery (idempotent - won't fail if already exists)
      await ensureWarehouseRegistered(warehouseName, pickupLocation)

      // Format shipment data for Delhivery API
      const shipmentPayload = {
        shipments: [{
          name: shipmentData.delivery_address.name,
          add: shipmentData.delivery_address.address,
          city: shipmentData.delivery_address.city,
          state: shipmentData.delivery_address.state,
          country: 'India',
          pin: shipmentData.delivery_address.pincode,
          phone: shipmentData.delivery_address.phone,
          order: shipmentData.order_id.slice(0, 25),
          payment_mode: shipmentData.payment_mode || 'Prepaid',
          total_amount: shipmentData.total_amount,
          cod_amount: shipmentData.payment_mode === 'COD' ? shipmentData.total_amount : 0,
          weight: shipmentData.weight || 500, // Default 500g
          products_desc: shipmentData.product_name,
          quantity: shipmentData.quantity,
          seller_name: pickupLocation.business_name,
          seller_add: pickupLocation.pickup_address,
          seller_city: pickupLocation.pickup_city,
          seller_state: pickupLocation.pickup_state,
          seller_country: 'India',
          seller_pin: pickupLocation.pickup_pincode,
          seller_phone: pickupLocation.pickup_phone,
        }],
        pickup_location: {
          name: warehouseName,
          add: pickupLocation.pickup_address,
          city: pickupLocation.pickup_city,
          state: pickupLocation.pickup_state,
          country: 'India',
          pin: pickupLocation.pickup_pincode,
          phone: pickupLocation.pickup_phone,
        }
      }

      console.log('[Delhivery] Creating shipment:', JSON.stringify(shipmentPayload))

      // Call Delhivery API - must use form-urlencoded format
      const formBody = `format=json&data=${encodeURIComponent(JSON.stringify(shipmentPayload))}`
      console.log('[Delhivery] Sending form body:', formBody)

      const response = await fetch(`${DELHIVERY_BASE_URL}/api/cmu/create.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DELHIVERY_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      })

      const result = await response.json()
      console.log('[Delhivery] Create shipment response:', result)

      // Check for API-level errors
      if (!response.ok || result.error) {
        console.error('[Delhivery] API error:', result)
        return new Response(
          JSON.stringify({ success: false, error: result.error || result.rmk || 'Failed to create shipment', details: result }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check for package-level failures (Delhivery returns 200 but with failed packages)
      const pkg = result.packages?.[0]
      if (result.success === false || pkg?.status === 'Fail') {
        const failReason = pkg?.remarks?.join('; ') || result.rmk || 'Shipment creation failed at Delhivery'
        console.error('[Delhivery] Package failed:', failReason)
        return new Response(
          JSON.stringify({ success: false, error: failReason, details: result }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Extract waybill from response
      const waybill = pkg?.waybill || result.waybill
      const delhiveryOrderId = pkg?.refnum || shipmentData.order_id

      // Update order with Delhivery details
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          delhivery_order_id: delhiveryOrderId,
          delhivery_waybill: waybill,
          delhivery_status: 'Manifested',
          shipping_created_at: new Date().toISOString(),
          tracking_info: {
            carrier: 'Delhivery',
            tracking_number: waybill,
            url: `https://www.delhivery.com/track/package/${waybill}`
          },
          status: 'processing'
        })
        .eq('id', shipmentData.order_id)

      if (updateError) {
        console.error('[Delhivery] Error updating order:', updateError)
      }

      // Auto-create pickup request after shipment creation
      let pickupResult = null
      try {
        const pickupPayload: Record<string, string> = {
          pickup_location: warehouseName,
          expected_package_count: '1',
        }

        // Add pickup time if provided
        if (data.pickup_time) {
          pickupPayload.pickup_date = data.pickup_time
        }

        const pickupFormBody = `${Object.entries(pickupPayload).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
        console.log('[Delhivery] Creating pickup request:', pickupPayload)

        const pickupResponse = await fetch(`${DELHIVERY_BASE_URL}/fm/request/new/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${DELHIVERY_API_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: pickupFormBody,
        })

        pickupResult = await pickupResponse.json()
        console.log('[Delhivery] Pickup creation response:', pickupResult)

        if (pickupResult?.pickup_id || pickupResult?.success) {
          // Update order status to shipped since pickup is scheduled
          await supabase
            .from('orders')
            .update({ status: 'shipped', delhivery_status: 'Pickup Scheduled' })
            .eq('id', shipmentData.order_id)
        }
      } catch (pickupErr) {
        console.error('[Delhivery] Pickup creation failed (non-blocking):', pickupErr)
        // Don't fail the whole operation if pickup fails - shipment is already created
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          waybill, 
          order_id: delhiveryOrderId,
          tracking_url: `https://www.delhivery.com/track/package/${waybill}`,
          pickup: pickupResult
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Track Shipment (with auto-status sync)
    if (action === 'track_shipment') {
      const { waybill } = data

      if (!waybill) {
        return new Response(
          JSON.stringify({ error: 'Waybill number is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const response = await fetch(
        `${DELHIVERY_BASE_URL}/api/v1/packages/json/?waybill=${waybill}&token=${DELHIVERY_API_KEY}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Token ${DELHIVERY_API_KEY}`,
          },
        }
      )

      const result = await response.json()
      console.log('[Delhivery] Track shipment response:', result)

      const shipmentData = result.ShipmentData?.[0]?.Shipment
      
      if (shipmentData) {
        const delhiveryStatus = shipmentData.Status?.Status || 'Unknown'
        
        // Case-insensitive status mapping
        const statusMapLower: Record<string, string> = {
          'manifested': 'processing',
          'in transit': 'shipped',
          'picked up': 'shipped',
          'dispatched': 'shipped',
          'out for delivery': 'shipped',
          'delivered': 'completed',
          'rto': 'cancelled',
          'returned': 'cancelled',
          'cancelled': 'cancelled',
          'pending': 'processing',
          'ready to dispatch': 'processing',
          'pickup scheduled': 'processing',
        }
        
        const mappedOrderStatus = statusMapLower[delhiveryStatus.toLowerCase()] || null
        
        const updateData: Record<string, unknown> = {
          delhivery_status: delhiveryStatus,
        }
        
        // Auto-update order status based on Delhivery status
        if (mappedOrderStatus) {
          // Get current order to check if status should be updated
          const { data: currentOrder } = await supabase
            .from('orders')
            .select('id, status, buyer_email, product_id')
            .eq('delhivery_waybill', waybill)
            .single()
          
          if (currentOrder) {
            const statusPriority: Record<string, number> = {
              'pending': 0, 'processing': 1, 'shipped': 2, 'completed': 3, 'cancelled': 4
            }
            const currentPriority = statusPriority[currentOrder.status] ?? -1
            const newPriority = statusPriority[mappedOrderStatus] ?? -1
            
            // Only advance status forward (never go backwards)
            if (newPriority > currentPriority) {
              updateData.status = mappedOrderStatus
              if (mappedOrderStatus === 'completed') {
                updateData.delivered_at = new Date().toISOString()
              }
              
              // Send notification to buyer
              const { data: profile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', currentOrder.buyer_email)
                .maybeSingle()
              
              const { data: product } = await supabase
                .from('products')
                .select('name')
                .eq('id', currentOrder.product_id)
                .single()
              
              const productName = product?.name || 'your product'
              
              if (profile) {
                const notifMessages: Record<string, { title: string; message: string; type: string }> = {
                  'shipped': {
                    title: '🚚 Order Picked Up & Shipped!',
                    message: `Your order for "${productName}" has been picked up and is on its way to you!`,
                    type: 'info'
                  },
                  'completed': {
                    title: '✅ Order Delivered!',
                    message: `Your order for "${productName}" has been delivered. Enjoy your purchase!`,
                    type: 'success'
                  },
                }
                const notif = notifMessages[mappedOrderStatus]
                if (notif) {
                  await supabase.from('notifications').insert({
                    user_id: profile.id,
                    title: notif.title,
                    message: notif.message,
                    type: notif.type,
                    is_read: false,
                  })
                }
              }
            }
          }
        }
        
        // Update order with latest delhivery status
        await supabase
          .from('orders')
          .update(updateData)
          .eq('delhivery_waybill', waybill)
      }

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Generate Shipping Label (build PDF from Delhivery JSON)
    if (action === 'generate_label') {
      const { waybill } = data

      if (!waybill) {
        return new Response(
          JSON.stringify({ error: 'Waybill number is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const labelUrl = `${DELHIVERY_BASE_URL}/api/p/packing_slip?wbns=${waybill}`
      
      try {
        const labelResponse = await fetch(labelUrl, {
          headers: {
            'Authorization': `Token ${DELHIVERY_API_KEY}`,
          },
        })

        if (!labelResponse.ok) {
          const errText = await labelResponse.text()
          console.error('[Delhivery] Label fetch error:', labelResponse.status, errText)
          return new Response(
            JSON.stringify({ success: false, error: `Delhivery label API returned status ${labelResponse.status}.` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const jsonData = await labelResponse.json()
        console.log('[Delhivery] Packing slip response keys:', Object.keys(jsonData))

        const pkg = jsonData?.packages?.[0]
        if (!pkg) {
          console.error('[Delhivery] No package data in response:', JSON.stringify(jsonData).slice(0, 300))
          return new Response(
            JSON.stringify({ success: false, error: 'No package data found for this waybill.' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Extract fields from Delhivery JSON
        const wbn = String(pkg.wbn || waybill)
        const receiverName = String(pkg.name || 'N/A')
        const receiverAddress = String(pkg.address || 'N/A')
        const receiverPin = String(pkg.pin || '')
        const receiverPhone = String(pkg.contact || pkg.phone || '')
        const origin = String(pkg.origin || '')
        const destination = String(pkg.destination || '')
        const sortCode = String(pkg.sort_code || '')
        const oid = String(pkg.oid || '')
        const paymentType = String(pkg.pt || 'Prepaid')
        const codAmount = pkg.cod_amount != null ? Number(pkg.cod_amount) : 0
        const productDesc = String(pkg.products_desc || pkg.prd || '')
        const senderName = String(pkg.rs || pkg.seller_name || '')
        const senderAddress = String(pkg.sAdd || pkg.seller_add || '')
        const senderPin = String(pkg.sPin || pkg.seller_pin || '')
        const senderCity = String(pkg.sCity || '')

        // Helper: escape PDF special chars
        const esc = (t: string): string => t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

        // Build raw PDF 1.4
        const W = 297 // A6 width pts
        const H = 420 // A6 height pts
        const M = 20  // margin
        const LH = 14 // line height

        // Build content stream lines
        const lines: string[] = []
        let y = H - M

        const addLine = (text: string, size = 10, bold = false) => {
          const fontName = bold ? '/F2' : '/F1'
          lines.push(`BT ${fontName} ${size} Tf ${M} ${y} Td (${esc(text)}) Tj ET`)
          y -= LH
        }

        const addSeparator = () => {
          lines.push(`${M} ${y + 4} m ${W - M} ${y + 4} l S`)
          y -= 6
        }

        // Header
        addLine('SHIPPING LABEL', 14, true)
        addSeparator()

        // Waybill
        addLine(`AWB: ${wbn}`, 12, true)
        if (oid) addLine(`Order: ${oid.slice(0, 20)}`, 9)
        addLine(`Payment: ${paymentType}${codAmount > 0 ? ` | COD: Rs.${codAmount}` : ''}`, 10)
        addSeparator()

        // From
        addLine('FROM:', 10, true)
        if (senderName) addLine(senderName, 10)
        if (senderAddress) {
          // Wrap long addresses
          const addrParts = senderAddress.match(/.{1,45}/g) || [senderAddress]
          for (const part of addrParts) addLine(part, 9)
        }
        if (senderCity || senderPin) addLine(`${senderCity} ${senderPin}`.trim(), 9)
        addSeparator()

        // To
        addLine('TO:', 10, true)
        addLine(receiverName, 10)
        if (receiverAddress) {
          const addrParts = receiverAddress.match(/.{1,45}/g) || [receiverAddress]
          for (const part of addrParts) addLine(part, 9)
        }
        if (receiverPin) addLine(`PIN: ${receiverPin}`, 9)
        if (receiverPhone) addLine(`Phone: ${receiverPhone}`, 9)
        addSeparator()

        // Product
        if (productDesc) addLine(`Product: ${productDesc.slice(0, 50)}`, 9)
        
        // Routing
        if (origin) addLine(`Origin: ${origin.slice(0, 45)}`, 9)
        if (destination) addLine(`Dest: ${destination.slice(0, 45)}`, 9)
        if (sortCode) addLine(`Sort Code: ${sortCode}`, 11, true)

        const contentStream = lines.join('\n')
        const streamLength = contentStream.length

        const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${contentStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
0
%%EOF`

        console.log('[Delhivery] Generated PDF label for waybill:', wbn, 'size:', pdf.length)

        return new Response(pdf, {
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="shipping-label-${wbn}.pdf"`
          }
        })
      } catch (err) {
        console.error('[Delhivery] Label generation error:', err)
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to generate shipping label' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Action: Cancel Shipment
    if (action === 'cancel_shipment') {
      const { waybill, order_id } = data

      if (!waybill) {
        return new Response(
          JSON.stringify({ error: 'Waybill number is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const response = await fetch(`${DELHIVERY_BASE_URL}/api/p/edit`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DELHIVERY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          waybill,
          cancellation: true
        }),
      })

      const result = await response.json()
      console.log('[Delhivery] Cancel shipment response:', result)

      // Update order status
      if (order_id) {
        await supabase
          .from('orders')
          .update({
            delhivery_status: 'Cancelled'
          })
          .eq('id', order_id)
      }

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Check Pincode Serviceability
    if (action === 'check_serviceability') {
      const { pickup_pincode, delivery_pincode } = data

      if (!pickup_pincode || !delivery_pincode) {
        return new Response(
          JSON.stringify({ error: 'Both pickup and delivery pincodes are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const response = await fetch(
        `${DELHIVERY_BASE_URL}/c/api/pin-codes/json/?filter_codes=${delivery_pincode}&token=${DELHIVERY_API_KEY}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Token ${DELHIVERY_API_KEY}`,
          },
        }
      )

      const result = await response.json()
      console.log('[Delhivery] Serviceability check response:', result)

      const isServiceable = result.delivery_codes?.length > 0

      return new Response(
        JSON.stringify({ 
          success: true, 
          serviceable: isServiceable,
          data: result 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Check Shipping Rate
    if (action === 'check_shipping_rate') {
      const { delivery_pincode, weight, cod_amount, product_ids } = data

      if (!delivery_pincode) {
        return new Response(
          JSON.stringify({ error: 'Delivery pincode is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Resolve origin pincode from vendor profile or admin default pickup
      let originPincode = ''

      // Try vendor pickup from first product
      if (product_ids && product_ids.length > 0) {
        const { data: product } = await supabase
          .from('products')
          .select('vendor_id')
          .eq('id', product_ids[0])
          .single()

        if (product?.vendor_id) {
          const { data: vendorProfile } = await supabase
            .from('vendor_profiles')
            .select('pickup_pincode')
            .eq('user_id', product.vendor_id)
            .single()

          if (vendorProfile?.pickup_pincode) {
            originPincode = vendorProfile.pickup_pincode
          }
        }
      }

      // Fallback to admin default pickup
      if (!originPincode) {
        const { data: defaultPickup } = await supabase
          .from('delhivery_settings')
          .select('setting_value')
          .eq('setting_key', 'default_pickup_location')
          .single()

        const pickupVal = defaultPickup?.setting_value as { pickup_pincode?: string } | null
        originPincode = pickupVal?.pickup_pincode || ''
      }

      const weightInGrams = weight || 500
      const isCOD = cod_amount && cod_amount > 0
      const paymentType = isCOD ? 'COD' : 'Pre-paid'

      console.log(`[Delhivery] Checking shipping rate: ${originPincode} -> ${delivery_pincode}, ${weightInGrams}g, ${paymentType}`)

      // Call Delhivery rate calculator API
      const rateUrl = `${DELHIVERY_BASE_URL}/api/kinko/v1/invoice/charges/.json?md=E&ss=Delivered&d_pin=${delivery_pincode}&o_pin=${originPincode}&cgm=${weightInGrams}&pt=${paymentType}&cod=${isCOD ? cod_amount : 0}`

      let delhiveryCharge = 0
      let rateError = null

      try {
        const response = await fetch(rateUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${DELHIVERY_API_KEY}`,
          },
        })

        const result = await response.json()
        console.log('[Delhivery] Rate response:', JSON.stringify(result))

        if (result && result[0]?.total_amount !== undefined) {
          delhiveryCharge = result[0].total_amount
        } else if (result?.total_amount !== undefined) {
          delhiveryCharge = result.total_amount
        } else {
          rateError = 'Could not fetch Delhivery rate'
          console.warn('[Delhivery] Unexpected rate response format:', result)
        }
      } catch (err) {
        rateError = 'Failed to fetch Delhivery shipping rate'
        console.error('[Delhivery] Rate API error:', err)
      }

      // Fetch product shipping charges if product_ids provided
      let productShippingCharges: Record<string, number> = {}
      if (product_ids && product_ids.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, shipping_charge')
          .in('id', product_ids)

        if (products) {
          products.forEach((p: { id: string; shipping_charge: number | null }) => {
            productShippingCharges[p.id] = p.shipping_charge || 0
          })
        }
      }

      // Calculate effective shipping: max(product_shipping, delhivery_rate) per product
      // If delhivery rate fetch failed, use product shipping charge
      const effectiveCharges: Record<string, number> = {}
      let totalShipping = 0

      if (product_ids && product_ids.length > 0) {
        for (const pid of product_ids) {
          const productCharge = productShippingCharges[pid] || 0
          const effective = rateError ? productCharge : Math.max(productCharge, delhiveryCharge)
          effectiveCharges[pid] = effective
          totalShipping += effective
        }
      } else {
        totalShipping = delhiveryCharge
      }

      return new Response(
        JSON.stringify({
          success: true,
          delhivery_charge: delhiveryCharge,
          product_charges: productShippingCharges,
          effective_charges: effectiveCharges,
          total_shipping: totalShipping,
          rate_error: rateError
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Schedule Pickup for an already-manifested order
    if (action === 'schedule_pickup') {
      const { order_id, pickup_time } = data

      if (!order_id) {
        return new Response(
          JSON.stringify({ error: 'order_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get order with waybill
      const { data: order } = await supabase
        .from('orders')
        .select('id, delhivery_waybill, product_id, delhivery_status')
        .eq('id', order_id)
        .single()

      if (!order?.delhivery_waybill) {
        return new Response(
          JSON.stringify({ success: false, error: 'Order does not have a Delhivery waybill yet' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Resolve pickup location (vendor or admin default)
      let pickupLocation: VendorProfile | null = null
      let isVendor = false

      const { data: product } = await supabase
        .from('products')
        .select('vendor_id')
        .eq('id', order.product_id)
        .single()

      if (product?.vendor_id) {
        isVendor = true
        const { data: vp } = await supabase
          .from('vendor_profiles')
          .select('*')
          .eq('user_id', product.vendor_id)
          .single()
        if (vp?.pickup_address) pickupLocation = vp as VendorProfile
      }

      if (!pickupLocation) {
        const { data: dp } = await supabase
          .from('delhivery_settings')
          .select('setting_value')
          .eq('setting_key', 'default_pickup_location')
          .single()
        pickupLocation = dp?.setting_value as VendorProfile
      }

      if (!pickupLocation?.pickup_address) {
        return new Response(
          JSON.stringify({ success: false, error: 'No pickup location configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const warehouseName = getWarehouseName(pickupLocation, isVendor)

      // Call Delhivery pickup request API
      const pickupPayload: Record<string, string> = {
        pickup_location: warehouseName,
        expected_package_count: '1',
      }

      if (pickup_time) {
        pickupPayload.pickup_date = pickup_time
      }

      const pickupFormBody = Object.entries(pickupPayload)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')

      console.log('[Delhivery] Scheduling pickup for waybill:', order.delhivery_waybill, pickupPayload)

      const pickupResponse = await fetch(`${DELHIVERY_BASE_URL}/fm/request/new/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DELHIVERY_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: pickupFormBody,
      })

      const pickupResult = await pickupResponse.json()
      console.log('[Delhivery] Pickup schedule response:', pickupResult)

      // Update order status to reflect pickup scheduled
      await supabase
        .from('orders')
        .update({
          status: 'shipped',
          delhivery_status: 'Pickup Scheduled',
          shipping_created_at: new Date().toISOString(),
        })
        .eq('id', order_id)

      return new Response(
        JSON.stringify({ success: true, pickup: pickupResult }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Sync all active shipments status from Delhivery
    if (action === 'sync_all_shipments') {
      // Fetch all orders with a waybill that aren't yet completed/cancelled
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('id, delhivery_waybill, status, buyer_email, product_id')
        .not('delhivery_waybill', 'is', null)
        .not('status', 'in', '("completed","cancelled")')

      if (!activeOrders || activeOrders.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: 'No active shipments to sync', synced: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const waybills = activeOrders.map(o => o.delhivery_waybill).join(',')
      console.log(`[Delhivery] Syncing ${activeOrders.length} shipments:`, waybills)

      const trackResponse = await fetch(
        `${DELHIVERY_BASE_URL}/api/v1/packages/json/?waybill=${waybills}&token=${DELHIVERY_API_KEY}`,
        { method: 'GET', headers: { 'Authorization': `Token ${DELHIVERY_API_KEY}` } }
      )

      const trackResult = await trackResponse.json()
      const shipments = trackResult.ShipmentData || []

      // Case-insensitive status mapping for robustness
      const statusMapLower: Record<string, string> = {
        'manifested': 'processing',
        'in transit': 'shipped',
        'picked up': 'shipped',
        'dispatched': 'shipped',
        'out for delivery': 'shipped',
        'delivered': 'completed',
        'rto': 'cancelled',
        'returned': 'cancelled',
        'cancelled': 'cancelled',
        'pending': 'processing',
        'ready to dispatch': 'processing',
        'pickup scheduled': 'processing',
      }

      const statusPriority: Record<string, number> = {
        'pending': 0, 'processing': 1, 'shipped': 2, 'completed': 3, 'cancelled': 4
      }

      let synced = 0
      for (const entry of shipments) {
        const shipment = entry?.Shipment
        if (!shipment) continue

        const waybill = shipment.AWB
        const delhiveryStatus = shipment.Status?.Status || 'Unknown'
        const mappedStatus = statusMapLower[delhiveryStatus.toLowerCase()]

        const order = activeOrders.find(o => o.delhivery_waybill === waybill)
        if (!order) continue

        const updateData: Record<string, unknown> = { delhivery_status: delhiveryStatus }

        if (mappedStatus) {
          const currentPriority = statusPriority[order.status] ?? -1
          const newPriority = statusPriority[mappedStatus] ?? -1

          if (newPriority > currentPriority) {
            updateData.status = mappedStatus
            if (mappedStatus === 'completed') {
              updateData.delivered_at = new Date().toISOString()
              
              // Update vendor_earnings to completed for this order
              await supabase
                .from('vendor_earnings')
                .update({ status: 'completed' })
                .eq('order_id', order.id);
              console.log(`[Delhivery] Vendor earnings marked completed for order: ${order.id}`);
            }

            // Send notification to buyer
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', order.buyer_email)
              .maybeSingle()

            const { data: product } = await supabase
              .from('products')
              .select('name')
              .eq('id', order.product_id)
              .maybeSingle()

            const productName = product?.name || 'your product'

            if (profile) {
              const notifMessages: Record<string, { title: string; message: string; type: string }> = {
                'shipped': {
                  title: '🚚 Order Picked Up & Shipped!',
                  message: `Your order for "${productName}" has been picked up and is on its way!`,
                  type: 'info'
                },
                'completed': {
                  title: '✅ Order Delivered!',
                  message: `Your order for "${productName}" has been delivered successfully!`,
                  type: 'success'
                },
              }
              const notif = notifMessages[mappedStatus]
              if (notif) {
                await supabase.from('notifications').insert({
                  user_id: profile.id,
                  title: notif.title,
                  message: notif.message,
                  type: notif.type,
                  is_read: false,
                })
              }
            }

            synced++
          }
        }

        await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order.id)
      }

      return new Response(
        JSON.stringify({ success: true, synced, total: activeOrders.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Check Integration Status
    if (action === 'check_status') {
      return new Response(
        JSON.stringify({ 
          enabled: isEnabled,
          configured: !!DELHIVERY_API_KEY && !!DELHIVERY_CLIENT_NAME
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Get Pickup Locations
    if (action === 'get_pickup_locations') {
      const response = await fetch(
        `${DELHIVERY_BASE_URL}/c/api/backend/clientwarehouse/list?client=${DELHIVERY_CLIENT_NAME}&token=${DELHIVERY_API_KEY}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Token ${DELHIVERY_API_KEY}`,
          },
        }
      )

      const result = await response.json()
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Action: Auto-create shipment for a single order (triggered after order placement)
    if (action === 'auto_create_shipment') {
      const { order_id } = data
      if (!order_id) {
        return new Response(
          JSON.stringify({ error: 'order_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if auto-create is enabled
      const { data: autoCreateSetting } = await supabase
        .from('delhivery_settings')
        .select('setting_value')
        .eq('setting_key', 'auto_create_shipment')
        .maybeSingle()

      const isAutoCreateEnabled = (autoCreateSetting?.setting_value as { enabled?: boolean })?.enabled === true
      if (!isAutoCreateEnabled) {
        return new Response(
          JSON.stringify({ success: false, message: 'Auto-create is disabled' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get order details
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single()

      if (!order || !order.delivery_address || order.delhivery_waybill || order.is_digital) {
        return new Response(
          JSON.stringify({ success: false, message: 'Order not eligible for auto-shipment' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get product info
      const { data: product } = await supabase
        .from('products')
        .select('name, vendor_id, weight_grams')
        .eq('id', order.product_id)
        .single()

      // Get pickup location
      let pickupLocation: VendorProfile | null = null
      if (product?.vendor_id) {
        const { data: vp } = await supabase
          .from('vendor_profiles')
          .select('*')
          .eq('user_id', product.vendor_id)
          .single()
        if (vp?.pickup_address) pickupLocation = vp as VendorProfile
      }
      if (!pickupLocation) {
        const { data: dp } = await supabase
          .from('delhivery_settings')
          .select('setting_value')
          .eq('setting_key', 'default_pickup_location')
          .single()
        pickupLocation = dp?.setting_value as VendorProfile
      }

      if (!pickupLocation?.pickup_address) {
        return new Response(
          JSON.stringify({ success: false, message: 'No pickup location configured' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const deliveryAddr = order.delivery_address as DeliveryAddress
      const isCOD = order.payment_id === 'COD'
      const productWeight = product?.weight_grams || 500
      const totalWeight = productWeight * (order.quantity || 1)
      const isVendor = !!product?.vendor_id
      const warehouseName = getWarehouseName(pickupLocation, isVendor)

      // Register warehouse in Delhivery (idempotent)
      await ensureWarehouseRegistered(warehouseName, pickupLocation)

      const shipmentPayload = {
        shipments: [{
          name: deliveryAddr.name,
          add: deliveryAddr.address,
          city: deliveryAddr.city,
          state: deliveryAddr.state,
          country: 'India',
          pin: deliveryAddr.pincode,
          phone: deliveryAddr.phone,
          order: order_id.slice(0, 25),
          payment_mode: isCOD ? 'COD' : 'Prepaid',
          total_amount: order.total_amount,
          cod_amount: isCOD ? order.total_amount : 0,
          weight: totalWeight,
          products_desc: product?.name || 'Product',
          quantity: order.quantity,
          seller_name: pickupLocation.business_name,
          seller_add: pickupLocation.pickup_address,
          seller_city: pickupLocation.pickup_city,
          seller_state: pickupLocation.pickup_state,
          seller_country: 'India',
          seller_pin: pickupLocation.pickup_pincode,
          seller_phone: pickupLocation.pickup_phone,
        }],
        pickup_location: {
          name: warehouseName,
          add: pickupLocation.pickup_address,
          city: pickupLocation.pickup_city,
          state: pickupLocation.pickup_state,
          country: 'India',
          pin: pickupLocation.pickup_pincode,
          phone: pickupLocation.pickup_phone,
        }
      }

      const formBody = `format=json&data=${encodeURIComponent(JSON.stringify(shipmentPayload))}`
      const response = await fetch(`${DELHIVERY_BASE_URL}/api/cmu/create.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${DELHIVERY_API_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
      })

      const result = await response.json()
      console.log('[Delhivery] Auto-create shipment response:', result)

      const pkg = result.packages?.[0]
      if (pkg?.waybill) {
        await supabase
          .from('orders')
          .update({
            delhivery_order_id: pkg.refnum || order_id,
            delhivery_waybill: pkg.waybill,
            delhivery_status: 'Manifested',
            shipping_created_at: new Date().toISOString(),
            tracking_info: {
              carrier: 'Delhivery',
              tracking_number: pkg.waybill,
              url: `https://www.delhivery.com/track/package/${pkg.waybill}`
            },
            status: 'processing'
          })
          .eq('id', order_id)

        return new Response(
          JSON.stringify({ success: true, waybill: pkg.waybill }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: false, error: pkg?.remarks?.join('; ') || 'Auto-creation failed', details: result }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[Delhivery] Error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
