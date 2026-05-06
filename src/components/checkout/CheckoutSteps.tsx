import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CheckoutStep = 'cart' | 'address' | 'payment';

interface CheckoutStepsProps {
  currentStep: CheckoutStep;
  hasPhysicalProducts: boolean;
}

export function CheckoutSteps({ currentStep, hasPhysicalProducts }: CheckoutStepsProps) {
  const steps = hasPhysicalProducts 
    ? [
        { id: 'cart', label: 'Cart' },
        { id: 'address', label: 'Address' },
        { id: 'payment', label: 'Payment' }
      ]
    : [
        { id: 'cart', label: 'Cart' },
        { id: 'payment', label: 'Payment' }
      ];

  const currentIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="flex items-center justify-center mb-6">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div 
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  isCompleted && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={cn(
                "text-xs mt-1 font-medium",
                (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div 
                className={cn(
                  "w-12 sm:w-20 h-0.5 mx-2",
                  index < currentIndex ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
