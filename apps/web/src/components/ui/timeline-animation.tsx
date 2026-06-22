"use client";

import { motion, useInView, Variants } from "motion/react";
import React, { ElementType } from "react";

export interface TimelineContentProps {
  as?: ElementType;
  animationNum?: number;
  timelineRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  customVariants?: {
    visible: (i: number) => Record<string, unknown>;
    hidden: Record<string, unknown>;
  };
  children?: React.ReactNode;
  // Intentional `any`: this is a polymorphic component (`as` can render any tag),
  // so it must accept arbitrary passthrough attributes (href, target, aria-*, ...).
  // A `Record<string, unknown>` intersection here triggers a TS 5.9 inference bug
  // that collapses every destructured binding below to `{}` — verified by testing
  // in isolation. `any` is the deliberate, narrower-than-the-alternative choice.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

const defaultVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
  hidden: {
    y: 16,
    opacity: 0,
  },
};

export const TimelineContent = React.forwardRef<HTMLElement, TimelineContentProps>(
  (
    {
      as: Component = "div",
      animationNum = 0,
      timelineRef,
      className,
      customVariants,
      children,
      ...props
    },
    ref
  ) => {
    // If timelineRef is not provided, use our own ref for scroll detection
    const internalRef = React.useRef<HTMLElement | null>(null);
    const viewRef: React.RefObject<HTMLElement | null> = timelineRef ?? internalRef;

    // We only trigger once when the referenced container comes into view
    const isInView = useInView(viewRef, { once: true, margin: "-10% 0px" });

    const MotionComponent = React.useMemo(() => motion.create(Component as ElementType), [Component]);
    const variants = customVariants ? {
      visible: customVariants.visible,
      hidden: customVariants.hidden || defaultVariants.hidden,
    } : defaultVariants;

    return (
      <MotionComponent
        ref={(node: HTMLElement | null) => {
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
          if (!timelineRef) internalRef.current = node;
        }}
        custom={animationNum}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        variants={variants as Variants}
        className={className}
        {...props}
      >
        {children}
      </MotionComponent>
    );
  }
);
TimelineContent.displayName = "TimelineContent";
