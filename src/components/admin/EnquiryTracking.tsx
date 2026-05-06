import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Enquiry {
  id: string;
  product_id: string;
  user_id: string;
  vendor_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  message: string | null;
  whatsapp_sent: boolean;
  created_at: string;
  product_name?: string;
  customer_email?: string;
  vendor_name?: string;
}

interface VendorEnquiryCount {
  vendor_id: string;
  vendor_name: string;
  count: number;
}

export function EnquiryTracking() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [vendorCounts, setVendorCounts] = useState<VendorEnquiryCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchEnquiries(); }, []);

  const fetchEnquiries = async () => {
    const { data, error } = await supabase
      .from('product_enquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { toast.error('Failed to fetch enquiries'); setLoading(false); return; }

    const enriched: Enquiry[] = [];
    const vendorMap: Record<string, { name: string; count: number }> = {};

    for (const enq of (data || [])) {
      const { data: product } = await supabase.from('products').select('name').eq('id', enq.product_id).maybeSingle();
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', enq.user_id).maybeSingle();
      let vendorName: string | undefined;
      if (enq.vendor_id) {
        const { data: vp } = await supabase.from('profiles').select('full_name').eq('id', enq.vendor_id).maybeSingle();
        vendorName = vp?.full_name || undefined;
        if (vendorName) {
          if (!vendorMap[enq.vendor_id]) vendorMap[enq.vendor_id] = { name: vendorName, count: 0 };
          vendorMap[enq.vendor_id].count++;
        }
      }
      enriched.push({
        ...enq,
        product_name: product?.name,
        customer_email: profile?.email,
        vendor_name: vendorName,
      });
    }

    setEnquiries(enriched);
    setVendorCounts(Object.entries(vendorMap).map(([id, v]) => ({ vendor_id: id, vendor_name: v.name, count: v.count })));
    setLoading(false);
  };

  if (loading) return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>;

  return (
    <div className="space-y-6">
      {/* Vendor Enquiry Counts */}
      {vendorCounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {vendorCounts.map(vc => (
            <Card key={vc.vendor_id}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{vc.count}</p>
                <p className="text-sm text-muted-foreground">{vc.vendor_name}</p>
                <p className="text-xs text-muted-foreground">enquiries</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Product Enquiries</CardTitle>
              <CardDescription>Track customer enquiries sent via WhatsApp to vendors</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {enquiries.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No enquiries yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>WhatsApp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enquiries.map(enq => (
                  <TableRow key={enq.id}>
                    <TableCell className="text-sm">{format(new Date(enq.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                    <TableCell className="font-medium">{enq.product_name || '-'}</TableCell>
                    <TableCell>
                      <div className="text-sm">{enq.customer_name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{enq.customer_email}</div>
                    </TableCell>
                    <TableCell className="text-sm">{enq.customer_phone || '-'}</TableCell>
                    <TableCell>{enq.vendor_name || 'Admin'}</TableCell>
                    <TableCell>
                      <Badge variant={enq.whatsapp_sent ? 'default' : 'secondary'}>
                        {enq.whatsapp_sent ? 'Sent' : 'Pending'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
