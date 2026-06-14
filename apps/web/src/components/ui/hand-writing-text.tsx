"use client";

import { motion } from "framer-motion";

interface HandWrittenTitleProps {
    title?: string;
    subtitle?: string;
    color?: string;
}

function HandWrittenTitle({
    title = "Hand Written",
    subtitle = "Optional subtitle",
    color = "#3b82f6",
}: HandWrittenTitleProps) {
    const draw = {
        hidden: { pathLength: 0, opacity: 0 },
        visible: {
            pathLength: 1,
            opacity: 1,
            transition: {
                pathLength: { duration: 2.5, ease: [0.43, 0.13, 0.23, 0.96] as [number, number, number, number] },
                opacity: { duration: 0.5 },
            },
        },
    };

    return (
        <div className="relative w-full max-w-4xl mx-auto py-14 mb-8" style={{ minHeight: "200px" }}>
            <div className="absolute inset-0 pointer-events-none">
                <motion.svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 1200 600"
                    preserveAspectRatio="none"
                    initial="hidden"
                    animate="visible"
                    className="w-full h-full"
                >
                    <title>Circling Effect</title>
                    <motion.path
                        d="M 950 90
                           C 1250 300, 1050 480, 600 520
                           C 250 520, 150 480, 150 300
                           C 150 120, 350 80, 600 80
                           C 850 80, 950 180, 950 180"
                        fill="none"
                        strokeWidth="8"
                        stroke={color}
                        strokeOpacity={0.55}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        variants={draw}
                    />
                </motion.svg>
            </div>
            <div className="relative text-center z-10 flex flex-col items-center justify-center h-full">
                <motion.h1
                    className="text-3xl md:text-5xl tracking-tighter font-bold text-white flex items-center gap-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                >
                    {title}
                </motion.h1>
                {subtitle && (
                    <motion.p
                        className="text-base max-w-xl leading-relaxed tracking-tight text-[#a1a1aa] mt-3"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1, duration: 0.8 }}
                    >
                        {subtitle}
                    </motion.p>
                )}
            </div>
        </div>
    );
}

export { HandWrittenTitle }
