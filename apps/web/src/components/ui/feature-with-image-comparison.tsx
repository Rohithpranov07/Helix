"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { GripVertical } from "lucide-react";

function Feature() {
  const [inset, setInset] = useState<number>(50);
  const [onMouseDown, setOnMouseDown] = useState<boolean>(false);

  const onMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!onMouseDown) return;

    const rect = e.currentTarget.getBoundingClientRect();
    let x = 0;

    if ("touches" in e && e.touches.length > 0) {
      x = (e.touches[0]?.clientX ?? 0) - rect.left;
    } else if ("clientX" in e) {
      x = e.clientX - rect.left;
    }
    
    const percentage = (x / rect.width) * 100;
    setInset(Math.max(0, Math.min(100, percentage)));
  };

  return (
    <div className="w-full py-12 lg:py-24">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex flex-col gap-4">
          <div>
            <Badge>Autonomous Healing</Badge>
          </div>
          <div className="flex gap-2 flex-col">
            <h2 className="text-3xl md:text-5xl tracking-tighter lg:max-w-xl font-bold text-white">
              Vulnerable to Patched in Seconds
            </h2>
            <p className="text-lg max-w-xl lg:max-w-xl leading-relaxed tracking-tight text-[#a1a1aa]">
              Watch our Immune System autonomously detect critical vulnerabilities and generate precision code patches in real-time. Slide to compare the before and after states of the AST reconstruction.
            </p>
          </div>
          <div className="pt-8 w-full max-w-5xl mx-auto">
            <div
              className="relative aspect-video w-full h-full overflow-hidden rounded-2xl select-none shadow-2xl border border-[#27272a]"
              onMouseMove={onMouseMove}
              onMouseUp={() => setOnMouseDown(false)}
              onMouseLeave={() => setOnMouseDown(false)}
              onTouchMove={onMouseMove}
              onTouchEnd={() => setOnMouseDown(false)}
            >
              <div
                className="bg-[#3b82f6] h-full w-1 absolute z-20 top-0 -ml-1 select-none"
                style={{
                  left: inset + "%",
                }}
              >
                <button
                  className="bg-[#3b82f6] text-white rounded hover:scale-110 transition-all w-6 h-12 select-none -translate-y-1/2 absolute top-1/2 -ml-[10px] z-30 cursor-ew-resize flex justify-center items-center shadow-lg"
                  onTouchStart={(e) => {
                    setOnMouseDown(true);
                    onMouseMove(e);
                  }}
                  onMouseDown={(e) => {
                    setOnMouseDown(true);
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
                className="absolute left-0 top-0 z-10 w-full h-full bg-[#0d1117] rounded-2xl select-none border border-[#27272a] p-8 md:p-12 flex flex-col justify-center"
                style={{ clipPath: "inset(0 0 0 " + inset + "%)" }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">auth.controller.ts</div>
                </div>
                
                <pre className="font-mono text-sm md:text-base leading-relaxed">
                  <span className="text-purple-400">export const</span> <span className="text-blue-400">loginUser</span> <span className="text-gray-300">=</span> <span className="text-purple-400">async</span> <span className="text-gray-300">(</span>req<span className="text-gray-300">,</span> res<span className="text-gray-300">)</span> <span className="text-purple-400">=&gt;</span> <span className="text-gray-300">{`{`}</span>{'\n'}
                  {'  '}<span className="text-purple-400">const</span> <span className="text-gray-300">{`{`} username, password {`}`} = req.body;</span>{'\n\n'}
                  {'  '}<span className="text-gray-500 italic">// SECURE: Parameterized query prevents SQL Injection</span>{'\n'}
                  {'  '}<span className="text-purple-400">const</span> <span className="text-blue-400">query</span> <span className="text-gray-300">=</span> <span className="text-green-300">`SELECT * FROM users WHERE username = $1 AND password = $2`</span><span className="text-gray-300">;</span>{'\n'}
                  <div className="bg-green-500/10 border-l-2 border-green-500 py-1 -mx-4 px-4 my-1">
                    {'  '}<span className="text-purple-400">const</span> <span className="text-blue-400">result</span> <span className="text-gray-300">=</span> <span className="text-purple-400">await</span> <span className="text-gray-300">db.</span><span className="text-blue-200">query</span><span className="text-gray-300">(query, [username, password]);</span>
                  </div>
                  {'\n'}
                  {'  '}<span className="text-purple-400">if</span> <span className="text-gray-300">(result.rows.</span><span className="text-blue-200">length</span> <span className="text-gray-300">&gt;</span> <span className="text-orange-400">0</span><span className="text-gray-300">) {`{`}</span>{'\n'}
                  {'    '}<span className="text-gray-300">res.</span><span className="text-blue-200">status</span><span className="text-gray-300">(</span><span className="text-orange-400">200</span><span className="text-gray-300">).</span><span className="text-blue-200">json</span><span className="text-gray-300">({`{`}</span> <span className="text-blue-200">message</span><span className="text-gray-300">:</span> <span className="text-green-300">'Success'</span> <span className="text-gray-300">{`}`});</span>{'\n'}
                  {'  '}<span className="text-gray-300">{`}`}</span>{'\n'}
                  <span className="text-gray-300">{`}`};</span>
                </pre>
              </div>
              
              {/* Before (Vulnerable Code) */}
              <div className="absolute left-0 top-0 w-full h-full bg-[#0a0a0a] rounded-2xl select-none border border-[#27272a] p-8 md:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">auth.controller.ts</div>
                </div>

                <pre className="font-mono text-sm md:text-base leading-relaxed">
                  <span className="text-purple-400">export const</span> <span className="text-blue-400">loginUser</span> <span className="text-gray-300">=</span> <span className="text-purple-400">async</span> <span className="text-gray-300">(</span>req<span className="text-gray-300">,</span> res<span className="text-gray-300">)</span> <span className="text-purple-400">=&gt;</span> <span className="text-gray-300">{`{`}</span>{'\n'}
                  {'  '}<span className="text-purple-400">const</span> <span className="text-gray-300">{`{`} username, password {`}`} = req.body;</span>{'\n\n'}
                  {'  '}<span className="text-red-400 italic">// CRITICAL VULNERABILITY: Raw query with unsanitized inputs</span>{'\n'}
                  <div className="bg-red-500/10 border-l-2 border-red-500 py-1 -mx-4 px-4 my-1">
                    {'  '}<span className="text-purple-400">const</span> <span className="text-blue-400">query</span> <span className="text-gray-300">=</span> <span className="text-green-300">`SELECT * FROM users WHERE username = '</span><span className="text-blue-300">{"${username}"}</span><span className="text-green-300">' AND password = '</span><span className="text-blue-300">{"${password}"}</span><span className="text-green-300">'`</span><span className="text-gray-300">;</span>{'\n'}
                    {'  '}<span className="text-purple-400">const</span> <span className="text-blue-400">result</span> <span className="text-gray-300">=</span> <span className="text-purple-400">await</span> <span className="text-gray-300">db.</span><span className="text-blue-200">query</span><span className="text-gray-300">(query);</span>
                  </div>
                  {'\n'}
                  {'  '}<span className="text-purple-400">if</span> <span className="text-gray-300">(result.rows.</span><span className="text-blue-200">length</span> <span className="text-gray-300">&gt;</span> <span className="text-orange-400">0</span><span className="text-gray-300">) {`{`}</span>{'\n'}
                  {'    '}<span className="text-gray-300">res.</span><span className="text-blue-200">status</span><span className="text-gray-300">(</span><span className="text-orange-400">200</span><span className="text-gray-300">).</span><span className="text-blue-200">json</span><span className="text-gray-300">({`{`}</span> <span className="text-blue-200">message</span><span className="text-gray-300">:</span> <span className="text-green-300">'Success'</span> <span className="text-gray-300">{`}`});</span>{'\n'}
                  {'  '}<span className="text-gray-300">{`}`}</span>{'\n'}
                  <span className="text-gray-300">{`}`};</span>
                </pre>
              </div>

              {/* Labels */}
              <div className="absolute top-6 left-6 z-10 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                VULNERABLE
              </div>
              <div 
                className="absolute top-6 right-6 z-20 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm"
                style={{
                  opacity: inset > 80 ? 0 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                PATCHED
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Feature };
