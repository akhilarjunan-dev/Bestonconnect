import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, TrendingUp, Wallet, BarChart3, Download, FileText, CalendarIcon } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DailyData {
  date: string;
  sales: number;
  commissions: number;
  payouts: number;
}

interface StatusBreakdown {
  name: string;
  value: number;
  color: string;
}

export function FinancialOverview() {
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<StatusBreakdown[]>([]);
  const [totals, setTotals] = useState({
    totalSales: 0,
    totalCommissions: 0,
    pendingPayouts: 0,
    approvedPayouts: 0
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subDays(new Date(), 30),
    to: new Date()
  });

  useEffect(() => {
    fetchFinancialData();
  }, [dateRange]);

  const fetchFinancialData = async () => {
    setLoading(true);

    const startDate = dateRange.from.toISOString();
    const endDate = dateRange.to.toISOString();

    // Fetch sales
    const { data: salesData } = await supabase
      .from('sales')
      .select('created_at, total_amount, commission_amount, status')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Fetch earnings by status
    const { data: earningsData } = await supabase
      .from('earnings')
      .select('amount, status, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Fetch withdrawals
    const { data: withdrawalsData } = await supabase
      .from('withdrawals')
      .select('amount, status, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Aggregate daily data
    const dailyMap = new Map<string, DailyData>();
    
    // Initialize days in range
    const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    for (let i = daysDiff; i >= 0; i--) {
      const date = subDays(dateRange.to, i);
      const dateStr = date.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, sales: 0, commissions: 0, payouts: 0 });
    }

    // Aggregate sales
    salesData?.forEach(sale => {
      const dateStr = sale.created_at.split('T')[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.sales += Number(sale.total_amount);
        existing.commissions += Number(sale.commission_amount);
      }
    });

    // Aggregate withdrawals (approved)
    withdrawalsData?.filter(w => w.status === 'approved').forEach(withdrawal => {
      const dateStr = withdrawal.created_at.split('T')[0];
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.payouts += Number(withdrawal.amount);
      }
    });

    // Calculate totals
    const totalSales = salesData?.reduce((sum, s) => sum + Number(s.total_amount), 0) || 0;
    const totalCommissions = salesData?.reduce((sum, s) => sum + Number(s.commission_amount), 0) || 0;

    // Earnings status breakdown
    const pendingEarnings = earningsData?.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    const approvedEarnings = earningsData?.filter(e => e.status === 'approved').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    const rejectedEarnings = earningsData?.filter(e => e.status === 'rejected').reduce((sum, e) => sum + Number(e.amount), 0) || 0;

    // Withdrawals
    const pendingPayouts = withdrawalsData?.filter(w => w.status === 'pending').reduce((sum, w) => sum + Number(w.amount), 0) || 0;
    const approvedPayouts = withdrawalsData?.filter(w => w.status === 'approved').reduce((sum, w) => sum + Number(w.amount), 0) || 0;

    setDailyData(Array.from(dailyMap.values()));
    setStatusBreakdown([
      { name: 'Pending', value: pendingEarnings, color: 'hsl(var(--warning))' },
      { name: 'Approved', value: approvedEarnings, color: 'hsl(var(--earnings))' },
      { name: 'Rejected', value: rejectedEarnings, color: 'hsl(var(--destructive))' }
    ].filter(s => s.value > 0));
    setTotals({ totalSales, totalCommissions, pendingPayouts, approvedPayouts });
    setLoading(false);
  };

  const formatCurrency = (value: number) => `$${value.toFixed(0)}`;
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const dateRangeLabel = `${format(dateRange.from, 'MMM d, yyyy')} - ${format(dateRange.to, 'MMM d, yyyy')}`;

  const exportToCSV = () => {
    setExporting(true);
    try {
      // Build CSV content
      const headers = ['Date', 'Sales ($)', 'Commissions ($)', 'Payouts ($)'];
      const rows = dailyData.map(d => [
        d.date,
        d.sales.toFixed(2),
        d.commissions.toFixed(2),
        d.payouts.toFixed(2)
      ]);
      
      // Add summary section
      const summaryRows = [
        [],
        [`Summary (${dateRangeLabel})`],
        ['Total Sales', totals.totalSales.toFixed(2)],
        ['Total Commissions', totals.totalCommissions.toFixed(2)],
        ['Pending Payouts', totals.pendingPayouts.toFixed(2)],
        ['Approved Payouts', totals.approvedPayouts.toFixed(2)],
        [],
        ['Earnings Breakdown'],
        ...statusBreakdown.map(s => [s.name, s.value.toFixed(2)])
      ];
      
      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(',')),
        ...summaryRows.map(r => r.join(','))
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
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

      // Title
      doc.setFontSize(20);
      doc.text('Financial Report', 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on ${reportDate}`, 14, 30);

      // Summary section
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(`Summary (${dateRangeLabel})`, 14, 45);
      
      autoTable(doc, {
        startY: 50,
        head: [['Metric', 'Amount']],
        body: [
          ['Total Sales', `$${totals.totalSales.toLocaleString()}`],
          ['Total Commissions', `$${totals.totalCommissions.toLocaleString()}`],
          ['Pending Payouts', `$${totals.pendingPayouts.toLocaleString()}`],
          ['Approved Payouts', `$${totals.approvedPayouts.toLocaleString()}`],
        ],
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      // Earnings breakdown
      const currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('Earnings by Status', 14, currentY);
      
      if (statusBreakdown.length > 0) {
        autoTable(doc, {
          startY: currentY + 5,
          head: [['Status', 'Amount']],
          body: statusBreakdown.map(s => [s.name, `$${s.value.toLocaleString()}`]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] }
        });
      }

      // Daily data table
      const dailyY = (doc as any).lastAutoTable?.finalY + 15 || currentY + 20;
      doc.setFontSize(14);
      doc.text('Daily Activity', 14, dailyY);
      
      autoTable(doc, {
        startY: dailyY + 5,
        head: [['Date', 'Sales', 'Commissions', 'Payouts']],
        body: dailyData.filter(d => d.sales > 0 || d.commissions > 0 || d.payouts > 0).map(d => [
          d.date,
          `$${d.sales.toFixed(2)}`,
          `$${d.commissions.toFixed(2)}`,
          `$${d.payouts.toFixed(2)}`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save(`financial-report-${new Date().toISOString().split('T')[0]}.pdf`);
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
    <div className="space-y-6">
      {/* Date Range & Export Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[140px] justify-start">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {format(dateRange.from, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.from}
                onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
                disabled={(date) => date > dateRange.to || date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[140px] justify-start">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {format(dateRange.to, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateRange.to}
                onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
                disabled={(date) => date < dateRange.from || date > new Date()}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCSV}
            disabled={exporting}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToPDF}
            disabled={exporting}
          >
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totals.totalSales.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Sales (30d)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-earnings/10">
              <TrendingUp className="w-5 h-5 text-earnings" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totals.totalCommissions.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Commissions (30d)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
              <Wallet className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totals.pendingPayouts.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Pending Payouts</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
              <BarChart3 className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold">${totals.approvedPayouts.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Paid Out (30d)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales & Commissions Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Sales & Commissions Trend</CardTitle>
            <CardDescription>Last 30 days performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate} 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tickFormatter={formatCurrency} 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                    labelFormatter={formatDate}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    stackId="1"
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary)/0.2)"
                    name="Sales"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="commissions" 
                    stackId="2"
                    stroke="hsl(var(--earnings))" 
                    fill="hsl(var(--earnings)/0.2)"
                    name="Commissions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Earnings Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Earnings Status</CardTitle>
            <CardDescription>All-time earnings by status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusBreakdown.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No earnings data yet
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: $${value.toFixed(0)}`}
                    >
                      {statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="flex justify-center gap-6 mt-4">
              {statusBreakdown.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Payouts Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Activity</CardTitle>
          <CardDescription>Approved withdrawals over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate} 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tickFormatter={formatCurrency} 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Payouts']}
                  labelFormatter={formatDate}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="payouts" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
