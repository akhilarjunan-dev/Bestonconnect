import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Store, ShoppingCart, Package, Zap } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { PhoneNumberDialog } from '@/components/checkout/PhoneNumberDialog';
import { toast } from 'sonner';

interface ShowcaseShop {
  id: string;
  shop_name: string;
  owner_type: string;
  banner_url: string | null;
  selected_product_ids: string[];
  is_active: boolean;
  trial_ends_at: string;
  is_premium: boolean;
}

interface Product {
  id: string;
  name: string;
  price: number;
  mrp: number | null;
  image_urls: string[] | null;
  description: string | null;
  category: string;
  is_digital: boolean;
  commission_rate: number;
  stock_quantity: number | null;
}

export default function ShowcasePage() {
  const { shopName } = useParams<{ shopName: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<ShowcaseShop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  const { user } = useAuth();
  const { addToCart, clearCart, cartCount } = useCart();

  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [pendingBuyProduct, setPendingBuyProduct] = useState<Product | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  useEffect(() => {
    if (shopName) {
      fetchShowcase();
    }
  }, [shopName]);

  useEffect(() => {
    if (user) {
      supabase.from('profiles').select('phone').eq('id', user.id).maybeSingle()
        .then(({ data }) => setUserPhone(data?.phone || null));
    }
  }, [user]);

  const fetchShowcase = async () => {
    setLoading(true);
    const { data: shopData, error } = await supabase
      .from('showcase_shops')
      .select('*')
      .eq('shop_name', shopName)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !shopData) {
      navigate('/');
      return;
    }

    const shop = shopData as unknown as ShowcaseShop;

    if (!shop.is_premium) {
      const now = new Date();
      const endsAt = new Date(shop.trial_ends_at);
      if (now > endsAt) {
        setExpired(true);
        setLoading(false);
        setTimeout(() => navigate('/'), 3000);
        return;
      }
    }

    setShop(shop);

    if (shop.selected_product_ids && shop.selected_product_ids.length > 0) {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, price, mrp, image_urls, description, category, is_digital, commission_rate, stock_quantity')
        .in('id', shop.selected_product_ids)
        .eq('is_active', true);
      setProducts((prods as Product[]) || []);
    }

    setLoading(false);
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_urls: product.image_urls,
      is_digital: product.is_digital,
      commission_rate: product.commission_rate,
    });
    toast.success(`${product.name} added to cart`);
  };

  const handleBuyNow = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!userPhone) {
      setPendingBuyProduct(product);
      setShowPhoneDialog(true);
      return;
    }
    executeBuyNow(product);
  };

  const executeBuyNow = (product: Product) => {
    clearCart();
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image_urls: product.image_urls,
      is_digital: product.is_digital,
      commission_rate: product.commission_rate,
    });
    navigate('/cart');
  };

  const handlePhoneConfirmed = (phone: string) => {
    setUserPhone(phone);
    if (pendingBuyProduct) {
      executeBuyNow(pendingBuyProduct);
      setPendingBuyProduct(null);
    }
  };

  const getDiscountPercent = (price: number, mrp: number | null) => {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (expired) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <Store className="w-16 h-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Shop Not Available</h1>
          <p className="text-muted-foreground">This showcase shop's trial has expired. Redirecting...</p>
        </div>
      </Layout>
    );
  }

  if (!shop) return null;

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Banner */}
        {shop.banner_url && (
          <div className="w-full h-48 sm:h-64 overflow-hidden">
            <img 
              src={shop.banner_url} 
              alt={`${shop.shop_name} banner`} 
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Shop Header */}
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Store className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display capitalize">
                  {shop.shop_name.replace(/-/g, ' ')}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {shop.owner_type === 'vendor' ? 'Vendor Shop' : 'Promoter Showcase'}
                </p>
              </div>
            </div>
            {cartCount > 0 && (
              <Button variant="outline" size="sm" onClick={() => navigate('/cart')} className="relative">
                <ShoppingCart className="w-4 h-4 mr-1" />
                Cart
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                  {cartCount}
                </Badge>
              </Button>
            )}
          </div>

          {/* Products Grid */}
          {products.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No products to display yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map(product => {
                const discount = getDiscountPercent(product.price, product.mrp);
                const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0 && !product.is_digital;

                return (
                  <Card 
                    key={product.id} 
                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <div className="aspect-square overflow-hidden bg-muted relative">
                      {product.image_urls?.[0] ? (
                        <img 
                          src={product.image_urls[0]} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                      {discount > 0 && (
                        <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground text-xs">
                          {discount}% OFF
                        </Badge>
                      )}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <span className="text-sm font-semibold text-muted-foreground">Out of Stock</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <p className="font-medium text-sm line-clamp-2">{product.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-primary">₹{product.price.toLocaleString()}</span>
                        {product.mrp && product.mrp > product.price && (
                          <span className="text-xs text-muted-foreground line-through">₹{product.mrp.toLocaleString()}</span>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">{product.category}</Badge>
                      
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          disabled={outOfStock}
                          onClick={(e) => handleAddToCart(e, product)}
                        >
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Cart
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs h-8"
                          disabled={outOfStock}
                          onClick={(e) => handleBuyNow(e, product)}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Buy Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {user && (
        <PhoneNumberDialog
          open={showPhoneDialog}
          onOpenChange={setShowPhoneDialog}
          userId={user.id}
          onPhoneConfirmed={handlePhoneConfirmed}
          existingPhone={userPhone || undefined}
        />
      )}
    </Layout>
  );
}
