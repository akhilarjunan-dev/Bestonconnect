import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, UserX, TrendingDown, Clock, Bell, Download, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PromoterAlert {
  promoter_id: string;
  full_name: string | null;
  email: string;
  alert_type: 'inactive' | 'low_conversion' | 'pending_kyc' | 'no_links';
  alert_message: string;
  last_activity: string | null;
  priority: 'high' | 'medium' | 'low';
}

export function PromoterFollowups() {
  const [alerts, setAlerts] = useState<PromoterAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    const alertsList: PromoterAlert[] = [];

    // Get all promoters
    const { data: promoterRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'promoter');

    if (!promoterRoles || promoterRoles.length === 0) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const promoterIds = promoterRoles.map(r => r.user_id);

    // Fetch profiles via secure RPC (excludes sensitive fields)
    const { data: allProfiles } = await supabase.rpc('get_profiles_for_manager');
    const profiles = (allProfiles || []).filter((p: any) => promoterIds.includes(p.id));

    // Fetch referral links
    const { data: links } = await supabase
      .from('referral_links')
      .select('promoter_id, clicks, conversions, created_at')
      .in('promoter_id', promoterIds);

    // Fetch recent sales
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSales } = await supabase
      .from('sales')
      .select('promoter_id, created_at')
      .in('promoter_id', promoterIds)
      .gte('created_at', thirtyDaysAgo);

    // Analyze each promoter
    for (const promoterId of promoterIds) {
      const profile = profiles?.find(p => p.id === promoterId);
      if (!profile) continue;

      const promoterLinks = links?.filter(l => l.promoter_id === promoterId) || [];
      const promoterSales = recentSales?.filter(s => s.promoter_id === promoterId) || [];

      // Check for pending KYC
      if (profile.kyc_status === 'pending') {
        alertsList.push({
          promoter_id: promoterId,
          full_name: profile.full_name,
          email: profile.email,
          alert_type: 'pending_kyc',
          alert_message: 'KYC verification pending - cannot receive payouts',
          last_activity: null,
          priority: 'high'
        });
      }

      // Check for no referral links
      if (promoterLinks.length === 0) {
        alertsList.push({
          promoter_id: promoterId,
          full_name: profile.full_name,
          email: profile.email,
          alert_type: 'no_links',
          alert_message: 'Has not created any referral links yet',
          last_activity: null,
          priority: 'medium'
        });
        continue;
      }

      // Check for inactivity (no sales in 30 days with active links)
      if (promoterSales.length === 0 && promoterLinks.length > 0) {
        const lastLinkDate = promoterLinks
          .map(l => new Date(l.created_at))
          .sort((a, b) => b.getTime() - a.getTime())[0];

        alertsList.push({
          promoter_id: promoterId,
          full_name: profile.full_name,
          email: profile.email,
          alert_type: 'inactive',
          alert_message: 'No sales in the last 30 days',
          last_activity: lastLinkDate?.toISOString() || null,
          priority: 'medium'
        });
      }

      // Check for low conversion rate
      const totalClicks = promoterLinks.reduce((sum, l) => sum + (l.clicks || 0), 0);
      const totalConversions = promoterLinks.reduce((sum, l) => sum + (l.conversions || 0), 0);
      const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

      if (totalClicks >= 50 && conversionRate < 1) {
        alertsList.push({
          promoter_id: promoterId,
          full_name: profile.full_name,
          email: profile.email,
          alert_type: 'low_conversion',
          alert_message: `Very low conversion rate: ${conversionRate.toFixed(1)}% (${totalClicks} clicks)`,
          last_activity: null,
          priority: 'low'
        });
      }
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    alertsList.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    setAlerts(alertsList);
    setLoading(false);
  };

  const getAlertIcon = (type: PromoterAlert['alert_type']) => {
    switch (type) {
      case 'inactive': return <Clock className="w-4 h-4" />;
      case 'low_conversion': return <TrendingDown className="w-4 h-4" />;
      case 'pending_kyc': return <AlertTriangle className="w-4 h-4" />;
      case 'no_links': return <UserX className="w-4 h-4" />;
    }
  };

  const getPriorityBadge = (priority: PromoterAlert['priority']) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">High</Badge>;
      case 'medium': return <Badge variant="secondary" className="bg-warning/20 text-warning-foreground">Medium</Badge>;
      case 'low': return <Badge variant="outline">Low</Badge>;
    }
  };

  const getAlertTypeLabel = (type: PromoterAlert['alert_type']) => {
    switch (type) {
      case 'inactive': return 'Inactive';
      case 'low_conversion': return 'Low Conversion';
      case 'pending_kyc': return 'Pending KYC';
      case 'no_links': return 'No Links';
    }
  };

  const exportToCSV = () => {
    setExporting(true);
    try {
      const headers = ['Name', 'Email', 'Alert Type', 'Message', 'Priority', 'Last Activity'];
      const rows = alerts.map(a => [
        a.full_name || 'N/A',
        a.email,
        getAlertTypeLabel(a.alert_type),
        a.alert_message,
        a.priority,
        a.last_activity ? new Date(a.last_activity).toLocaleDateString() : 'N/A'
      ]);

      const csvContent = [
        `Promoter Follow-ups Report - Generated ${new Date().toLocaleDateString()}`,
        '',
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `promoter-followups-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast({ title: 'CSV exported successfully' });
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const reportDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });

      doc.setFontSize(20);
      doc.text('Promoter Follow-ups Report', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on ${reportDate}`, 14, 30);

      // Summary
      const highPriority = alerts.filter(a => a.priority === 'high').length;
      const mediumPriority = alerts.filter(a => a.priority === 'medium').length;
      const lowPriority = alerts.filter(a => a.priority === 'low').length;

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`Summary: ${alerts.length} total alerts (${highPriority} high, ${mediumPriority} medium, ${lowPriority} low)`, 14, 42);

      autoTable(doc, {
        startY: 50,
        head: [['Name', 'Email', 'Type', 'Message', 'Priority']],
        body: alerts.map(a => [
          a.full_name || 'N/A',
          a.email,
          getAlertTypeLabel(a.alert_type),
          a.alert_message,
          a.priority.charAt(0).toUpperCase() + a.priority.slice(1)
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          3: { cellWidth: 50 }
        }
      });

      doc.save(`promoter-followups-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'PDF exported successfully' });
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-warning" />
                Promoter Follow-ups
                {alerts.length > 0 && (
                  <Badge variant="secondary">{alerts.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>Promoters who may need attention or support</CardDescription>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              disabled={exporting || alerts.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToPDF}
              disabled={exporting || alerts.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>All promoters are performing well!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={`${alert.promoter_id}-${alert.alert_type}`}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card"
              >
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  alert.priority === 'high' ? 'bg-destructive/10 text-destructive' :
                  alert.priority === 'medium' ? 'bg-warning/10 text-warning' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {getAlertIcon(alert.alert_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{alert.full_name || alert.email}</p>
                    {getPriorityBadge(alert.priority)}
                  </div>
                  <p className="text-sm text-muted-foreground">{alert.email}</p>
                  <p className="text-sm mt-1">{alert.alert_message}</p>
                  {alert.last_activity && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Last activity: {new Date(alert.last_activity).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
