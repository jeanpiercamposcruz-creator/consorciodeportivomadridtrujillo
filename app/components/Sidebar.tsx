export default function Sidebar() {
  const menuItems = [
    { name: "Dashboard", active: true },
    { name: "Gestión de Canchas", active: false },
    { name: "Reservas / Alquileres", active: false },
    { name: "Clientes", active: false },
    { name: "Finanzas y Caja", active: false },
  ];

  return (
    <aside className="w-64 bg-slate-800/80 border-r border-slate-700 min-h-[calc(100vh-65px)] p-4 flex flex-col">
      <nav className="space-y-1">
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              item.active
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
            }`}
          >
            {item.name}
          </button>
        ))}
      </nav>
    </aside>
  );
}