import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Trophy, TrendingUp, Medal, Star, Download, FileText } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PromoterStats {
  promoter_id: string;
  full_name: string | null;
  email: string;
  total_sales: number;
  total_earnings: number;
  conversion_rate: number;
  tier: string | null;
}

export function SalesLeaderboard() {
  const [leaderboard, setLeaderboard] = useState<PromoterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, [timeRange]);

  const fetchLeaderboard = async () => {
    setLoading(true);

    // Calculate date range
    let startDate: string | null = null;
    if (timeRange === 'week') {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (timeRange === 'month') {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    // Fetch sales data
    let salesQuery = supabase
      .from('sales')
      .select('promoter_id, total_amount, commission_amount')
      .eq('status', 'completed');

    if (startDate) {
      salesQuery = salesQuery.gte('created_at', startDate);
    }

    const { data: salesData } = await salesQuery;

    // Fetch referral links for conversion calculation
    const { data: linksData } = await supabase
      .from('referral_links')
      .select('promoter_id, clicks, conversions');

    // Aggregate by promoter
    const promoterMap = new Map<string, { 
      total_sales: number; 
      total_earnings: number;
      clicks: number;
      conversions: number;
    }>();

    salesData?.forEach(sale => {
      const current = promoterMap.get(sale.promoter_id) || { 
        total_sales: 0, 
        total_earnings: 0, 
        clicks: 0, 
        conversions: 0 
      };
      current.total_sales += Number(sale.total_amount);
      current.total_earnings += Number(sale.commission_amount);
      promoterMap.set(sale.promoter_id, current);
    });

    linksData?.forEach(link => {
      const current = promoterMap.get(link.promoter_id) || { 
        total_sales: 0, 
        total_earnings: 0, 
        clicks: 0, 
        conversions: 0 
      };
      current.clicks += link.clicks || 0;
      current.conversions += link.conversions || 0;
      promoterMap.set(link.promoter_id, current);
    });

    // Fetch profiles for promoters
    const promoterIds = Array.from(promoterMap.keys());
    if (promoterIds.length === 0) {
      setLeaderboard([]);
      setLoading(false);
      return;
    }

    const { data: allProfiles } = await supabase.rpc('get_profiles_for_manager');
    const profiles = (allProfiles || []).filter((p: any) => promoterIds.includes(p.id));

    // Build leaderboard
    const leaderboardData: PromoterStats[] = promoterIds.map(id => {
      const stats = promoterMap.get(id)!;
      const profile = profiles?.find(p => p.id === id);
      const conversionRate = stats.clicks > 0 
        ? (stats.conversions / stats.clicks) * 100 
        : 0;

      return {
        promoter_id: id,
        full_name: profile?.full_name || null,
        email: profile?.email || 'Unknown',
        total_sales: stats.total_sales,
        total_earnings: stats.total_earnings,
        conversion_rate: conversionRate,
        tier: profile?.promoter_tier || null
      };
    });

    // Sort by total earnings
    leaderboardData.sort((a, b) => b.total_earnings - a.total_earnings);
    setLeaderboard(leaderboardData.slice(0, 10));
    setLoading(false);
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 1: return <Medal className="w-5 h-5 text-gray-400" />;
      case 2: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="w-5 h-5 text-center text-muted-foreground font-bold">{index + 1}</span>;
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'week': return 'Last 7 Days';
      case 'month': return 'Last 30 Days';
      default: return 'All Time';
    }
  };

  const exportToCSV = () => {
    setExporting(true);
    try {
      const headers = ['Rank', 'Name', 'Email', 'Total Sales ($)', 'Total Earnings ($)', 'Conversion Rate (%)', 'Tier'];
      const rows = leaderboard.map((p, i) => [
        i + 1,
        p.full_name || 'N/A',
        p.email,
        p.total_sales.toFixed(2),
        p.total_earnings.toFixed(2),
        p.conversion_rate.toFixed(1),
        p.tier || 'free'
      ]);

      const csvContent = [
        `Promoter Performance Report - ${getTimeRangeLabel()}`,
        '',
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `promoter-performance-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
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
      doc.text('Promoter Performance Report', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`${getTimeRangeLabel()} • Generated on ${reportDate}`, 14, 30);

      autoTable(doc, {
        startY: 40,
        head: [['Rank', 'Name', 'Email', 'Sales', 'Earnings', 'CR%', 'Tier']],
        body: leaderboard.map((p, i) => [
          i + 1,
          p.full_name || 'N/A',
          p.email,
          `$${p.total_sales.toFixed(2)}`,
          `$${p.total_earnings.toFixed(2)}`,
          `${p.conversion_rate.toFixed(1)}%`,
          p.tier || 'free'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`promoter-performance-${timeRange}-${new Date().toISOString().split('T')[0]}.pdf`);
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
                <Trophy className="w-5 h-5 text-warning" />
                Sales Leaderboard
              </CardTitle>
              <CardDescription>Top performing promoters by earnings</CardDescription>
            </div>
            <div className="flex gap-1">
              {(['week', 'month', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    timeRange === range
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                >
                  {range === 'week' ? '7D' : range === 'month' ? '30D' : 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              disabled={exporting || leaderboard.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToPDF}
              disabled={exporting || leaderboard.length === 0}
            >
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No sales data for this period</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((promoter, index) => (
              <div
                key={promoter.promoter_id}
                className={`flex items-center gap-4 p-3 rounded-lg ${
                  index === 0 ? 'bg-warning/10 border border-warning/20' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-center w-8">
                  {getRankIcon(index)}
                </div>
                <Avatar className="w-10 h-10">
                  <AvatarFallback className={index === 0 ? 'bg-warning text-warning-foreground' : ''}>
                    {getInitials(promoter.full_name, promoter.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{promoter.full_name || promoter.email}</p>
                    {promoter.tier === 'premium' && (
                      <Star className="w-4 h-4 fill-warning text-warning" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{promoter.email}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-earnings">${promoter.total_earnings.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">
                    {promoter.conversion_rate.toFixed(1)}% CR
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
