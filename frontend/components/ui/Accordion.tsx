'use client';
import { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionProps {
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
  actions?: ReactNode;
}

export function Accordion({ title, summary, children, defaultOpen = false, className = '', style, actions }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  // If style prop is provided (especially borderLeft), don't use default border class
  const hasCustomBorder = style && (style.borderLeft || style.border);
  const borderClass = hasCustomBorder ? '' : 'border';

  return (
    <div className={`rounded-lg ${borderClass} bg-white ${className}`} style={style}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          {title}
          {!isOpen && summary && (
            <div className="mt-1 text-sm text-zinc-600">
              {summary}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          <ChevronDown
            className={`h-5 w-5 transition-transform ${
              isOpen ? 'transform rotate-180' : ''
            }`}
            style={style?.borderLeft ? { color: '#92071280' } : { color: '#71717a' }}
          />
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t" style={style?.borderLeft ? { borderTopColor: '#92071280' } : { borderTopColor: '#e4e4e7' }}>
          {children}
        </div>
      )}
    </div>
  );
}

