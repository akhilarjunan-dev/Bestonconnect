import { Link, useLocation } from 'react-router-dom';
import { BarChart3, Users, CheckCircle, DollarSign, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ManagerNavFooter() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-4 mb-4">
        <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-xl border border-border/50 px-2 py-2">
          <div className="flex items-center justify-around">
            {/* Overview */}
            <Link
              to="/manager/dashboard"
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
                location.pathname === '/manager/dashboard' 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <BarChart3 className={cn("w-5 h-5", location.pathname === '/manager/dashboard' && "text-primary")} />
              <span className="text-xs font-medium">Overview</span>
            </Link>

            {/* Promoters */}
            <Link
              to="/manager/dashboard?tab=leaderboard"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-muted-foreground hover:text-foreground"
            >
              <Users className="w-5 h-5" />
              <span className="text-xs font-medium">Promoters</span>
            </Link>

            {/* Logo - Center */}
            <Link to="/manager/dashboard" className="relative -mt-8 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full gradient-hero shadow-glow flex items-center justify-center ring-4 ring-background">
                <CheckCircle className="w-8 h-8 text-primary-foreground" />
              </div>
            </Link>

            {/* Finance */}
            <Link
              to="/manager/dashboard?tab=finance"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-muted-foreground hover:text-foreground"
            >
              <DollarSign className="w-5 h-5" />
              <span className="text-xs font-medium">Finance</span>
            </Link>

            {/* Settings */}
            <Link
              to="/admin/dashboard"
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs font-medium">Admin</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
