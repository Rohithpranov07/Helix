"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

function Feature() {
  const [inset, setInset] = useState<number>(50);
  const [onMouseDown, setOnMouseDown] = useState<boolean>(false);
  // Cache rect on drag-start — avoids getBoundingClientRect() on every mousemove.
  // Must be measured from the comparison frame, not from whatever element the
  // pointer event originated on (the small grip handle), or the drag math
  // scales against a 24x48px rect instead of the full frame.
  const rectRef = useRef<DOMRect | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const onDragStart = () => {
    setOnMouseDown(true);
    rectRef.current = frameRef.current?.getBoundingClientRect() ?? null;
  };

  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!onMouseDown || !rectRef.current) return;
    const rect = rectRef.current;
    let x = 0;
    if ("touches" in e && e.touches.length > 0) {
      x = (e.touches[0]?.clientX ?? 0) - rect.left;
    } else if ("clientX" in e) {
      x = e.clientX - rect.left;
    }
    const percentage = (x / rect.width) * 100;
    setInset(Math.max(0, Math.min(100, percentage)));
  };

  const onDragEnd = () => {
    setOnMouseDown(false);
    rectRef.current = null;
  };

  return (
    <div className="w-full py-12 lg:py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <motion.div
          className="flex flex-col gap-4"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <Badge className="bg-[#18181b] text-white border-[#18181b] hover:bg-[#18181b]/90">Autonomous Healing</Badge>
          </div>
          <div className="flex gap-2 flex-col">
            <h2 className="text-3xl md:text-5xl tracking-tighter lg:max-w-xl font-bold text-[#18181b]">
              Vulnerable to Patched in Seconds
            </h2>
            <p className="text-lg max-w-xl lg:max-w-xl leading-relaxed tracking-tight text-[#71717a]">
              Watch our Immune System autonomously detect critical vulnerabilities and generate precision code patches in real-time. Slide to compare the before and after states of the AST reconstruction.
            </p>
          </div>
          <motion.div
            className="pt-8 w-full max-w-5xl mx-auto"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              ref={frameRef}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="relative aspect-video w-full h-full overflow-hidden rounded-2xl select-none shadow-xl hover:shadow-2xl border-2 border-[#18181b]"
              onMouseMove={onMouseMove}
              onMouseUp={onDragEnd}
              onMouseLeave={onDragEnd}
              onTouchMove={onMouseMove}
              onTouchEnd={onDragEnd}
            >
              <div
                className="bg-[#18181b] h-full w-[2px] absolute z-20 top-0 -ml-px select-none"
                style={{
                  left: inset + "%",
                  boxShadow: "-10px 0 24px -6px rgba(239,68,68,0.45), 10px 0 24px -6px rgba(16,185,129,0.45)",
                }}
              >
                <button
                  className="bg-[#18181b] text-white rounded-full hover:scale-110 active:scale-95 transition-transform w-9 h-9 select-none -translate-y-1/2 absolute top-1/2 -ml-[18px] z-30 cursor-ew-resize flex justify-center items-center border-2 border-white"
                  style={{ boxShadow: "-3px 0 10px -1px rgba(239,68,68,0.6), 3px 0 10px -1px rgba(16,185,129,0.6)" }}
                  onTouchStart={(e) => {
                    onDragStart();
                    onMouseMove(e);
                  }}
                  onMouseDown={(e) => {
                    onDragStart();
                    onMouseMove(e);
                  }}
                  onTouchEnd={() => setOnMouseDown(false)}
                  onMouseUp={() => setOnMouseDown(false)}
                >
                  <GripVertical className="h-4 w-4 select-none" />
                </button>
              </div>
              
              {/* After (Patched Code) */}
              <div
                className="absolute left-0 top-0 z-10 w-full h-full bg-white rounded-2xl select-none border border-[#e5e5e0] p-8 md:p-12 flex flex-col justify-center"
                style={{ clipPath: "inset(0 0 0 " + inset + "%)" }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                  </div>
                  <div className="text-xs text-[#71717a] font-mono">auth.controller.ts</div>
                </div>

                <pre className="font-mono text-sm md:text-base leading-relaxed">
                  <span className="text-purple-700">export const</span> <span className="text-blue-700">loginUser</span> <span className="text-[#3f3f46]">=</span> <span className="text-purple-700">async</span> <span className="text-[#3f3f46]">(</span>req<span className="text-[#3f3f46]">,</span> res<span className="text-[#3f3f46]">)</span> <span className="text-purple-700">=&gt;</span> <span className="text-[#3f3f46]">{`{`}</span>{'\n'}
                  {'  '}<span className="text-purple-700">const</span> <span className="text-[#3f3f46]">{`{`} username, password {`}`} = req.body;</span>{'\n\n'}
                  {'  '}<span className="text-[#71717a] italic">{"// SECURE: Parameterized query prevents SQL Injection"}</span>{'\n'}
                  {'  '}<span className="text-purple-700">const</span> <span className="text-blue-700">query</span> <span className="text-[#3f3f46]">=</span> <span className="text-emerald-700">`SELECT * FROM users WHERE username = $1 AND password = $2`</span><span className="text-[#3f3f46]">;</span>{'\n'}
                  <div className="bg-emerald-50 border-l-2 border-emerald-500 py-1 -mx-4 px-4 my-1">
                    {'  '}<span className="text-purple-700">const</span> <span className="text-blue-700">result</span> <span className="text-[#3f3f46]">=</span> <span className="text-purple-700">await</span> <span className="text-[#3f3f46]">db.</span><span className="text-blue-800">query</span><span className="text-[#3f3f46]">(query, [username, password]);</span>
                  </div>
                  {'\n'}
                  {'  '}<span className="text-purple-700">if</span> <span className="text-[#3f3f46]">(result.rows.</span><span className="text-blue-800">length</span> <span className="text-[#3f3f46]">&gt;</span> <span className="text-orange-700">0</span><span className="text-[#3f3f46]">) {`{`}</span>{'\n'}
                  {'    '}<span className="text-[#3f3f46]">res.</span><span className="text-blue-800">status</span><span className="text-[#3f3f46]">(</span><span className="text-orange-700">200</span><span className="text-[#3f3f46]">).</span><span className="text-blue-800">json</span><span className="text-[#3f3f46]">({`{`}</span> <span className="text-blue-800">message</span><span className="text-[#3f3f46]">:</span> <span className="text-emerald-700">{"'Success'"}</span> <span className="text-[#3f3f46]">{`}`});</span>{'\n'}
                  {'  '}<span className="text-[#3f3f46]">{`}`}</span>{'\n'}
                  <span className="text-[#3f3f46]">{`}`};</span>
                </pre>
              </div>

              {/* Before (Vulnerable Code) */}
              <div className="absolute left-0 top-0 w-full h-full bg-[#f6f6f1] rounded-2xl select-none border border-[#e5e5e0] p-8 md:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                  </div>
                  <div className="text-xs text-[#71717a] font-mono">auth.controller.ts</div>
                </div>

                <pre className="font-mono text-sm md:text-base leading-relaxed">
                  <span className="text-purple-700">export const</span> <span className="text-blue-700">loginUser</span> <span className="text-[#3f3f46]">=</span> <span className="text-purple-700">async</span> <span className="text-[#3f3f46]">(</span>req<span className="text-[#3f3f46]">,</span> res<span className="text-[#3f3f46]">)</span> <span className="text-purple-700">=&gt;</span> <span className="text-[#3f3f46]">{`{`}</span>{'\n'}
                  {'  '}<span className="text-purple-700">const</span> <span className="text-[#3f3f46]">{`{`} username, password {`}`} = req.body;</span>{'\n\n'}
                  {'  '}<span className="text-red-600 italic">{"// CRITICAL VULNERABILITY: Raw query with unsanitized inputs"}</span>{'\n'}
                  <div className="bg-red-50 border-l-2 border-red-500 py-1 -mx-4 px-4 my-1">
                    {'  '}<span className="text-purple-700">const</span> <span className="text-blue-700">query</span> <span className="text-[#3f3f46]">=</span> <span className="text-emerald-700">{"`SELECT * FROM users WHERE username = '"}</span><span className="text-blue-600">{"${username}"}</span><span className="text-emerald-700">{"' AND password = '"}</span><span className="text-blue-600">{"${password}"}</span><span className="text-emerald-700">{"'`"}</span><span className="text-[#3f3f46]">;</span>{'\n'}
                    {'  '}<span className="text-purple-700">const</span> <span className="text-blue-700">result</span> <span className="text-[#3f3f46]">=</span> <span className="text-purple-700">await</span> <span className="text-[#3f3f46]">db.</span><span className="text-blue-800">query</span><span className="text-[#3f3f46]">(query);</span>
                  </div>
                  {'\n'}
                  {'  '}<span className="text-purple-700">if</span> <span className="text-[#3f3f46]">(result.rows.</span><span className="text-blue-800">length</span> <span className="text-[#3f3f46]">&gt;</span> <span className="text-orange-700">0</span><span className="text-[#3f3f46]">) {`{`}</span>{'\n'}
                  {'    '}<span className="text-[#3f3f46]">res.</span><span className="text-blue-800">status</span><span className="text-[#3f3f46]">(</span><span className="text-orange-700">200</span><span className="text-[#3f3f46]">).</span><span className="text-blue-800">json</span><span className="text-[#3f3f46]">({`{`}</span> <span className="text-blue-800">message</span><span className="text-[#3f3f46]">:</span> <span className="text-emerald-700">{"'Success'"}</span> <span className="text-[#3f3f46]">{`}`});</span>{'\n'}
                  {'  '}<span className="text-[#3f3f46]">{`}`}</span>{'\n'}
                  <span className="text-[#3f3f46]">{`}`};</span>
                </pre>
              </div>

              {/* Labels */}
              <div className="absolute top-6 left-6 z-10 bg-red-500 border-2 border-[#18181b] text-white text-xs font-bold px-4 py-2 rounded-full shadow-[3px_3px_0_#18181b] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                VULNERABLE
              </div>
              <div
                className="absolute top-6 right-6 z-20 bg-emerald-500 border-2 border-[#18181b] text-white text-xs font-bold px-4 py-2 rounded-full shadow-[-3px_3px_0_#18181b] flex items-center gap-2"
                style={{
                  opacity: inset > 80 ? 0 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                PATCHED
              </div>

            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export { Feature };
