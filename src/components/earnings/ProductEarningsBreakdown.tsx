import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Package, TrendingUp, DollarSign, ShoppingBag, 
  Zap, Flame, ArrowUpRight, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProductEarning {
  product_id: string;
  product_name: string;
  product_image: string | null;
  total_sales: number;
  total_quantity: number;
  total_earnings: number;
  base_earnings: number;
  bonus_earnings: number;
  commission_rate: number;
  last_sale_date: string;
}

interface ProductEarningsBreakdownProps {
  userId: string;
  className?: string;
}

export function ProductEarningsBreakdown({ userId, className }: ProductEarningsBreakdownProps) {
  const [productEarnings, setProductEarnings] = useState<ProductEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProductEarnings = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch sales data grouped by product
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          product_id,
          quantity,
          total_amount,
          commission_amount,
          commission_rate,
          created_at,
          products (
            id,
            name,
            image_urls
          )
        `)
        .eq('promoter_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (salesError) {
        console.error('Error fetching sales:', salesError);
        return;
      }

      // Fetch earnings data for bonus calculations
      const { data: earningsData, error: earningsError } = await supabase
        .from('earnings')
        .select('*')
        .eq('promoter_id', userId);

      if (earningsError) {
        console.error('Error fetching earnings:', earningsError);
      }

      // Group sales by product
      const productMap = new Map<string, ProductEarning>();

      (salesData || []).forEach((sale: any) => {
        const productId = sale.product_id;
        const existing = productMap.get(productId);

        if (existing) {
          existing.total_sales += 1;
          existing.total_quantity += sale.quantity;
          existing.total_earnings += Number(sale.commission_amount);
          existing.base_earnings += Number(sale.commission_amount);
          if (new Date(sale.created_at) > new Date(existing.last_sale_date)) {
            existing.last_sale_date = sale.created_at;
          }
        } else {
          productMap.set(productId, {
            product_id: productId,
            product_name: sale.products?.name || 'Unknown Product',
            product_image: sale.products?.image_urls?.[0] || null,
            total_sales: 1,
            total_quantity: sale.quantity,
            total_earnings: Number(sale.commission_amount),
            base_earnings: Number(sale.commission_amount),
            bonus_earnings: 0,
            commission_rate: sale.commission_rate,
            last_sale_date: sale.created_at,
          });
        }
      });

      // Add bonus earnings from earnings table (if linked to sales)
      (earningsData || []).forEach((earning: any) => {
        const baseAmount = Number(earning.base_amount) || 0;
        const totalAmount = Number(earning.amount) || 0;
        const bonusAmount = totalAmount - baseAmount;

        // Distribute bonus proportionally across products (simplified)
        if (bonusAmount > 0 && productMap.size > 0) {
          const bonusPerProduct = bonusAmount / productMap.size;
          productMap.forEach((product) => {
            product.bonus_earnings += bonusPerProduct / productMap.size;
            product.total_earnings += bonusPerProduct / productMap.size;
          });
        }
      });

      // Convert to array and sort by earnings
      const sortedProducts = Array.from(productMap.values())
        .sort((a, b) => b.total_earnings - a.total_earnings);

      setProductEarnings(sortedProducts);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProductEarnings();

    // Set up real-time subscription for sales
    const channel = supabase
      .channel('product-earnings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
          filter: `promoter_id=eq.${userId}`
        },
        () => {
          fetchProductEarnings();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'earnings',
          filter: `promoter_id=eq.${userId}`
        },
        () => {
          fetchProductEarnings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchProductEarnings]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchProductEarnings();
  };

  const totalEarnings = productEarnings.reduce((sum, p) => sum + p.total_earnings, 0);
  const topProduct = productEarnings[0];

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (productEarnings.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Product Earnings
          </CardTitle>
          <CardDescription>Earnings breakdown by product</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No product earnings yet</p>
            <p className="text-sm">Start promoting products to see earnings here!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Product Earnings
            </CardTitle>
            <CardDescription>Real-time earnings breakdown by product</CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Performer */}
        {topProduct && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-earnings/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Top Performer</span>
            </div>
            <div className="flex items-center gap-4">
              {topProduct.product_image ? (
                <img 
                  src={topProduct.product_image} 
                  alt={topProduct.product_name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold line-clamp-1">{topProduct.product_name}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3" />
                    {topProduct.total_sales} sales
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {topProduct.commission_rate}% rate
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-earnings">₹{topProduct.total_earnings.toLocaleString()}</p>
                {topProduct.bonus_earnings > 0 && (
                  <Badge variant="outline" className="text-xs text-earnings border-earnings/30">
                    +₹{topProduct.bonus_earnings.toFixed(0)} bonus
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Product List */}
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {productEarnings.map((product, index) => {
              const percentage = totalEarnings > 0 ? (product.total_earnings / totalEarnings) * 100 : 0;
              
              return (
                <div 
                  key={product.product_id}
                  className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background text-sm font-bold">
                      {index + 1}
                    </div>
                    {product.product_image ? (
                      <img 
                        src={product.product_image} 
                        alt={product.product_name}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{product.product_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{product.total_sales} sales</span>
                        <span>•</span>
                        <span>{product.total_quantity} units</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-earnings">₹{product.total_earnings.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <Progress value={percentage} className="h-1 mt-2" />
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Summary */}
        <div className="p-4 rounded-lg bg-earnings/10 border border-earnings/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-earnings" />
              <span className="font-medium">Total from {productEarnings.length} products</span>
            </div>
            <p className="text-xl font-bold text-earnings">₹{totalEarnings.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}