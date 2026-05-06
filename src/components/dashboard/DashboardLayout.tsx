import { ReactNode, useState } from 'react';
import { Header, Footer } from '@/components/layout/Layout';
import { DashboardSidebar, NavItem } from './DashboardSidebar';
import { DashboardBreadcrumb } from './DashboardBreadcrumb';
import { LucideIcon } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  title: string;
  titleIcon: LucideIcon;
  subtitle?: string;
  breadcrumbBase?: { label: string; href: string };
  favoritesKey?: string;
}

export function DashboardLayout({
  children,
  navItems,
  activeTab,
  onTabChange,
  title,
  titleIcon,
  subtitle,
  breadcrumbBase,
  favoritesKey
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  const activeNavItem = navItems.find(item => item.id === activeTab);
  
  const breadcrumbItems = breadcrumbBase 
    ? [
        breadcrumbBase,
        { label: activeNavItem?.label || activeTab }
      ]
    : [
        { label: title },
        { label: activeNavItem?.label || activeTab }
      ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 flex flex-col lg:flex-row">
        <DashboardSidebar
          items={navItems}
          activeTab={activeTab}
          onTabChange={onTabChange}
          title={title}
          titleIcon={titleIcon}
          subtitle={subtitle}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          favoritesKey={favoritesKey}
        />
        
        <main className="flex-1 overflow-auto">
          <div className="container py-6 px-4 lg:py-8">
            <DashboardBreadcrumb items={breadcrumbItems} />
            {children}
          </div>
        </main>
      </div>
      
      <Footer />
    </div>
  );
}
