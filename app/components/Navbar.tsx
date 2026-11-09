export default function Navbar() {
  return (
    <header className="w-full bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
        <span className="font-bold text-lg text-white tracking-wide">
          Consorcio Deportivo Madrid Trujillo
        </span>
      </div>
      <div className="text-xs bg-slate-700 text-slate-300 px-3 py-1 rounded-full font-mono">
        Sistema ERP v1.0
      </div>
    </header>
  );
}