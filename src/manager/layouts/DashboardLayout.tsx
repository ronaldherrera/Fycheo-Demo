import { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { cn } from '../lib/utils';
import { Menu } from 'lucide-react';

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background-dark flex text-white font-sans selection:bg-primary/30">
        
       {/* Sidebar Desktop */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full z-40 bg-surface-dark border-b border-white/5 px-4 h-16 flex items-center justify-between">
            <Link to="/manager" className="flex items-center gap-2">
                <img src="https://fycheo.es/brand/logotipo_mngr_bg-dark.svg" alt="Fycheo" className="h-8 object-contain" />
            </Link>
            <button onClick={() => setIsMobileOpen(true)} className="text-white p-2">
                <Menu />
            </button>
      </div>

      {/* Mobile Sidebar Overlay */}
        {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-[100] flex">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
            <div className="relative w-64 bg-surface-dark h-full shadow-2xl flex flex-col">
                {/* Reutilizamos el Sidebar en modo mobile */}
                <Sidebar isMobile={true} setIsOpen={setIsMobileOpen} />
            </div>
        </div>
        )}

      <div className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 min-w-0",
          isSidebarOpen ? "md:ml-64" : "md:ml-20"
      )}>
        {/* Eliminamos el Header antiguo, ya que el diseño Web no lo tiene separado del sidebar/contenido */}
         
        <main className="flex-1 p-4 md:p-8 pt-20 md:pt-8 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
