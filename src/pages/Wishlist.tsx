import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWishlist } from '@/hooks/useWishlist';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Heart, Loader2, ShoppingCart, Trash2 } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  price: number;
  mrp: number | null;
  image_urls: string[] | null;
  category: string;
}

export default function Wishlist() {
  const { user, loading: authLoading } = useAuth();
  const { wishlist, removeFromWishlist, loading: wishlistLoading } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (wishlist.length > 0) {
      fetchProducts();
    } else if (!wishlistLoading) {
      setLoading(false);
    }
  }, [wishlist, wishlistLoading]);

  const fetchProducts = async () => {
    const productIds = wishlist.map(w => w.product_id);
    
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, mrp, image_urls, category')
      .in('id', productIds);

    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  };

  const handleRemove = async (productId: string) => {
    await removeFromWishlist(productId);
    setProducts(prev => prev.filter(p => p.id !== productId));
    toast.success('Removed from wishlist');
  };

  const handleAddToCart = (product: Product) => {
    const CART_STORAGE_KEY = 'bestonconnect_cart';
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    const items = saved ? JSON.parse(saved) : [];
    
    const existingIndex = items.findIndex((item: any) => item.productId === product.id);
    if (existingIndex > -1) {
      items[existingIndex].quantity += 1;
    } else {
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image_urls?.[0] || '',
        quantity: 1
      });
    }
    
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: items.length }));
    toast.success('Added to cart');
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary fill-primary" />
          My Wishlist
        </h1>

        {loading || wishlistLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Your wishlist is empty.</p>
              <Link to="/shop">
                <Button>Browse Products</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden group">
                <div className="relative aspect-square bg-muted">
                  {product.image_urls?.[0] ? (
                    <img 
                      src={product.image_urls[0]} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Heart className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemove(product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardContent className="p-3 space-y-2">
                  <Link to={`/product/${product.id}`}>
                    <h3 className="font-medium line-clamp-2 hover:text-primary text-sm">
                      {product.name}
                    </h3>
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">₹{product.price}</span>
                    {product.mrp && product.mrp > product.price && (
                      <span className="text-xs text-muted-foreground line-through">₹{product.mrp}</span>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full gap-1" 
                    onClick={() => handleAddToCart(product)}
                  >
                    <ShoppingCart className="h-3 w-3" />
                    Add to Cart
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
