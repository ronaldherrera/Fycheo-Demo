import { useEffect, useState } from 'react';
import { Plus, Search, Filter, MoreVertical } from 'lucide-react';
import { employeeService } from '../services/employeeService';
import type { Employee, EmployeeRole } from '../types';
import { CustomSelect } from '../components/ui/CustomSelect';
import { ImportEmployeesModal } from '../components/ImportEmployeesModal';
import { FileUp } from 'lucide-react';

const roleLabels: Record<EmployeeRole, { label: string; class: string }> = {
  admin: { label: 'Gestor de Cuenta', class: 'bg-purple-100 text-purple-700 border-purple-200' }, // Web
  hr: { label: 'Recursos Humanos', class: 'bg-pink-100 text-pink-700 border-pink-200' },          // Mismos permisos manager pero sin admin
  manager: { label: 'Manager Equipo', class: 'bg-blue-100 text-blue-700 border-blue-200' },       // Organiza equipo
  employee: { label: 'Empleado', class: 'bg-slate-100 text-slate-600 border-slate-200' },         // App
};

const inlineRoleLabels: Record<string, string> = {
  admin: 'Gestor',
  hr: 'RRHH',
  manager: 'Manager',
  employee: 'Base',
};

const Employees = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const companyId = localStorage.getItem('active_company_id');
      
      if (!companyId) {
          // Si no hay empresa, no deberíamos estar aquí
          return;
      }

      const [empData, invData] = await Promise.all([
        employeeService.getEmployees(companyId),
        employeeService.getInvitations(companyId).catch((e) => {
          console.warn("Tabla invitations no disponible o error:", e);
          return [];
        })
      ]);

      const allData = [...(empData || []), ...(invData || [])];

      const mappedData = allData.map(emp => ({
          ...emp,
          name: emp.full_name || emp.name || (emp.email ? emp.email.split('@')[0] : 'Sin correo')
      }));
      setEmployees(mappedData);
    } catch (err) {
      console.error(err);
      setError('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (employeeId: string, newRole: EmployeeRole) => {
    const companyId = localStorage.getItem('active_company_id');
    if (!companyId) return;

    try {
        setUpdatingId(employeeId);
        await employeeService.updateEmployee(employeeId, companyId, { role: newRole });
        
        // Actualizar estado local
        setEmployees(prev => prev.map(emp => 
            emp.id === employeeId ? { ...emp, role: newRole } : emp
        ));
    } catch (err) {
        console.error("Error updating role", err);
        alert("Error al actualizar el rol");
    } finally {
        setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header de la sección */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Empleados</h1>
          <p className="text-slate-400 text-sm">Gestiona el equipo y sus roles</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 bg-slate-800 text-slate-200 px-4 py-2 rounded-xl hover:bg-slate-700 transition-colors shadow-sm border border-white/5"
          >
            <FileUp size={20} />
            <span className="hidden sm:inline">Importar CSV</span>
          </button>
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20">
            <Plus size={20} />
            <span>Nuevo Empleado</span>
          </button>
        </div>
      </div>

      {/* Barra de herramientas */}
      <div className="flex items-center gap-4 bg-surface-dark p-2 rounded-xl border border-white/5 shadow-sm overflow-x-auto">
        <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
                type="text" 
                placeholder="Buscar por nombre o cargo..." 
                className="w-full pl-10 pr-4 py-2 bg-transparent border-none rounded-lg text-sm focus:ring-0 text-white placeholder:text-slate-600"
            />
        </div>
        <div className="h-6 w-px bg-white/10 mx-2"></div>
        <button className="flex items-center gap-2 text-slate-400 hover:text-white px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium">
            <Filter size={18} />
            <span>Filtros</span>
        </button>
      </div>

      {/* Lista / Tabla */}
      <div className="bg-surface-dark rounded-2xl shadow-sm border border-white/5 overflow-hidden">
        {error && (
            <div className="p-4 bg-red-500/10 text-red-400 text-sm text-center border-b border-red-500/20">
                {error}
            </div>
        )}
        {loading ? (
            <div className="p-8 text-center text-slate-500">Cargando equipo...</div>
        ) : (
            <>
              {/* Vista de Escritorio */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5 text-xs uppercase tracking-wider text-slate-400 font-semibold">
                            <th className="px-6 py-4">Empleado</th>
                            <th className="px-6 py-4">Rol</th>
                            <th className="px-6 py-4">Departamento</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {employees.map((employee) => (
                            <tr key={employee.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-slate-400 font-bold text-sm border border-white/10 overflow-hidden">
                                            {employee.avatar ? (
                                                <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                                            ) : (
                                                (employee.name || employee.email).charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-200 text-sm">{employee.name || 'Sin nombre'}</p>
                                            <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                                                <span>{employee.email}</span>
                                                <span className="text-slate-600">•</span>
                                                <span>{employee.phone || 'Sin teléfono'}</span>
                                                <span className="text-slate-600">•</span>
                                                <span>{inlineRoleLabels[employee.role] || employee.role}</span>
                                            </p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <CustomSelect
                                        value={employee.role}
                                        onChange={(val) => handleRoleChange(employee.id, val as EmployeeRole)}
                                        disabled={updatingId === employee.id}
                                        variant="table"
                                        className={roleLabels[employee.role]?.class || roleLabels.employee.class}
                                        dropdownClassName="w-40 bg-slate-900 border-white/10"
                                        options={Object.entries(roleLabels).map(([key, config]) => ({
                                            value: key,
                                            label: config.label
                                        }))}
                                    />
                                </td>
                                <td className="px-6 py-4">
                                    <span className="text-sm text-slate-400">{employee.dept || '-'}</span>
                                </td>
                                 <td className="px-6 py-4 text-center">
                                     {employee.accepted === false ? (
                                         <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
                                             <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                             Invitado
                                         </div>
                                     ) : (
                                         <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                             Activo
                                         </div>
                                     )}
                                 </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100">
                                        <MoreVertical size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>

              {/* Vista Móvil */}
              <div className="md:hidden divide-y divide-white/5">
                {employees.map((employee) => (
                  <div key={employee.id} className="p-4 space-y-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-slate-400 font-bold text-sm border border-white/10 overflow-hidden">
                          {employee.avatar ? (
                            <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                          ) : (
                            (employee.name || employee.email).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200 text-sm">{employee.name || 'Sin nombre'}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>{employee.email}</span>
                            <span className="text-slate-600">•</span>
                            <span>{employee.phone || 'Sin teléfono'}</span>
                            <span className="text-slate-600">•</span>
                            <span>{inlineRoleLabels[employee.role] || employee.role}</span>
                          </p>
                        </div>
                      </div>
                      <button className="p-2 text-slate-400 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-all">
                        <MoreVertical size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-500">Rol</span>
                        <CustomSelect
                          value={employee.role}
                          onChange={(val) => handleRoleChange(employee.id, val as EmployeeRole)}
                          disabled={updatingId === employee.id}
                          variant="table"
                          className={roleLabels[employee.role]?.class || roleLabels.employee.class}
                          dropdownClassName="w-40 bg-slate-900 border-white/10"
                          options={Object.entries(roleLabels).map(([key, config]) => ({
                            value: key,
                            label: config.label
                          }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-right">
                        <span className="text-xs text-slate-500">Departamento</span>
                        <span className="text-sm text-slate-400">{employee.dept || '-'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-xs text-slate-500">Estado</span>
                      {employee.accepted === false ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold border border-amber-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                          Invitado
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          Activo
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
        )}
      </div>

      {showImportModal && (
        <ImportEmployeesModal 
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            loadEmployees();
          }}
        />
      )}
    </div>
  );
};

export default Employees;
