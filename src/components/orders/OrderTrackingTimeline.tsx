import { Package, Truck, CheckCircle, Box } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderTrackingTimelineProps {
  status: string;
  createdAt: string;
  shippedAt?: string | null;
  completedAt?: string | null;
}

const steps = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'processing', label: 'Processing', icon: Box },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'completed', label: 'Completed', icon: CheckCircle },
];

export function OrderTrackingTimeline({ status, createdAt, shippedAt, completedAt }: OrderTrackingTimelineProps) {
  const getStepStatus = (stepKey: string) => {
    const statusOrder = ['pending', 'processing', 'shipped', 'completed'];
    const currentIndex = statusOrder.indexOf(status === 'delivered' ? 'completed' : status);
    const stepIndex = statusOrder.indexOf(stepKey);
    
    if (status === 'cancelled') {
      return stepIndex === 0 ? 'completed' : 'cancelled';
    }
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const getStepDate = (stepKey: string) => {
    switch (stepKey) {
      case 'pending':
        return createdAt ? new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
      case 'shipped':
        return shippedAt ? new Date(shippedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
      case 'completed':
        return completedAt ? new Date(completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null;
      default:
        return null;
    }
  };

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
          <Package className="h-3 w-3" />
        </div>
        <span>Order Cancelled</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const stepStatus = getStepStatus(step.key);
        const Icon = step.icon;
        const isLast = index === steps.length - 1;
        const date = getStepDate(step.key);
        
        return (
          <div key={step.key} className="flex items-start gap-3">
            {/* Icon and line */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                  stepStatus === 'completed' && 'bg-primary border-primary text-primary-foreground',
                  stepStatus === 'current' && 'bg-primary/20 border-primary text-primary',
                  stepStatus === 'upcoming' && 'bg-muted border-muted-foreground/30 text-muted-foreground',
                  stepStatus === 'cancelled' && 'bg-muted border-muted-foreground/20 text-muted-foreground/50'
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'w-0.5 h-6 transition-colors',
                    stepStatus === 'completed' ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                />
              )}
            </div>
            
            {/* Label */}
            <div className="pt-1">
              <p
                className={cn(
                  'text-sm font-medium',
                  stepStatus === 'completed' && 'text-foreground',
                  stepStatus === 'current' && 'text-primary',
                  stepStatus === 'upcoming' && 'text-muted-foreground',
                  stepStatus === 'cancelled' && 'text-muted-foreground/50'
                )}
              >
                {step.label}
              </p>
              {date && (
                <p className="text-xs text-muted-foreground">{date}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
