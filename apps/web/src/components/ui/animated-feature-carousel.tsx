"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react"
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  type MotionStyle,
  type MotionValue,
  type Variants,
} from "framer-motion"
import { cn } from "@/lib/utils"

// --- Helper Functions and Fallbacks ---

// Placeholder for image assets if they are not found.
const placeholderImage = (text = "Image") =>
  `https://placehold.co/600x400/1a1a1a/ffffff?text=${text}`

// --- Types ---
type StaticImageData = string

type WrapperStyle = MotionStyle & {
  "--x": MotionValue<string>
  "--y": MotionValue<string>
}

interface CardProps {
  bgClass?: string
}

interface ImageSet {
  step1img1: StaticImageData
  step1img2: StaticImageData
  step2img1: StaticImageData
  step2img2: StaticImageData
  step3img: StaticImageData
  step4img: StaticImageData
  alt: string
}

interface FeatureCarouselProps extends CardProps {
  step1img1Class?: string
  step1img2Class?: string
  step2img1Class?: string
  step2img2Class?: string
  step3imgClass?: string
  step4imgClass?: string
  image: ImageSet
}

interface StepImageProps {
  src: StaticImageData
  alt: string
  className?: string
  style?: React.CSSProperties
  width?: number
  height?: number
}

interface Step {
  id: string
  name: string
  title: string
  description: string
}

// --- Constants ---
const TOTAL_STEPS = 4

const steps: readonly Step[] = [
  {
    id: "1",
    name: "Detect",
    title: "Production Failure Spotted",
    description: "Railway deployment logs and runtime errors are watched continuously. The moment a failure signature appears, the Resurrection Reflex wakes up.",
  },
  {
    id: "2",
    name: "Diagnose",
    title: "Causal Chain Reconstructed",
    description: "Sarvam reconstructs the causal chain from logs, the failing deploy, and the intent genome — pinpointing the exact commit and code path responsible.",
  },
  {
    id: "3",
    name: "Validate",
    title: "Proven in a Shadow Twin",
    description: "The candidate patch never touches production. It's replayed against a disposable shadow clone until the proof returns a clean verdict: promote.",
  },
  {
    id: "4",
    name: "Heal",
    title: "PR Shipped, Antibody Minted",
    description: "Once promoted, HELIX opens a pull request with the fix and mints a permanent antibody — so this exact failure can never take the system down again.",
  },
]

const ANIMATION_PRESETS = {
  fadeInScale: {
    initial: { opacity: 0, scale: 0.95, x: 0 },
    animate: { opacity: 1, scale: 1, x: 0 },
    exit: { opacity: 0, scale: 0.95, x: 0 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
} as const

type AnimationPreset = keyof typeof ANIMATION_PRESETS

interface AnimatedStepImageProps extends StepImageProps {
  preset?: AnimationPreset
  delay?: number
  onAnimationComplete?: () => void
}

// --- Hooks ---
function useNumberCycler(totalSteps: number = TOTAL_STEPS, interval: number = 5000) {
  const [currentNumber, setCurrentNumber] = useState(0)

  // This effect handles the automatic cycling.
  // It depends on `currentNumber`, so every time the step changes,
  // it will clear the old timer and set a new one for the next step.
  useEffect(() => {
    const timerId = setTimeout(() => {
      setCurrentNumber((prev) => (prev + 1) % totalSteps)
    }, interval)

    // Cleanup function to clear the timer if the component unmounts
    // or if the dependencies of the effect change (e.g., user clicks a step).
    return () => clearTimeout(timerId)
  }, [currentNumber, totalSteps, interval])

  // This function allows manual setting of the step.
  // When called, it updates `currentNumber`, which will trigger the useEffect
  // to reset the timer for the next cycle.
  const setStep = useCallback((stepIndex: number) => {
    setCurrentNumber(stepIndex % totalSteps)
  }, [totalSteps])

  return { currentNumber, setStep }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches)
    }
    checkDevice()
    window.addEventListener("resize", checkDevice)
    return () => window.removeEventListener("resize", checkDevice)
  }, [])
  return isMobile
}

// --- Components ---
function IconCheck({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={cn("h-4 w-4", className)} {...props} >
      <path d="m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z" />
    </svg>
  )
}

const stepVariants: Variants = {
  inactive: { scale: 0.9, opacity: 0.7 },
  active: { scale: 1, opacity: 1 },
}

const StepImage = forwardRef<HTMLImageElement, StepImageProps>(
  ({ src, alt, className, style, ...props }, ref) => {
    return (
      <img
        ref={ref}
        alt={alt}
        className={className}
        src={src}
        style={{ userSelect: "none", ...style }}
        onError={(e) => (e.currentTarget.src = placeholderImage(alt))}
        {...props}
      />
    )
  }
)
StepImage.displayName = "StepImage"

const MotionStepImage = motion(StepImage)

const AnimatedStepImage = ({ preset = "fadeInScale", delay = 0, ...props }: AnimatedStepImageProps) => {
  const presetConfig = ANIMATION_PRESETS[preset]
  // framer-motion's MotionStyle (x/y as MotionValue) and this component's plain
  // `style?: CSSProperties` don't reconcile under exactOptionalPropertyTypes —
  // a known framer-motion/TS friction point, isolated here with one assertion.
  const motionProps = {
    ...props,
    ...presetConfig,
    transition: { ...presetConfig.transition, delay },
  } as React.ComponentProps<typeof MotionStepImage>
  return <MotionStepImage {...motionProps} />
}

// `step` always comes from useNumberCycler, which keeps it in [0, steps.length) via modulo —
// the fallback to steps[0] only satisfies noUncheckedIndexedAccess, it's never actually hit.
function getStep(step: number): Step {
  return steps[step] ?? steps[0]!
}

function FeatureCard({ children, step }: { children: React.ReactNode; step: number }) {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const isMobile = useIsMobile()
  const current = getStep(step)
  // Cache the card's bounds on enter so mousemove never reads layout (avoids
  // getBoundingClientRect → transform-write thrash on every pointer move).
  const rectRef = useRef<DOMRect | null>(null)
  function handleMouseEnter({ currentTarget }: MouseEvent) {
    rectRef.current = currentTarget.getBoundingClientRect()
  }
  function handleMouseMove({ clientX, clientY }: MouseEvent) {
    if (isMobile) return
    const rect = rectRef.current
    if (!rect) return
    mouseX.set(clientX - rect.left)
    mouseY.set(clientY - rect.top)
  }
  return (
    <motion.div
      className="animated-cards group relative w-full rounded-2xl"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      style={{ "--x": useMotionTemplate`${mouseX}px`, "--y": useMotionTemplate`${mouseY}px` } as WrapperStyle}
    >
      <motion.div layout className="relative w-full overflow-hidden rounded-3xl border-[3px] border-[#0a0a0a] bg-white" transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
        <div className="flex flex-col gap-8 p-8 md:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="flex w-full flex-col gap-3 md:max-w-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="text-sm font-extrabold uppercase tracking-widest text-[#d97706]"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05, duration: 0.3, ease: [0.22, 1, 0.36, 1]}}
              >
                  {current.name}
              </motion.div>
              <motion.h2
                className="text-2xl font-bold tracking-tight text-[#0a0a0a] md:text-3xl"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1, duration: 0.3, ease: [0.22, 1, 0.36, 1]}}
              >
                {current.title}
              </motion.h2>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.3, ease: [0.22, 1, 0.36, 1]}}
              >
                <p className="text-base leading-relaxed text-neutral-700">
                  {current.description}
                </p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

function StepsNav({ steps: stepItems, current, onChange }: { steps: readonly Step[]; current: number; onChange: (index: number) => void; }) {
    return (
        <nav aria-label="Progress" className="flex justify-center px-4">
            <ol className="flex w-full flex-wrap items-center justify-center gap-2" role="list">
                {stepItems.map((step, stepIdx) => {
                    const isCompleted = current > stepIdx;
                    const isCurrent = current === stepIdx;
                    return (
                        <motion.li key={step.name} initial="inactive" animate={isCurrent ? "active" : "inactive"} variants={stepVariants} transition={{ duration: 0.3 }} className="relative" >
                            <button
                                type="button"
                                className={cn(
                                    "group flex items-center gap-2.5 rounded-full border-2 border-[#0a0a0a] px-3.5 py-1.5 text-sm font-bold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500",
                                    isCurrent
                                        ? "bg-[#0a0a0a] text-white"
                                        : "bg-white text-[#0a0a0a] hover:bg-amber-50"
                                )}
                                onClick={() => onChange(stepIdx)}
                            >
                                <span className={cn(
                                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#0a0a0a] transition-all duration-300",
                                    isCompleted
                                        ? "bg-[#3ddc84] text-[#0a0a0a]"
                                        : isCurrent
                                            ? "bg-[#d97706] text-white"
                                            : "bg-white text-[#0a0a0a]"
                                )}>
                                    {isCompleted ? (
                                        <IconCheck className="h-3.5 w-3.5" />
                                    ) : (
                                        <span>{stepIdx + 1}</span>
                                    )}
                                </span>
                                <span className="hidden sm:inline-block">{step.name}</span>
                            </button>
                        </motion.li>
                    );
                })}
            </ol>
        </nav>
    );
}

const defaultClasses = {
  img: "w-full h-full rounded-xl border-2 border-[#0a0a0a] object-cover shadow-[6px_6px_0px_#0a0a0a]",
  step1img1: "aspect-[4/3]",
  step1img2: "aspect-[4/3]",
  step2img1: "aspect-[4/3]",
  step2img2: "aspect-[4/3]",
  step3img: "aspect-[16/9]",
  step4img: "aspect-[16/9]",
} as const

export function FeatureCarousel({
  image,
  step1img1Class = defaultClasses.step1img1,
  step1img2Class = defaultClasses.step1img2,
  step2img1Class = defaultClasses.step2img1,
  step2img2Class = defaultClasses.step2img2,
  step3imgClass = defaultClasses.step3img,
  step4imgClass = defaultClasses.step4img,
  ...props
}: FeatureCarouselProps) {
  const { currentNumber: step, setStep } = useNumberCycler()
  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="grid w-full grid-cols-2 gap-5">
            <AnimatedStepImage alt={image.alt} className={cn(defaultClasses.img, step1img1Class)} src={image.step1img1} preset="slideInLeft" />
            <AnimatedStepImage alt={image.alt} className={cn(defaultClasses.img, step1img2Class)} src={image.step1img2} preset="slideInRight" delay={0.1} />
          </div>
        )
      case 1:
        return (
          <div className="grid w-full grid-cols-2 gap-5">
            <AnimatedStepImage alt={image.alt} className={cn(defaultClasses.img, step2img1Class)} src={image.step2img1} preset="fadeInScale" />
            <AnimatedStepImage alt={image.alt} className={cn(defaultClasses.img, step2img2Class)} src={image.step2img2} preset="fadeInScale" delay={0.1} />
          </div>
        )
      case 2:
        return <AnimatedStepImage alt={image.alt} className={cn(defaultClasses.img, step3imgClass)} src={image.step3img} preset="fadeInScale" />
      case 3:
        return <AnimatedStepImage alt={image.alt} className={cn(defaultClasses.img, step4imgClass)} src={image.step4img} preset="fadeInScale" />
      default: return null
    }
  }
  return (
    <div className="flex flex-col gap-12 w-full max-w-4xl mx-auto p-4">
        <FeatureCard {...props} step={step}>
            <AnimatePresence mode="wait">
                <motion.div key={step} {...ANIMATION_PRESETS.fadeInScale} className="w-full">
                    {renderStepContent()}
                </motion.div>
            </AnimatePresence>
        </FeatureCard>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <StepsNav current={step} onChange={setStep} steps={steps} />
        </motion.div>
    </div>
  )
}
