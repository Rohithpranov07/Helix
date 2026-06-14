export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex items-center gap-3 text-slate-400">
        <div className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-blue-400 animate-spin" />
        <span className="text-sm font-medium tracking-widest uppercase">Loading</span>
      </div>
    </div>
  );
}
