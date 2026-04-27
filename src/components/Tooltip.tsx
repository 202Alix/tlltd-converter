import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  text: string;
  size?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ text, size = 16 }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', cursor: 'help', flexShrink: 0 }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <HelpCircle size={size} style={{ color: '#a6a6a6' }} />
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#2b2b2b',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            marginBottom: '6px',
            zIndex: 1000,
            pointerEvents: 'none',
            maxWidth: '240px',
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
};
