import * as React from "react";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string; // Para el botón principal
  dropdownClassName?: string; // Para el panel flotante
  icon?: React.ReactNode; // Icono izquierdo opcional del botón
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'filter' | 'table';
  searchable?: boolean;
  usePortal?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  disabled = false,
  className,
  dropdownClassName,
  icon,
  size = 'md',
  variant = 'default',
  searchable = false,
  usePortal = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [openUpward, setOpenUpward] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      if (searchable) {
        setSearchTerm("");
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, searchable]);

  useLayoutEffect(() => {
    if (isOpen && usePortal && containerRef.current) {
      const updatePosition = () => {
        const rect = containerRef.current!.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const maxH = 280;
        const flip = spaceBelow < maxH && spaceAbove > spaceBelow;
        setOpenUpward(flip);
        setDropdownStyle(flip
          ? { position: 'fixed', bottom: window.innerHeight - rect.top, left: rect.left, width: rect.width, zIndex: 99999 }
          : { position: 'fixed', top: rect.bottom, left: rect.left, width: rect.width, zIndex: 99999 }
        );
      };
      
      updatePosition();
      
      const handleScroll = (e: Event) => {
        if (!(e.target instanceof Node)) return;
        const insideTrigger = containerRef.current?.contains(e.target);
        const insideDropdown = dropdownRef.current?.contains(e.target);
        if (!insideTrigger && !insideDropdown) setIsOpen(false);
      };
      
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }
  }, [isOpen, usePortal]);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  // Estilos según tamaño
  const sizeStyles = {
    sm: "px-2 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-4 py-2.5 text-sm rounded-xl gap-2",
    lg: "px-5 py-3.5 text-base rounded-2xl gap-2",
  };

  // Estilos según variante
  const variantStyles = {
    default: "bg-black/50 border border-white/10 text-white hover:bg-black/70 focus:ring-2 focus:ring-primary/50",
    filter: "bg-surface-dark text-white border border-white/5 hover:border-white/10 focus:border-primary/50 focus:ring-1 focus:ring-primary/50",
    table: "text-xs font-semibold rounded-md border focus:ring-2 focus:ring-primary/20",
  };

  return (
    <div ref={containerRef} className="relative inline-block w-full text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!isOpen && usePortal && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropdownStyle({
              position: 'fixed',
              top: rect.bottom,
              left: rect.left,
              width: rect.width,
              zIndex: 99999,
            });
          }
          setIsOpen((prev) => !prev);
        }}
        className={cn(
          "flex items-center justify-between w-full font-medium transition-all outline-none duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          sizeStyles[size],
          variant === 'table' ? '' : variantStyles[variant],
          className
        )}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <ChevronDown
          size={size === 'sm' ? 14 : 16}
          className={cn(
            "text-slate-400 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {usePortal ? createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={dropdownStyle}
              className={cn(
                "bg-[#111622]/95 border border-white/10 rounded-xl shadow-2xl z-[99999] overflow-hidden max-h-60 overflow-y-auto backdrop-blur-md",
                openUpward ? "mb-2" : "mt-2",
                dropdownClassName
              )}
            >
              {/* Dropdown Content */}
              <div className="p-1 flex flex-col gap-1">
                {searchable && (
                  <div className="px-2 py-1.5 border-b border-white/5 mb-1 sticky top-0 bg-[#111622]/95 z-10">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar..."
                      className="w-full bg-black/20 text-white placeholder-slate-400 text-sm px-3 py-1.5 rounded-md border border-white/10 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                )}
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-slate-500">No hay resultados</div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between",
                          isSelected
                            ? "bg-white/5 text-white font-semibold"
                            : "text-slate-300 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                          <div className="min-w-0">
                            <span className="block truncate">{opt.label}</span>
                            {opt.sublabel && <span className="block text-xs text-slate-500 truncate">{opt.sublabel}</span>}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary ml-2 shrink-0 animate-pulse" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      ) : (
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "absolute left-0 mt-2 w-full bg-[#111622]/95 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto backdrop-blur-md",
                dropdownClassName
              )}
            >
              <div className="p-1 flex flex-col gap-1">
                {searchable && (
                  <div className="px-2 py-1.5 border-b border-white/5 mb-1 sticky top-0 bg-[#111622]/95 z-10">
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar..."
                      className="w-full bg-black/20 text-white placeholder-slate-400 text-sm px-3 py-1.5 rounded-md border border-white/10 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                )}
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-slate-500">No hay resultados</div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between",
                          isSelected
                            ? "bg-white/5 text-white font-semibold"
                            : "text-slate-300 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                          <div className="min-w-0">
                            <span className="block truncate">{opt.label}</span>
                            {opt.sublabel && <span className="block text-xs text-slate-500 truncate">{opt.sublabel}</span>}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary ml-2 shrink-0 animate-pulse" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
};
