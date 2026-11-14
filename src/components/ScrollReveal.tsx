import { ReactNode } from 'react';
import { motion } from 'motion/react';

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}

/**
 * Lightweight 120Hz GPU-composited scroll reveal.
 * Animates strictly transform (translateY) and opacity once on entry.
 */
export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  y = 18,
}: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, margin: '0px 0px -5% 0px' }}
      transition={{
        duration: 0.36,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`will-change-transform ${className}`}
    >
      {children}
    </motion.div>
  );
}
