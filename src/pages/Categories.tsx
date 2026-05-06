import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Grid3X3 } from 'lucide-react';
import { CategoryGridSkeleton } from '@/components/skeletons/ProductCardSkeleton';
import { FadeIn } from '@/components/skeletons/FadeIn';

interface Category {
  id: string;
  name: string;
  description: string | null;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      .order('name');

    if (!error && data) {
      setCategories(data);
    }
    setLoading(false);
  };

  // Category icons/colors mapping
  const getCategoryStyle = (name: string) => {
    const styles: Record<string, { bg: string; icon: string }> = {
      'Electronics': { bg: 'bg-blue-500/10', icon: '📱' },
      'Fashion': { bg: 'bg-pink-500/10', icon: '👗' },
      'Health & Beauty': { bg: 'bg-green-500/10', icon: '💆' },
      'Home & Living': { bg: 'bg-amber-500/10', icon: '🏠' },
      'Sports & Outdoors': { bg: 'bg-orange-500/10', icon: '⚽' },
      'Books & Media': { bg: 'bg-purple-500/10', icon: '📚' },
      'Food & Beverages': { bg: 'bg-red-500/10', icon: '🍔' },
      'Digital Products': { bg: 'bg-cyan-500/10', icon: '💻' },
      'Services': { bg: 'bg-indigo-500/10', icon: '🛠️' },
      'Other': { bg: 'bg-gray-500/10', icon: '📦' },
    };
    return styles[name] || { bg: 'bg-primary/10', icon: '📦' };
  };

  return (
    <Layout>
      <div className="container py-8 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold font-display flex items-center justify-center gap-2">
            <Grid3X3 className="h-8 w-8 text-primary" />
            Shop by Category
          </h1>
          <p className="text-muted-foreground">Browse products by category</p>
        </div>

        {loading ? (
          <CategoryGridSkeleton count={8} />
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No categories available.</p>
            </CardContent>
          </Card>
        ) : (
          <FadeIn>
            {/* Mobile: Horizontal scroll with peek effect (4 full + 1 partial) */}
            <div className="flex md:hidden overflow-x-auto gap-3 pb-4 snap-x snap-mandatory -mx-4 px-4 scrollbar-hide">
              {categories.map((category) => {
                const style = getCategoryStyle(category.name);
                return (
                  <Link 
                    key={category.id} 
                    to={`/shop?category=${encodeURIComponent(category.name)}`}
                    className="flex-shrink-0 w-[calc(23.5%-9px)] snap-start"
                  >
                    <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer h-full">
                      <CardContent className="py-5 px-2 text-center">
                        <div className={`w-14 h-14 rounded-full ${style.bg} flex items-center justify-center mx-auto mb-2.5 text-2xl`}>
                          {style.icon}
                        </div>
                        <h3 className="font-semibold text-xs leading-tight line-clamp-2">{category.name}</h3>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Desktop: Grid layout */}
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories.map((category) => {
                const style = getCategoryStyle(category.name);
                return (
                  <Link 
                    key={category.id} 
                    to={`/shop?category=${encodeURIComponent(category.name)}`}
                  >
                    <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                      <CardContent className="py-6 text-center">
                        <div className={`w-16 h-16 rounded-full ${style.bg} flex items-center justify-center mx-auto mb-3 text-3xl`}>
                          {style.icon}
                        </div>
                        <h3 className="font-semibold">{category.name}</h3>
                        {category.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {category.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </FadeIn>
        )}
      </div>
    </Layout>
  );
}
