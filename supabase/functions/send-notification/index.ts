import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'order_confirmation' | 'commission_alert' | 'digital_delivery' | 'support_reply' | 'order_placed_alert' | 'order_status_update' | 'premium_upgrade' | 'premium_expiry_reminder';
  data: Record<string, unknown>;
}

async function sendEmail(to: string[], subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'BestonConnect <support@bestonconnect.com>',
      to,
      subject,
      html,
    }),
  });

  return response.json();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data }: EmailRequest = await req.json();
    let emailResponse;

    if (type === 'order_confirmation') {
      const { buyer_email, buyer_name, product_name, quantity, total_amount, order_id } = data as {
        buyer_email: string;
        buyer_name?: string;
        product_name: string;
        quantity: number;
        total_amount: number;
        order_id: string;
      };

      console.log('Sending order confirmation to:', buyer_email);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .total { font-size: 24px; font-weight: bold; color: #6366f1; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Order Confirmed! 🎉</h1>
            </div>
            <div class="content">
              <p>Hi ${buyer_name || 'there'},</p>
              <p>Thank you for your order! We've received your purchase and it's being processed.</p>
              
              <div class="order-details">
                <h3 style="margin-top: 0;">Order Details</h3>
                <p><strong>Order ID:</strong> ${order_id}</p>
                <p><strong>Product:</strong> ${product_name}</p>
                <p><strong>Quantity:</strong> ${quantity}</p>
                <p class="total">Total: ₹${total_amount.toLocaleString()}</p>
              </div>

              <p>Thank you for shopping with us!</p>
            </div>
            <div class="footer">
              <p>© 2024 PromoterHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      emailResponse = await sendEmail([buyer_email], `Order Confirmed - ${product_name}`, html);
      console.log("Order confirmation sent:", emailResponse);
    }

    if (type === 'commission_alert') {
      const { promoter_email, promoter_name, product_name, commission_amount, sale_date } = data as {
        promoter_email: string;
        promoter_name?: string;
        product_name: string;
        commission_amount: number;
        sale_date: string;
      };

      console.log('Sending commission alert to:', promoter_email);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .earnings-box { background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #10b981; }
            .amount { font-size: 48px; font-weight: bold; color: #10b981; margin: 10px 0; }
            .details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Cha-Ching! 💰</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">You just made a sale!</p>
            </div>
            <div class="content">
              <p>Hi ${promoter_name || 'Promoter'},</p>
              <p>Great news! Someone just purchased a product through your referral link.</p>
              
              <div class="earnings-box">
                <p style="margin: 0; color: #666;">Commission Earned</p>
                <p class="amount">₹${commission_amount.toLocaleString()}</p>
              </div>

              <div class="details">
                <h3 style="margin-top: 0;">Sale Details</h3>
                <p><strong>Product:</strong> ${product_name}</p>
                <p><strong>Date:</strong> ${new Date(sale_date).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
              </div>

              <p>This commission is now pending approval. Once approved, it will be added to your earnings wallet.</p>
              <p>Keep up the great work! 🚀</p>
            </div>
            <div class="footer">
              <p>© 2024 PromoterHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      emailResponse = await sendEmail([promoter_email], `🎉 You earned ₹${commission_amount} commission!`, html);
      console.log("Commission alert sent:", emailResponse);
    }

    if (type === 'digital_delivery') {
      const { buyer_email, buyer_name, product_id, product_name, order_id } = data as {
        buyer_email: string;
        buyer_name?: string;
        product_id: string;
        product_name: string;
        order_id: string;
      };

      console.log('Sending digital delivery to:', buyer_email);

      // Fetch the digital file URL from products
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: product } = await supabase
        .from('products')
        .select('digital_file_url')
        .eq('id', product_id)
        .single();

      let downloadLink = '';
      if (product?.digital_file_url) {
        // Generate a signed URL for the digital file (valid for 7 days)
        const { data: signedUrl } = await supabase.storage
          .from('digital-products')
          .createSignedUrl(product.digital_file_url, 60 * 60 * 24 * 7);
        
        downloadLink = signedUrl?.signedUrl || '';
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .download-box { background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #3b82f6; }
            .download-btn { display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 15px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Your Digital Product is Ready! 📦</h1>
            </div>
            <div class="content">
              <p>Hi ${buyer_name || 'there'},</p>
              <p>Thank you for your purchase! Your digital product is ready for download.</p>
              
              <div class="download-box">
                <h3 style="margin-top: 0;">${product_name}</h3>
                <p style="color: #666;">Order ID: ${order_id}</p>
                ${downloadLink ? `
                  <a href="${downloadLink}" class="download-btn">Download Now</a>
                  <p style="font-size: 12px; color: #666; margin-top: 15px;">This download link is valid for 7 days.</p>
                ` : `
                  <p style="color: #666;">Your download link will be sent separately.</p>
                `}
              </div>

              <p>If you have any issues with your download, please contact our support team.</p>
              <p>Thank you for shopping with us!</p>
            </div>
            <div class="footer">
              <p>© 2024 PromoterHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      emailResponse = await sendEmail([buyer_email], `Your Digital Product: ${product_name}`, html);
      console.log("Digital delivery sent:", emailResponse);
    }

    if (type === 'order_placed_alert') {
      const { order_id, product_id: alertProductId, product_name, buyer_name, buyer_email: orderBuyerEmail, quantity, total_amount, payment_method, vendor_id } = data as {
        order_id: string;
        product_id?: string;
        product_name: string;
        buyer_name?: string;
        buyer_email: string;
        quantity: number;
        total_amount: number;
        payment_method: string;
        vendor_id?: string;
      };

      console.log('Sending order placed alert to admin/manager/vendor');

      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch admin & manager emails from user_roles + profiles
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'manager']);

      const recipientEmails: string[] = [];

      if (adminRoles && adminRoles.length > 0) {
        const userIds = adminRoles.map((r: any) => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email')
          .in('id', userIds);
        if (profiles) {
          recipientEmails.push(...profiles.map((p: any) => p.email).filter(Boolean));
        }
      }

      // Fetch vendor email - from vendor_id or by looking up product
      let resolvedVendorId = vendor_id;
      if (!resolvedVendorId && alertProductId) {
        const { data: productData } = await supabase
          .from('products')
          .select('vendor_id')
          .eq('id', alertProductId)
          .single();
        resolvedVendorId = productData?.vendor_id;
      }
      if (resolvedVendorId) {
        const { data: vendorProfile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', resolvedVendorId)
          .single();
        if (vendorProfile?.email && !recipientEmails.includes(vendorProfile.email)) {
          recipientEmails.push(vendorProfile.email);
        }
      }

      if (recipientEmails.length === 0) {
        console.log('No admin/manager/vendor emails found, skipping');
      } else {
        const orderDate = new Date().toLocaleDateString('en-IN', { dateStyle: 'long' });
        const alertHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
              .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
              .total { font-size: 24px; font-weight: bold; color: #d97706; }
              .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 28px;">New Order Received! 🛍️</h1>
              </div>
              <div class="content">
                <p>A new order has been placed on BestonConnect.</p>
                
                <div class="order-details">
                  <h3 style="margin-top: 0;">Order Summary</h3>
                  <p><strong>Order ID:</strong> ${order_id}</p>
                  <p><strong>Product:</strong> ${product_name}</p>
                  <p><strong>Customer:</strong> ${buyer_name || 'Guest'} (${orderBuyerEmail})</p>
                  <p><strong>Quantity:</strong> ${quantity}</p>
                  <p><strong>Payment:</strong> <span class="badge">${payment_method}</span></p>
                  <p><strong>Date:</strong> ${orderDate}</p>
                  <p class="total">Total: ₹${Number(total_amount).toLocaleString()}</p>
                </div>

                <p>Please log in to the dashboard to process this order.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} BestonConnect. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        emailResponse = await sendEmail(recipientEmails, `🛍️ New Order: ${product_name} - ₹${Number(total_amount).toLocaleString()}`, alertHtml);
        console.log('Order placed alert sent to:', recipientEmails, emailResponse);
      }
    }

    if (type === 'support_reply') {
      const { user_email, user_name, subject, original_message, admin_reply } = data as {
        user_email: string;
        user_name?: string;
        subject: string;
        original_message: string;
        admin_reply: string;
      };

      console.log('Sending support reply to:', user_email);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .message-box { background: #e5e7eb; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #9ca3af; }
            .reply-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6366f1; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">Support Response 💬</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">We've replied to your message</p>
            </div>
            <div class="content">
              <p>Hi ${user_name || 'there'},</p>
              <p>Thank you for contacting our support team. Here's our response to your inquiry:</p>
              
              <p style="font-weight: bold; margin-bottom: 5px;">Your Message:</p>
              <div class="message-box">
                <p style="margin: 0; font-weight: bold;">${subject}</p>
                <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${original_message}</p>
              </div>

              <p style="font-weight: bold; margin-bottom: 5px;">Our Response:</p>
              <div class="reply-box">
                <p style="margin: 0; white-space: pre-wrap;">${admin_reply}</p>
              </div>

              <p>If you have any further questions, please don't hesitate to reach out again.</p>
              <p>Best regards,<br>The Support Team</p>
            </div>
            <div class="footer">
              <p>© 2024 PromoterHub. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      emailResponse = await sendEmail([user_email], `Re: ${subject} - Support Response`, html);
      console.log("Support reply sent:", emailResponse);
    }

    if (type === 'order_status_update') {
      const { buyer_email, buyer_name, product_name, order_id, new_status, tracking_number } = data as {
        buyer_email: string;
        buyer_name?: string;
        product_name: string;
        order_id: string;
        new_status: string;
        tracking_number?: string;
      };

      console.log('Sending order status update to:', buyer_email);

      const statusConfig: Record<string, { emoji: string; color: string; title: string; message: string }> = {
        processing: { emoji: '📋', color: '#3b82f6', title: 'Order Being Processed', message: 'Your order is now being processed and will be shipped soon.' },
        shipped: { emoji: '📦', color: '#8b5cf6', title: 'Order Shipped!', message: `Your order has been shipped!${tracking_number ? ` Tracking: ${tracking_number}` : ' Tracking info will be updated soon.'}` },
        completed: { emoji: '✅', color: '#10b981', title: 'Order Delivered!', message: 'Your order has been delivered successfully. We hope you enjoy your purchase!' },
        cancelled: { emoji: '❌', color: '#ef4444', title: 'Order Cancelled', message: 'Your order has been cancelled. If you have questions, please contact support.' },
      };

      const config = statusConfig[new_status] || { emoji: '📦', color: '#6366f1', title: 'Order Update', message: `Your order status has been updated to: ${new_status}` };

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: ${config.color}; color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">${config.emoji} ${config.title}</h1>
            </div>
            <div class="content">
              <p>Hi ${buyer_name || 'there'},</p>
              <p>${config.message}</p>
              <div class="order-details">
                <p><strong>Order ID:</strong> ${order_id}</p>
                <p><strong>Product:</strong> ${product_name}</p>
                <p><strong>Status:</strong> ${new_status.charAt(0).toUpperCase() + new_status.slice(1)}</p>
                ${tracking_number ? `<p><strong>Tracking:</strong> ${tracking_number}</p>` : ''}
              </div>
              <p>Thank you for shopping with BestonConnect!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} BestonConnect. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      emailResponse = await sendEmail([buyer_email], `${config.emoji} ${config.title} - ${product_name}`, html);
      console.log("Order status update sent:", emailResponse);
    }

    if (type === 'premium_upgrade') {
      const { promoter_email, promoter_name, plan_type, amount, expires_at } = data as {
        promoter_email: string;
        promoter_name?: string;
        plan_type: string;
        amount: number;
        expires_at: string;
      };

      console.log('Sending premium upgrade email to:', promoter_email);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .premium-box { background: white; padding: 30px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #f59e0b; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🎉 Welcome to Premium!</h1>
            </div>
            <div class="content">
              <p>Hi ${promoter_name || 'Promoter'},</p>
              <p>Congratulations! You've been upgraded to <strong>Premium Promoter</strong>.</p>
              <div class="premium-box">
                <h3 style="margin-top: 0;">👑 Premium Plan</h3>
                <p><strong>Plan:</strong> ${plan_type}</p>
                <p><strong>Amount:</strong> ₹${amount.toLocaleString()}</p>
                <p><strong>Valid Until:</strong> ${new Date(expires_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
              </div>
              <p>You now have access to unlimited referral links, higher commissions, priority withdrawals, and more!</p>
              <p>Start promoting and earn more! 🚀</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} BestonConnect. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      emailResponse = await sendEmail([promoter_email], `👑 Premium Upgrade Confirmed!`, html);
      console.log("Premium upgrade email sent:", emailResponse);
    }

    if (type === 'premium_expiry_reminder') {
      const { promoter_email, promoter_name, expires_at } = data as {
        promoter_email: string;
        promoter_name?: string;
        expires_at: string;
      };

      console.log('Sending premium expiry reminder to:', promoter_email);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
            .warning-box { background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #fecaca; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">⚠️ Subscription Expiring Soon</h1>
            </div>
            <div class="content">
              <p>Hi ${promoter_name || 'Promoter'},</p>
              <div class="warning-box">
                <p>Your Premium subscription expires on <strong>${new Date(expires_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</strong>.</p>
                <p>Renew now to keep your premium benefits including higher commissions, unlimited links, and priority withdrawals.</p>
              </div>
              <p>Log in to your dashboard to renew your subscription.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} BestonConnect. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      emailResponse = await sendEmail([promoter_email], `⚠️ Your Premium Subscription Expires Soon`, html);
      console.log("Premium expiry reminder sent:", emailResponse);
    }

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);