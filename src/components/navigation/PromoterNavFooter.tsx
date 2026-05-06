import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Package, Coins, User, LinkIcon } from 'lucide-react';
import logoImage from '@/assets/logo.png';
import { cn } from '@/lib/utils';

export function PromoterNavFooter() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-4 mb-4">
        <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-xl border border-border/50 px-2 py-2">
          <div className="flex items-center justify-around">
            {/* Dashboard */}
            <Link
              to="/promoter/dashboard"
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all",
                location.pathname === '/promoter/dashboard' 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className={cn("w-5 h-5", location.pathname === '/promoter/dashboard' && "text-primary")} />
              <span className="text-[10px] font-medium">Dashboard</span>
            </Link>

            {/* Products */}
            <Link
              to="/promoter/products"
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all",
                location.pathname === '/promoter/products' 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Package className={cn("w-5 h-5", location.pathname === '/promoter/products' && "text-primary")} />
              <span className="text-[10px] font-medium">Products</span>
            </Link>

            {/* Logo - Center */}
            <Link to="/promoter/dashboard" className="relative -mt-8 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full gradient-hero shadow-glow flex items-center justify-center ring-4 ring-background">
                <img src={logoImage} alt="Bestonconnect" className="w-9 h-9 rounded-full" />
              </div>
            </Link>

            {/* Links */}
            <Link
              to="/promoter/links"
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all",
                location.pathname === '/promoter/links' 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LinkIcon className={cn("w-5 h-5", location.pathname === '/promoter/links' && "text-primary")} />
              <span className="text-[10px] font-medium">Links</span>
            </Link>

            {/* Earnings */}
            <Link
              to="/promoter/earnings"
              className={cn(
                "flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all",
                location.pathname === '/promoter/earnings' 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Coins className={cn("w-5 h-5", location.pathname === '/promoter/earnings' && "text-primary")} />
              <span className="text-[10px] font-medium">Earnings</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
