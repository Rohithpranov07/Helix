"use client"

import { motion } from "motion/react"
import { Card, CardContent } from "@/components/ui/card"
import { Shield, Radio, ShieldCheck, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

// Neo-Brutalism palette — matches the Activity Stream page chrome exactly.
const NEO = { yellow: "#ffe600", blue: "#2f5ef5", pink: "#ff3ea5", green: "#3ddc84", ink: "#0a0a0a" }

const ORGAN_TAGS = [
    { label: "Security", color: NEO.pink },
    { label: "Incidents", color: NEO.yellow },
    { label: "Genome", color: NEO.blue },
    { label: "Metabolism", color: NEO.green },
]

function RevealCard({
    gridClassName,
    cardClassName,
    delay = 0,
    children,
}: {
    /** Grid placement only (col-span/row-span) — must live on the motion.div since it's the direct grid child. */
    gridClassName: string
    /** Visual box classes (overflow-hidden, flex) — must live on the actual Card so clipping/centering apply to what's visible. */
    cardClassName?: string
    delay?: number
    children: React.ReactNode
}) {
    return (
        <motion.div
            className={gridClassName}
            initial={{ opacity: 0, y: 22, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
        >
            <Card className={cn("neo-card neo-lift h-full", cardClassName)}>{children}</Card>
        </motion.div>
    )
}

export function Features() {
    return (
        <section className="py-16 md:py-24" style={{ background: "#f1e6cf" }}>
            <div className="mx-auto max-w-3xl lg:max-w-5xl px-6">
                {/* Eyebrow — live pulse, mirrors the page header's energy */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="mb-8 flex items-center justify-center gap-2.5"
                >
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: NEO.green }} />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: NEO.green, border: `1.5px solid ${NEO.ink}` }} />
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.3em]" style={{ color: NEO.ink }}>
                        Why This Page Never Sleeps
                    </span>
                </motion.div>

                <div className="relative">
                    <div className="relative z-10 grid grid-cols-6 gap-3">
                        <RevealCard gridClassName="col-span-full lg:col-span-2" cardClassName="flex overflow-hidden" delay={0}>
                            <CardContent className="relative m-auto size-fit pt-6">
                                <div className="relative flex h-24 w-56 items-center">
                                    <svg
                                        className="absolute inset-0 size-full animate-[spin_50s_linear_infinite]"
                                        viewBox="0 0 254 104"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                        style={{ color: `${NEO.blue}22`, transformOrigin: "50% 50%" }}
                                    >
                                        <path
                                            d="M112.891 97.7022C140.366 97.0802 171.004 94.6715 201.087 87.5116C210.43 85.2881 219.615 82.6412 228.284 78.2473C232.198 76.3179 235.905 73.9942 239.348 71.3124C241.85 69.2557 243.954 66.7571 245.555 63.9408C249.34 57.3235 248.281 50.5341 242.498 45.6109C239.033 42.7237 235.228 40.2703 231.169 38.3054C219.443 32.7209 207.141 28.4382 194.482 25.534C184.013 23.1927 173.358 21.7755 162.64 21.2989C161.376 21.3512 160.113 21.181 158.908 20.796C158.034 20.399 156.857 19.1682 156.962 18.4535C157.115 17.8927 157.381 17.3689 157.743 16.9139C158.104 16.4588 158.555 16.0821 159.067 15.8066C160.14 15.4683 161.274 15.3733 162.389 15.5286C179.805 15.3566 196.626 18.8373 212.998 24.462C220.978 27.2494 228.798 30.4747 236.423 34.1232C240.476 36.1159 244.202 38.7131 247.474 41.8258C254.342 48.2578 255.745 56.9397 251.841 65.4892C249.793 69.8582 246.736 73.6777 242.921 76.6327C236.224 82.0192 228.522 85.4602 220.502 88.2924C205.017 93.7847 188.964 96.9081 172.738 99.2109C153.442 101.949 133.993 103.478 114.506 103.79C91.1468 104.161 67.9334 102.97 45.1169 97.5831C36.0094 95.5616 27.2626 92.1655 19.1771 87.5116C13.839 84.5746 9.1557 80.5802 5.41318 75.7725C-0.54238 67.7259 -1.13794 59.1763 3.25594 50.2827C5.82447 45.3918 9.29572 41.0315 13.4863 37.4319C24.2989 27.5721 37.0438 20.9681 50.5431 15.7272C68.1451 8.8849 86.4883 5.1395 105.175 2.83669C129.045 0.0992292 153.151 0.134761 177.013 2.94256C197.672 5.23215 218.04 9.01724 237.588 16.3889C240.089 17.3418 242.498 18.5197 244.933 19.6446C246.627 20.4387 247.725 21.6695 246.997 23.615C246.455 25.1105 244.814 25.5605 242.63 24.5811C230.322 18.9961 217.233 16.1904 204.117 13.4376C188.761 10.3438 173.2 8.36665 157.558 7.52174C129.914 5.70776 102.154 8.06792 75.2124 14.5228C60.6177 17.8788 46.5758 23.2977 33.5102 30.6161C26.6595 34.3329 20.4123 39.0673 14.9818 44.658C12.9433 46.8071 11.1336 49.1622 9.58207 51.6855C4.87056 59.5336 5.61172 67.2494 11.9246 73.7608C15.2064 77.0494 18.8775 79.925 22.8564 82.3236C31.6176 87.7101 41.3848 90.5291 51.3902 92.5804C70.6068 96.5773 90.0219 97.7419 112.891 97.7022Z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                    <span className="mx-auto block w-fit text-5xl font-black tabular-nums" style={{ color: NEO.ink }}>&lt;1s</span>
                                </div>
                                <h2 className="mt-6 text-center text-2xl font-extrabold uppercase tracking-wide" style={{ color: NEO.ink }}>Real-Time Delivery</h2>
                            </CardContent>
                        </RevealCard>

                        <RevealCard gridClassName="col-span-full sm:col-span-3 lg:col-span-2" cardClassName="overflow-hidden" delay={0.06}>
                            <CardContent className="pt-6">
                                <div
                                    className="relative mx-auto flex aspect-square size-32 items-center justify-center rounded-full"
                                    style={{ border: `3px solid ${NEO.ink}`, background: NEO.pink, boxShadow: `4px 4px 0px ${NEO.ink}` }}
                                >
                                    <Shield className="size-12" strokeWidth={1.75} style={{ color: NEO.ink }} />
                                </div>
                                <div className="relative z-10 mt-6 space-y-2 text-center">
                                    <h2 className="text-lg font-extrabold uppercase tracking-wide" style={{ color: NEO.ink }}>Every Vuln Logged</h2>
                                    <p className="text-sm font-bold" style={{ color: `${NEO.ink}99` }}>
                                        vuln_detected, vuln_healed, and incident events are captured the instant they fire — nothing slips through unrecorded.
                                    </p>
                                </div>
                            </CardContent>
                        </RevealCard>

                        <RevealCard gridClassName="col-span-full sm:col-span-3 lg:col-span-2" cardClassName="overflow-hidden" delay={0.12}>
                            <CardContent className="pt-6">
                                <div
                                    className="relative mx-auto flex aspect-square size-32 items-center justify-center rounded-full"
                                    style={{ border: `3px solid ${NEO.ink}`, background: NEO.blue, boxShadow: `4px 4px 0px ${NEO.ink}` }}
                                >
                                    <Radio className="size-12" strokeWidth={1.75} style={{ color: "#fff" }} />
                                </div>
                                <div className="relative z-10 mt-6 space-y-2 text-center">
                                    <h2 className="text-lg font-extrabold uppercase tracking-wide" style={{ color: NEO.ink }}>Zero-Lag Ingestion</h2>
                                    <p className="text-sm font-bold" style={{ color: `${NEO.ink}99` }}>
                                        Events stream over a single persistent SSE connection — no polling, no batching delay, no refresh button.
                                    </p>
                                </div>
                            </CardContent>
                        </RevealCard>

                        <RevealCard gridClassName="col-span-full lg:col-span-3" cardClassName="overflow-hidden" delay={0.18}>
                            <CardContent className="grid pt-6 sm:grid-cols-2">
                                <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6">
                                    <div className="relative flex aspect-square size-12 items-center justify-center rounded-full" style={{ border: `3px solid ${NEO.ink}`, background: NEO.green, boxShadow: `3px 3px 0px ${NEO.ink}` }}>
                                        <ShieldCheck className="size-5" strokeWidth={1.75} style={{ color: NEO.ink }} />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-lg font-extrabold uppercase tracking-wide" style={{ color: NEO.ink }}>Full Audit Trail</h2>
                                        <p className="text-sm font-bold" style={{ color: `${NEO.ink}99` }}>
                                            Every reflex arc is appended to an immutable trail — security, incidents, genome drift, and entropy, all on one timeline.
                                        </p>
                                    </div>
                                </div>
                                <div className="relative mt-6 rounded-md sm:-my-6 sm:-mr-6 sm:ml-6" style={{ background: NEO.ink }}>
                                    <div className="flex h-full flex-col justify-center gap-3 p-6 font-mono text-[11px] font-bold" style={{ color: "#fff" }}>
                                        <div>14:02:11 <span style={{ color: NEO.pink }}>VULN</span> SQLi detected /api/search</div>
                                        <div>14:02:14 <span style={{ color: NEO.green }}>HEALED</span> patch verified in shadow</div>
                                        <div>14:02:15 <span style={{ color: NEO.blue }}>ANTIBODY</span> ab-48 minted</div>
                                        <div>14:03:02 <span style={{ color: NEO.yellow }}>INCIDENT</span> deploy rollback resolved</div>
                                    </div>
                                </div>
                            </CardContent>
                        </RevealCard>

                        <RevealCard gridClassName="col-span-full lg:col-span-3" cardClassName="overflow-hidden" delay={0.24}>
                            <CardContent className="grid h-full pt-6 sm:grid-cols-2">
                                <div className="relative z-10 flex flex-col justify-between space-y-12 lg:space-y-6">
                                    <div className="relative flex aspect-square size-12 items-center justify-center rounded-full" style={{ border: `3px solid ${NEO.ink}`, background: NEO.yellow, boxShadow: `3px 3px 0px ${NEO.ink}` }}>
                                        <Layers className="size-6" strokeWidth={1.75} style={{ color: NEO.ink }} />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-lg font-extrabold uppercase tracking-wide" style={{ color: NEO.ink }}>Every Organ Reporting In</h2>
                                        <p className="text-sm font-bold" style={{ color: `${NEO.ink}99` }}>
                                            One stream, every organ — filter down to exactly the signal you need without losing the rest.
                                        </p>
                                    </div>
                                </div>
                                <div className="relative mt-6 sm:-my-6 sm:-mr-6" style={{ borderLeft: `2px solid ${NEO.ink}22` }}>
                                    <div className="flex h-full flex-col items-start justify-center gap-3 p-6">
                                        {ORGAN_TAGS.map((tag, i) => (
                                            <motion.span
                                                key={tag.label}
                                                initial={{ opacity: 0, x: -12 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                viewport={{ once: true }}
                                                transition={{ delay: 0.3 + i * 0.07, duration: 0.35 }}
                                                whileHover={{ x: 3 }}
                                                className="inline-flex items-center gap-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide"
                                                style={{ border: `2px solid ${NEO.ink}`, background: "#fff", color: NEO.ink }}
                                            >
                                                <span style={{ width: 8, height: 8, background: tag.color, border: `1.5px solid ${NEO.ink}`, flexShrink: 0 }} />
                                                {tag.label}
                                            </motion.span>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </RevealCard>
                    </div>
                </div>
            </div>
        </section>
    )
}
