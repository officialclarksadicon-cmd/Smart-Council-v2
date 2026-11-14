import { CSSProperties, Fragment } from 'react';
import { motion, Variants } from 'motion/react';

type TextTag = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';

interface WordRevealTextProps {
  text: string;
  as?: TextTag;
  className?: string;
  style?: CSSProperties;
  id?: string;
  delay?: number;
  y?: number;
  duration?: number;
  stagger?: number;
  highlightWords?: string[];
  highlightClassName?: string;
}

const MOTION_TAGS = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
  div: motion.div,
} as const;

/**
 * 120Hz GPU-composited per-word upward fade reveal.
 * Re-triggers smoothly as sections scroll up or down into the viewport.
 */
export function WordRevealText({
  text,
  as = 'p',
  className = '',
  style,
  id,
  delay = 0,
  y = 32,
  duration = 0.85,
  stagger,
  highlightWords = [],
  highlightClassName = 'text-[#facc15]',
}: WordRevealTextProps) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const MotionTag = MOTION_TAGS[as];
  const normalizedHighlights = new Set(
    highlightWords.map((w) => w.trim().toLowerCase())
  );

  const computedStagger =
    stagger ??
    (words.length <= 8 ? 0.1 : words.length <= 18 ? 0.07 : 0.045);

  const containerVariant: Variants = {
    hidden: {},
    visible: {
      transition: {
        delayChildren: delay,
        staggerChildren: computedStagger,
      },
    },
  };

  const wordVariant: Variants = {
    hidden: {
      opacity: 0,
      y,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  return (
    <MotionTag
      id={id}
      style={style}
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2, margin: '-48px 0px -8% 0px' }}
      variants={containerVariant}
    >
      {words.map((word, idx) => {
        const cleanWord = word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
        const isHighlighted =
          normalizedHighlights.has(word.toLowerCase()) ||
          normalizedHighlights.has(cleanWord);

        return (
          <Fragment key={`${idx}-${word}`}>
            <span className="inline-block overflow-hidden align-bottom pb-[0.14em] -mb-[0.14em]">
              <motion.span
                variants={wordVariant}
                className={`inline-block will-change-transform ${
                  isHighlighted ? highlightClassName : ''
                }`}
              >
                {word}
              </motion.span>
            </span>
            {idx < words.length - 1 ? ' ' : ''}
          </Fragment>
        );
      })}
    </MotionTag>
  );
}
