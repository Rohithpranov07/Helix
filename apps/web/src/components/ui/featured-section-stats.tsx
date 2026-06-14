"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface FeaturedStat {
  value: string;
  label: string;
}

export interface FeaturedChartData {
  name: string;
  value: number;
}

interface FeaturedSectionStatsProps {
  title?: string;
  subtitle?: string;
  stats?: FeaturedStat[];
  chartData?: FeaturedChartData[];
}

export function FeaturedSectionStats({
  title = "Powering teams with real-time insights.",
  subtitle = "Our next-gen analytics dashboard helps you track performance, manage clients, and make data-driven decisions in seconds.",
  stats = [
    { value: "50,000+", label: "Projects Managed" },
    { value: "99.9%", label: "Uptime Guarantee" },
    { value: "1,200+", label: "Enterprise Clients" },
    { value: "1.2s", label: "Avg. Response Time" },
  ],
  chartData = [
    { name: "Jan", value: 20 },
    { name: "Feb", value: 40 },
    { name: "Mar", value: 60 },
    { name: "Apr", value: 80 },
    { name: "May", value: 100 },
    { name: "Jun", value: 130 },
    { name: "Jul", value: 160 },
  ],
}: FeaturedSectionStatsProps) {
  return (
    <section 
      data-magnetic
      className="w-full max-w-7xl mx-auto text-left p-8 sm:p-12 relative z-20 bg-slate-900/40 rounded-3xl border border-white/10 hover:border-white/30 transition-all duration-500 hover:scale-[1.01] shadow-[0_0_20px_rgba(255,255,255,0.02)] hover:shadow-[0_0_35px_rgba(255,255,255,0.08)] backdrop-blur-xl group mt-12"
    >
      <div className="relative z-10">
        <h3 className="text-lg sm:text-xl lg:text-3xl font-medium text-white mb-12 max-w-4xl leading-tight">
          {title}{" "}
          <span className="text-gray-400 text-sm sm:text-base lg:text-3xl font-normal">
            {subtitle}
          </span>
        </h3>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mt-8 border-t border-white/10 pt-10">
          {stats.map((stat, idx) => (
            <div key={idx} className="transition-transform duration-500 group-hover:-translate-y-1">
              <p className="text-4xl lg:text-5xl font-medium text-white tracking-tight">{stat.value}</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-2 uppercase tracking-widest font-semibold">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Area Chart */}
      <div className="w-full h-64 mt-12 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Tooltip 
              contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '8px', color: '#fff' }}
              itemStyle={{ color: '#60a5fa' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorBlue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Background Gradient Effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-3xl pointer-events-none" />
    </section>
  );
}
