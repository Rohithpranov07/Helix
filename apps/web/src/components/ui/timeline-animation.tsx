"use client";

import { motion, useInView, Variants } from "motion/react";
import React, { ElementType } from "react";

export interface TimelineContentProps {
  as?: ElementType;
  animationNum?: number;
  timelineRef?: React.RefObject<HTMLElement | null>;
  className?: string;
  customVariants?: (i: number) => any;
  children?: React.ReactNode;
  [key: string]: any;
}

const defaultVariants = {
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      delay: i * 0.15,
      duration: 0.6,
      ease: [0.25, 0.4, 0.25, 1],
    },
  }),
  hidden: {
    filter: "blur(10px)",
    y: 20,
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
    const internalRef = React.useRef<HTMLElement>(null);
    const viewRef = timelineRef || internalRef;
    
    // We only trigger once when the referenced container comes into view
    const isInView = useInView(viewRef as any, { once: true, margin: "-10% 0px" });

    const MotionComponent = React.useMemo(() => motion.create(Component as any), [Component]);
    const variants = customVariants ? {
      visible: customVariants.visible,
      hidden: customVariants.hidden || defaultVariants.hidden,
    } : defaultVariants;

    return (
      <MotionComponent
        ref={(node: any) => {
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<any>).current = node;
          if (!timelineRef) (internalRef as any).current = node;
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
