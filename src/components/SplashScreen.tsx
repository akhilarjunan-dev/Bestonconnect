import { useEffect, useState } from 'react';
import splashLogo from '@/assets/splash-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 300); // Wait for fade out
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Centered container for logo and loader */}
      <div className="flex flex-col items-center justify-center">
        {/* Logo with scale animation and pulsing glow */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl animate-[pulse-glow_2s_ease-in-out_infinite]" />
          <img 
            src={splashLogo} 
            alt="Bestonconnect" 
            className="relative w-48 max-w-[60vw] object-contain animate-[scale-in_0.6s_ease-out]"
          />
        </div>
        
        {/* Orange connect loader - centered below logo */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="w-3 h-3 rounded-full bg-orange-500 animate-[smooth-bounce_1.2s_ease-in-out_infinite]" />
          <div className="w-16 h-1 bg-orange-500/30 overflow-hidden rounded-full">
            <div className="h-full w-full bg-orange-500 animate-[loader-slide_1s_ease-in-out_infinite]" />
          </div>
          <div className="w-3 h-3 rounded-full bg-orange-500 animate-[smooth-bounce_1.2s_ease-in-out_infinite_0.3s]" />
        </div>
      </div>

      <style>{`
        @keyframes loader-slide {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
        }
        @keyframes smooth-bounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-8px); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
