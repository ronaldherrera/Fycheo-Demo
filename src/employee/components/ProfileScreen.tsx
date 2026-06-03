
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationsContext';
import { AppContext } from '../EmployeeApp';
import { supabase } from '../services/supabase';
import { DEFAULT_AVATAR } from '../constants';
import { Logo } from './Logo';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const startOfYear = (d: Date) => {
  const date = new Date(d.getFullYear(), 0, 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

const minutesToLabel = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Configuración visual consistente con Dashboard
const CHART_COLORS = {
  working: "#3b82f6", // blue-500
  break: "#f59e0b",   // amber-500
  others: "#ec4899",  // pink-500
  free: "#cbd5e1",    // slate-300
};

const ProfileScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, setIsLoggedIn } = useContext(AppContext);
  const { unseenDocs, unseenSolicitudes } = useNotifications();
  const [showModal, setShowModal] = useState(false);
  const [entryType, setEntryType] = useState<'clock-in' | 'clock-out' | 'break-start' | 'break-end' | 'others-in' | 'others-out'>('clock-in');
  const [context, setContext] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Year Stats State
  const [yearStats, setYearStats] = useState<{ w: number; b: number; o: number }>({ w: 0, b: 0, o: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  // Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRange, setExportRange] = useState<'month' | 'last-month' | 'year' | 'custom'>('month');
  const [isExporting, setIsExporting] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [currentPasswordValid, setCurrentPasswordValid] = useState<boolean | null>(null);
  const [validatingCurrent, setValidatingCurrent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  // Password Requirements
  const passwordRequirements = [
    { id: 'length', text: 'Mín. 8 caracteres', valid: newPassword.length >= 8 },
    { id: 'number', text: 'Un número', valid: /\d/.test(newPassword) },
    { id: 'uppercase', text: 'Una mayúscula', valid: /[A-Z]/.test(newPassword) },
  ];

  // Debounced Current Password Validation
  useEffect(() => {
    const validateCurrentPassword = async () => {
        if (!currentPassword) {
            setCurrentPasswordValid(null);
            setValidatingCurrent(false);
            return;
        }

        setValidatingCurrent(true);
        // Delay to avoid spamming API
        const timer = setTimeout(async () => {
            try {
                const { error } = await supabase.auth.signInWithPassword({
                    email: user.email!,
                    password: currentPassword
                });
                setCurrentPasswordValid(!error);
            } catch (e) {
                setCurrentPasswordValid(false);
            } finally {
                setValidatingCurrent(false);
            }
        }, 800);

        return () => clearTimeout(timer);
    };

    validateCurrentPassword();
  }, [currentPassword, user.email]);

  // Animation State
  const [isExiting, setIsExiting] = useState(false);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => {
      navigate('/dashboard');
    }, 300); // Match animation duration (0.3s)
  };

  const handleUpdatePassword = async () => {
      if (!currentPassword || !newPassword || !confirmPassword) {
          setMessage({ type: 'error', text: 'Por favor, rellena todos los campos' });
          return;
      }
      
      // Verify requirements
      const isLengthValid = newPassword.length >= 8;
      const hasNumber = /\d/.test(newPassword);
      const hasUpper = /[A-Z]/.test(newPassword);

      if (!isLengthValid || !hasNumber || !hasUpper) {
          setMessage({ type: 'error', text: 'La contraseña no cumple los requisitos' });
          return;
      }

      if (newPassword !== confirmPassword) {
          setMessage({ type: 'error', text: 'Las contraseñas nuevas no coinciden' });
          return;
      }

      try {
          setPasswordLoading(true);

          // 1. Verify Current Password
          const { error: signInError } = await supabase.auth.signInWithPassword({
              email: user.email!,
              password: currentPassword
          });

          if (signInError) {
             throw new Error("La contraseña actual es incorrecta");
          }

          // 2. Update Password
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          
          if (error) throw error;
          
          setMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
          setShowPasswordModal(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
      } catch (error: any) {
          console.error("Error updating password:", error);
          setMessage({ type: 'error', text: error.message || 'Error al actualizar contraseña' });
      } finally {
          setPasswordLoading(false);
      }
  };

  const handleAcceptInviteProfile = async () => {
    if (!company) return;
    try {
      setLinkingCompany(true);
      const { error: memberError } = await supabase
        .from('company_members')
        .update({ accepted: true })
        .eq('user_id', user.id)
        .eq('company_id', company.id);

      if (memberError) throw memberError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          company_id: company.id,
          role: 'employee'
        })
        .eq('id', user.id);

      if (profileError) {
        console.error("Error updating profile with accepted company:", profileError);
      }

      setMessage({ type: 'success', text: `¡Te has unido a ${company.name}! 🎉` });
      setIsPendingInvite(false);
      await loadCompanyInfo();
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: e.message || 'Error al aceptar la invitación.' });
    } finally {
      setLinkingCompany(false);
    }
  };

  const handleRejectInviteProfile = async () => {
    if (!company) return;
    if (!window.confirm(`¿Estás seguro de que deseas rechazar la invitación de la empresa "${company.name}"?`)) {
      return;
    }

    try {
      setUnlinkingCompany(true);
      const { error: memberError } = await supabase
        .from('company_members')
        .delete()
        .eq('user_id', user.id)
        .eq('company_id', company.id);

      if (memberError) throw memberError;

      setMessage({ type: 'success', text: `Invitación rechazada.` });
      setCompany(null);
      setIsPendingInvite(false);
    } catch (e: any) {
      console.error(e);
      setMessage({ type: 'error', text: e.message || 'Error al rechazar la invitación.' });
    } finally {
      setUnlinkingCompany(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      setIsExporting(true);
      if (!user) return;

      const now = new Date();
      let start = new Date();
      let end = new Date();
      let filename = 'fichajes';

      if (exportRange === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        filename = `fichajes_${now.getFullYear()}_${now.getMonth() + 1}`;
      } else if (exportRange === 'last-month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        filename = `fichajes_${start.getFullYear()}_${start.getMonth() + 1}`;
      } else if (exportRange === 'year') {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        filename = `fichajes_${now.getFullYear()}_anual`;
      } else if (exportRange === 'custom') {
         if (!customStartDate || !customEndDate) {
            setMessage({ type: 'error', text: 'Debes seleccionar fechas de inicio y fin.' });
            setIsExporting(false);
            return;
         }
         const [y1, m1, d1] = customStartDate.split('-').map(Number);
         const [y2, m2, d2] = customEndDate.split('-').map(Number);
         
         start = new Date(y1, m1 - 1, d1, 0, 0, 0);
         end = new Date(y2, m2 -1, d2, 23, 59, 59);
         
         if (start > end) {
             setMessage({ type: 'error', text: 'La fecha de inicio no puede ser posterior a la de fin.' });
             setIsExporting(false);
             return;
         }
         filename = `fichajes_personalizado_${customStartDate}_${customEndDate}`;
      }

      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("occurred_at", start.toISOString())
        .lte("occurred_at", end.toISOString())
        .order("occurred_at", { ascending: true });

      if (error || !data || data.length === 0) {
        setMessage({ type: 'error', text: 'No hay datos para exportar en este periodo' });
        setIsExporting(false);
        return;
      }

      // Generate standardized filename
      const formatDateFile = (d: Date) => {
          const day = String(d.getDate()).padStart(2, '0');
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const year = d.getFullYear();
          return `${day}-${month}-${year}`;
      };
      
      let cleanName = 'Usuario';
      if (user.user_metadata?.full_name) {
          const parts = user.user_metadata.full_name.trim().split(/\s+/);
          if (parts.length >= 2) cleanName = `${parts[0]}_${parts[1]}`;
          else if (parts.length === 1) cleanName = parts[0];
      } else if (user.email) {
          cleanName = user.email.split('@')[0];
      }
      cleanName = cleanName.replace(/[^a-zA-Z0-9_\-\.]/g, '');
      
      const finalFilename = `Registros_${cleanName}_${formatDateFile(start)}_${formatDateFile(end)}`;

      if (format === 'csv') {
          // Generate CSV
          let csvContent = "Fecha,Hora,Descripcion,Metodo,Ubicacion\n";
          
          data.forEach((row) => {
              const d = row.occurred_at ? new Date(row.occurred_at) : new Date(row.created_at);
              const dateStr = d.toLocaleDateString('es-ES');
              const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
              
              let typeLabel = '';
              if (row.entry_type === 'clock-in') typeLabel = 'Entrada';
              else if (row.entry_type === 'clock-out') typeLabel = 'Salida';
              else if (row.entry_type === 'break-start') typeLabel = 'Inicio Descanso';
              else if (row.entry_type === 'break-end') typeLabel = 'Fin Descanso';
              else if (row.entry_type === 'others-out') typeLabel = 'Salida (Permiso)';
              else if (row.entry_type === 'others-in') typeLabel = 'Entrada (Permiso)';
              else typeLabel = 'Registro';
              
              let finalDesc = row.description || typeLabel;
              finalDesc = finalDesc.replace(/,/g, ' '); 

              const metodoStr = row.is_manual ? 'Manual' : 'Dispositivo';
              const ubicacionStr = (row.latitude != null && row.longitude != null)
                  ? `"${row.latitude}, ${row.longitude}"`
                  : 'No disponible';

              csvContent += `${dateStr},${timeStr},${finalDesc},${metodoStr},${ubicacionStr}\n`;
          });

          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          const url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", `${finalFilename}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

      } else {
          // Generate PDF
          const doc = new jsPDF();
          
          // Helper to load image
          const getImageData = (url: string) => {
              return new Promise<{ data: string; w: number; h: number }>((resolve, reject) => {
                  const img = new Image();
                  img.setAttribute('crossOrigin', 'anonymous');
                  img.onload = () => {
                      const canvas = document.createElement('canvas');
                      canvas.width = img.width;
                      canvas.height = img.height;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                          ctx.drawImage(img, 0, 0);
                          resolve({
                              data: canvas.toDataURL('image/png'),
                              w: img.width,
                              h: img.height
                          });
                      } else {
                          reject(new Error('Canvas context failed'));
                      }
                  };
                  img.onerror = reject;
                  img.src = url;
              });
          };

          try {
              // Try to load logo
              const logoUrl = new URL('../recursos/logo-mail.png', import.meta.url).href;
              const imgProps = await getImageData(logoUrl);
              
              // Scale logo preserving aspect ratio
              const logoHeight = 12; 
              const ratio = imgProps.w / imgProps.h;
              const logoWidth = logoHeight * ratio;
              
              doc.addImage(imgProps.data, 'PNG', 14, 12, logoWidth, logoHeight);
          } catch (e) {
              console.error("Logo load failed", e);
              doc.setFontSize(26);
              doc.setTextColor(19, 91, 236);
              doc.setFont("helvetica", "bold");
              doc.text("Fycheo", 14, 20);
          }

          // Report Title (Aligned with logo bottom or slightly below)
          doc.setFontSize(12);
          doc.setTextColor(100, 116, 139); // Slate 500
          doc.setFont("helvetica", "normal");
          doc.text("Informe de Registro Horario", 14, 30); // Pushed down slightly

          // Divider
          doc.setDrawColor(226, 232, 240); // Slate 200
          doc.setLineWidth(0.5);
          doc.line(14, 35, 196, 35); // Pushed down

          // User Info & Period
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59); // Slate 800
          doc.setFont("helvetica", "bold");
          doc.text("Empleado:", 14, 45);
          doc.text("Email:", 14, 51);
          doc.text("Periodo:", 120, 45);
          doc.text("Generado:", 120, 51);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105); // Slate 600
          const userNameLabel = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario';
          doc.text(userNameLabel, 35, 45);
          doc.text(user.email || '', 35, 51);
          
          const startDateStr = start.toLocaleDateString('es-ES');
          const endDateStr = end.toLocaleDateString('es-ES');
          doc.text(`${startDateStr} - ${endDateStr}`, 140, 45);
          doc.text(new Date().toLocaleString('es-ES'), 140, 51);


          // --- 2. Calculate Stats for Chart ---
          let w = 0, b = 0, o = 0;
          let lastState = 'out';
          let lastTime = 0;

          data.forEach((e) => {
             const eTime = e.occurred_at ? new Date(e.occurred_at).getTime() : new Date(e.created_at).getTime();
             if (lastTime > 0) {
                const diffMins = Math.floor((eTime - lastTime) / 1000 / 60);
                if (diffMins > 0 && diffMins < 960) {
                    if (lastState === 'working') w += diffMins;
                    else if (lastState === 'break') b += diffMins;
                    else if (lastState === 'others') o += diffMins;
                }
             }
             const t = (e.entry_type || '').toLowerCase();
             if (t === 'clock-in') lastState = 'working';
             else if (t === 'break-start') lastState = 'break';
             else if (t === 'break-end') lastState = 'working';
             else if (t === 'others-out') lastState = 'others';
             else if (t === 'others-in') lastState = 'working';
             else if (t === 'clock-out') lastState = 'out';
             lastTime = eTime;
          });

          // --- 3. Legend & Stats (Top Row) ---
          const topRowY = 60;
          
          const minutesToLabel = (m: number) => {
             const h = Math.floor(m / 60);
             const mins = m % 60;
             return `${h}h ${mins}m`;
          };

          const drawLegendItem = (x: number, label: string, valueMins: number, color: number[]) => {
              doc.setFillColor(color[0], color[1], color[2]);
              doc.circle(x, topRowY - 1, 1.2, 'F'); 
              
              doc.setFontSize(8);
              doc.setTextColor(30, 41, 59);
              doc.setFont("helvetica", "bold");
              doc.text(label, x + 3, topRowY);
              
              doc.setFont("helvetica", "normal");
              const labelWidth = doc.getTextWidth(label);
              const valText = minutesToLabel(valueMins);
              const valWidth = doc.getTextWidth(valText);
              
              const valX = x + 3 + labelWidth + 2;
              doc.text(valText, valX, topRowY);
              
              // Return total width used + gap
              return (valX + valWidth - x) + 8; // 8 is the gap to next item
          };
          
          // Position Legend Items (Dynamic Layout)
          let currentLegendX = 14;
          
          // Working
          currentLegendX += drawLegendItem(currentLegendX, "Trabajando", w, [59, 130, 246]);
          // Break
          currentLegendX += drawLegendItem(currentLegendX, "Descanso", b, [245, 158, 11]);
          // Others
          drawLegendItem(currentLegendX, "Otros/Permisos", o, [236, 72, 153]);

          // Total (Right Aligned)
          const totalMins = w + b + o;
          const totalHours = Math.floor(totalMins / 60);
          const totalMinutes = totalMins % 60;
          const totalLabel = `${totalHours}h ${totalMinutes}m`;
          
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
          doc.setFont("helvetica", "bold");
          doc.text(`Total: ${totalLabel}`, 196, topRowY, { align: 'right' });


          // --- 4. Horizontal Bar Chart ---
          const barX = 14;
          const barY = 66; // Below Legend
          const barWidth = 182; 
          const barHeight = 6; 
          
          let currentX = barX;
          if (totalMins > 0) {
              const slices = [
                  { value: w, color: [59, 130, 246] }, // Working: #3b82f6
                  { value: b, color: [245, 158, 11] }, // Break: #f59e0b
                  { value: o, color: [236, 72, 153] }  // Others: #ec4899
              ];
              
              slices.forEach(slice => {
                  if (slice.value <= 0) return;
                  const percent = slice.value / totalMins;
                  const sliceWidth = percent * barWidth;
                  
                  doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
                  doc.rect(currentX, barY, sliceWidth, barHeight, 'F');
                  currentX += sliceWidth;
              });
          } else {
             doc.setFillColor(226, 232, 240);
             doc.rect(barX, barY, barWidth, barHeight, 'F');
          }


          // --- 6. Table ---
          
          const tableRows: any[] = [];
          
          data.forEach((row, index) => {
              const d = row.occurred_at ? new Date(row.occurred_at) : new Date(row.created_at);
              const dateStr = d.toLocaleDateString('es-ES');
              const timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
              
              let typeLabel = '';
              if (row.entry_type === 'clock-in') typeLabel = 'Entrada';
              else if (row.entry_type === 'clock-out') typeLabel = 'Salida';
              else if (row.entry_type === 'break-start') typeLabel = 'Inicio Descanso';
              else if (row.entry_type === 'break-end') typeLabel = 'Fin Descanso';
              else if (row.entry_type === 'others-out') typeLabel = 'Salida (Permiso)';
              else if (row.entry_type === 'others-in') typeLabel = 'Entrada (Permiso)';
              else typeLabel = 'Registro';
              
              const finalDesc = row.description || typeLabel;
              
              // Duration calculation
              let durationLabel = '-';
              if (index < data.length - 1) {
                   const currentMs = d.getTime();
                   const nextRow = data[index + 1];
                   const nextMs = nextRow.occurred_at ? new Date(nextRow.occurred_at).getTime() : new Date(nextRow.created_at).getTime();
                   const diffMs = nextMs - currentMs;
                   if (diffMs > 0) {
                       const h = Math.floor(diffMs / (1000 * 60 * 60));
                       const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                       if (h > 0 || m > 0) durationLabel = `${h}h ${m}m`;
                   }
              }

              const metodoStr = row.is_manual ? 'Manual' : 'Dispositivo';
              const ubicacionStr = (row.latitude != null && row.longitude != null)
                  ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`
                  : '-';

              tableRows.push([dateStr, timeStr, finalDesc, metodoStr, ubicacionStr, durationLabel]);
          });

          autoTable(doc, {
            head: [['Fecha', 'Hora', 'Descripción', 'Método', 'Ubicación', 'Tiempo']],
            body: tableRows,
            startY: 78,
            theme: 'grid',
            headStyles: { fillColor: [19, 91, 236], textColor: 255 },
            styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 22 },
                1: { cellWidth: 15 },
                3: { cellWidth: 20, halign: 'center' },
                4: { cellWidth: 35, halign: 'center' },
                5: { cellWidth: 22, halign: 'center' }
            },
            willDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                     const text = data.cell.raw as string;
                     if (text && text !== '-') {
                          const desc = (data.row.raw as string[])[2].toLowerCase();
                          
                          let tagColor: number[] | null = null;
                          
                          if (desc.includes('entrada') || desc.includes('fin descanso') || desc.includes('others-in')) {
                               tagColor = [59, 130, 246]; // Blue (Working)
                          } else if (desc.includes('inicio descanso')) {
                               tagColor = [245, 158, 11]; // Orange (Break)
                          } else if (desc.includes('permiso') || desc.includes('others-out')) {
                               tagColor = [236, 72, 153]; // Pink (Others)
                          } else {
                               // Default (e.g. Salida trabajo): No tag, plain text
                               return; 
                          }

                          if (tagColor) {
                              doc.setFillColor(tagColor[0], tagColor[1], tagColor[2]);
                              const boxWidth = 20;
                              const boxHeight = 5.5;
                              const x = data.cell.x + (data.cell.width - boxWidth) / 2;
                              const y = data.cell.y + (data.cell.height - boxHeight) / 2;
                              
                              doc.roundedRect(x, y, boxWidth, boxHeight, 1, 1, 'F');
                              
                              // Set text to white for tagged cells
                              doc.setTextColor(255, 255, 255);
                              doc.setFont("helvetica", "bold");
                          }
                      }
                }
            },
            didDrawCell: (data) => {
            }
          });

          // --- 7. Add Page Numbers (Footer) ---
          const pageCount = doc.getNumberOfPages();
          for (let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.setFontSize(9);
              doc.setTextColor(100, 116, 139); // Slate 500
              doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
          }
          
          // Construct Filename using standardized variable
          doc.save(`${finalFilename}.pdf`);
      }

      setMessage({ type: 'success', text: 'Informe descargado correctamente' });
      setShowExportModal(false);

    } catch (err: any) {
      setMessage({ type: 'error', text: 'Error al exportar: ' + err.message });
    } finally {
      setIsExporting(false);
    }
  };

  // Fallback name logic: prioritize user_metadata.full_name -> user.name -> email username
  const displayName = user.user_metadata?.full_name || user.name || user.email?.split('@')[0] || 'Usuario';
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // Company state
  const [company, setCompany] = useState<{ id: string; name: string; role: string } | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const [linkingCompany, setLinkingCompany] = useState(false);
  const [unlinkingCompany, setUnlinkingCompany] = useState(false);
  const [isPendingInvite, setIsPendingInvite] = useState(false);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [companyManagers, setCompanyManagers] = useState<Array<{ name: string; email: string; role: string }>>([]);

  const loadCompanyInfo = async () => {
    try {
      setLoadingCompany(true);
      setTeamName(null);
      setCompanyManagers([]);
      if (!user) return;

      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select('company_id, role, accepted, team_id, companies:company_id(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberError) {
        console.error("Error loading company membership:", memberError);
        return;
      }

      if (memberData) {
        const companiesObj = Array.isArray(memberData.companies) 
          ? memberData.companies[0] 
          : memberData.companies;

        setCompany({
          id: memberData.company_id,
          name: companiesObj?.name || 'Empresa sin nombre',
          role: memberData.role
        });
        setIsPendingInvite(memberData.accepted === false);

        // 1. Obtener nombre del equipo si está asignado
        if (memberData.team_id) {
          const { data: teamData, error: teamError } = await supabase
            .from('teams')
            .select('name')
            .eq('id', memberData.team_id)
            .maybeSingle();
          
          if (!teamError && teamData) {
            setTeamName(teamData.name);
          }
        }

        // 2. Obtener gestores de la empresa
        if (memberData.accepted !== false) {
          console.log("loadCompanyInfo - Querying managers for company:", memberData.company_id);
          const { data: membersData, error: membersError } = await supabase
            .from('company_members')
            .select('role, team_id, profiles:user_id(full_name, email)')
            .eq('company_id', memberData.company_id)
            .in('role', ['admin', 'hr', 'manager']);

          if (membersError) {
            console.error("loadCompanyInfo - Error loading company managers:", membersError);
          } else {
            console.log("loadCompanyInfo - Loaded managers raw data:", membersData);
          }

          if (!membersError && membersData) {
            const managers = membersData
              .filter((m: any) => {
                if (m.role === 'admin' || m.role === 'hr') return true;
                if (m.role === 'manager' && m.team_id && m.team_id === memberData.team_id) return true;
                return false;
              })
              .map((m: any) => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                return {
                  name: profile?.full_name || profile?.email?.split('@')[0] || 'Gestor',
                  email: profile?.email || '',
                  role: m.role
                };
              });
            setCompanyManagers(managers);
          }
        }
      } else {
        setCompany(null);
        setIsPendingInvite(false);
      }
    } catch (err) {
      console.error("Error loading company info:", err);
    } finally {
      setLoadingCompany(false);
    }
  };

  useEffect(() => {
    loadCompanyInfo();

    if (!user?.id) return;

    const channel = supabase
      .channel('company_members_profile')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_members',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("Realtime change detected in company_members (Profile):", payload);
          await loadCompanyInfo();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    const loadYearStats = async () => {
      if (!user) return;
      
      const now = new Date();
      const start = startOfYear(now);
      
      const { data, error } = await supabase
        .from("time_entries")
        .select("entry_type, occurred_at, created_at")
        .eq("user_id", user.id)
        .gte("occurred_at", start.toISOString())
        .order("occurred_at", { ascending: true });

      if (error || !data) {
        setLoadingStats(false);
        return;
      }

      let w = 0, b = 0, o = 0;
      let lastState: 'working' | 'break' | 'others' | 'out' = 'out';
      let lastTime = 0;

      // Simplificación: Asumimos estado inicial 'out' el 1 de Enero o antes del primer registro
      
      for (const e of data) {
         const eTime = e.occurred_at ? new Date(e.occurred_at).getTime() : new Date(e.created_at).getTime();
         
         if (lastTime > 0) {
            const diffMins = Math.floor((eTime - lastTime) / 1000 / 60);
            // Filtro de seguridad: ignorar intervalos > 16h (olvidos probables) para evitar ensuciar la gráfica
            if (diffMins > 0 && diffMins < 960) { 
                if (lastState === 'working') w += diffMins;
                else if (lastState === 'break') b += diffMins;
                else if (lastState === 'others') o += diffMins;
            }
         }

         const t = (e.entry_type || '').toLowerCase();
         if (t === 'clock-in') lastState = 'working';
         else if (t === 'break-start') lastState = 'break';
         else if (t === 'break-end') lastState = 'working';
         else if (t === 'others-out') lastState = 'others';
         else if (t === 'others-in') lastState = 'working';
         else if (t === 'clock-out') lastState = 'out';
         
         lastTime = eTime;
      }
      
      // Sumar hasta ahora si el estado es activo
      if (lastState !== 'out' && lastTime > 0) {
          const nowTime = now.getTime();
          const diff = Math.floor((nowTime - lastTime) / 1000 / 60);
          if (diff > 0 && diff < 960) {
             if (lastState === 'working') w += diff;
             else if (lastState === 'break') b += diff;
             else if (lastState === 'others') o += diff;
          }
      }

      setYearStats({ w, b, o });
      setLoadingStats(false);
    };

    loadYearStats();
  }, [user]);

  const renderDonut = () => {
    const { w, b, o } = yearStats;
    const total = w + b + o; // Total registrado
    
    // Si no hay datos
    if (total === 0) {
        return (
            <div className="flex items-center justify-center h-32 w-32 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-400">Sin datos</span>
            </div>
        );
    }

    const data = [
        { value: w, color: CHART_COLORS.working },
        { value: b, color: CHART_COLORS.break },
        { value: o, color: CHART_COLORS.others },
    ];

    let cumulativePercent = 0;
    const size = 120;
    const center = size / 2;
    const radius = 45;
    const strokeWidth = 18;

    // Caso 100% de un solo tipo
    const fullItem = data.find(d => d.value > 0 && d.value === total);
    if (fullItem) {
        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 drop-shadow-sm shrink-0">
               <circle cx={center} cy={center} r={radius} fill="none" stroke={fullItem.color} strokeWidth={strokeWidth} />
            </svg>
        );
    }

    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 drop-shadow-sm shrink-0">
        {data.map((item, index) => {
           if (item.value <= 0) return null;
           const percent = (item.value / total) * 100;
           const startPercent = cumulativePercent;
           const endPercent = cumulativePercent + percent;
           cumulativePercent = endPercent;

           const startAngle = (startPercent / 100) * 2 * Math.PI;
           const endAngle = (endPercent / 100) * 2 * Math.PI;
           const x1 = center + radius * Math.cos(startAngle);
           const y1 = center + radius * Math.sin(startAngle);
           const x2 = center + radius * Math.cos(endAngle);
           const y2 = center + radius * Math.sin(endAngle);
           const largeArcFlag = percent > 50 ? 1 : 0;
           const pathData = [`M ${x1} ${y1}`, `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`].join(' ');

           return (
             <path key={index} d={pathData} fill="none" stroke={item.color} strokeWidth={strokeWidth} strokeLinecap="round" />
           );
        })}
      </svg>
    );
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Debes seleccionar una imagen para subir.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const { data: userData, error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) {
        throw updateError;
      }

      // Sincronizar con la tabla pública profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (profileError) {
        console.error("Error updating avatar in profiles table:", profileError);
      }

      if (userData.user) {
        setUser(userData.user);
        setMessage({ type: 'success', text: 'Foto de perfil actualizada' });
      }
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setMessage({ type: 'error', text: error.message || 'Error al actualizar la foto de perfil.' });
    } finally {
      setUploading(false);
    }
  };




  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display overflow-x-hidden min-h-screen flex flex-col max-w-md mx-auto relative shadow-2xl pb-32">
      <div className="fixed top-0 left-0 right-0 z-20 bg-background-light dark:bg-background-dark" style={{ height: 'env(safe-area-inset-top)' }} />
      <div className="sticky top-0 z-10 bg-background-light dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 flex items-center justify-between">
        <div onClick={handleBack} className="flex size-12 shrink-0 items-center justify-start text-slate-900 dark:text-white cursor-pointer hover:opacity-70 transition-opacity">
          <span className="material-symbols-outlined text-[24px]">arrow_back_ios_new</span>
        </div>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">Mi Perfil</h2>
        <div className="flex w-12 items-center justify-end">
           <Logo className="h-10 w-10 drop-shadow-sm" />
        </div>
      </div>

      <div className="w-full">
        <div className="flex p-5 flex-col items-center pt-8">
          <div className="relative group cursor-pointer">
            <div className="relative">
              <img 
                src={user.user_metadata?.avatar_url || DEFAULT_AVATAR}
                alt="Perfil"
                className="aspect-square rounded-full h-28 w-28 object-cover ring-4 ring-background-light dark:ring-background-dark shadow-lg"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-2 flex items-center justify-center shadow-md transform translate-x-1 translate-y-1 cursor-pointer hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            </div>
            <input
              type="file"
              id="avatar"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
          </div>
          <div className="flex flex-col items-center justify-center mt-4 gap-1">
            <p className="text-slate-900 dark:text-white text-[22px] font-bold leading-tight tracking-[-0.015em] text-center">{displayName}</p>

            <span className="inline-flex items-center gap-x-1.5 py-1 px-3 rounded-full text-xs font-medium bg-primary/10 text-primary mt-1">
              ID: {user.id}
            </span>
          </div>
        </div>

        <div className="mt-2">
          <h3 className="text-slate-500 dark:text-text-secondary text-xs font-bold uppercase tracking-wider px-5 pb-2 pt-4">Información Personal</h3>
          <div className="bg-white dark:bg-surface-dark mx-5 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-border-dark/50">
            <div className="flex flex-col px-4 py-3 border-b border-gray-100 dark:border-border-dark/50">
              <label className="text-xs text-text-secondary font-medium mb-1">Nombre Completo</label>
              <div className="flex items-center">
                <span className="material-symbols-outlined text-text-secondary mr-3 text-[20px]">person</span>
                <input 
                  readOnly={!isEditingName}
                  className={`flex-1 bg-transparent border-none p-0 text-slate-900 dark:text-white text-base font-medium outline-none transition-colors ${isEditingName ? 'border-b border-primary/50' : ''}`} 
                  value={isEditingName ? tempName : displayName}
                  onChange={(e) => setTempName(e.target.value)}
                  ref={(input) => { if (isEditingName && input) input.focus(); }}
                />
                
                {/* Actions */}
                <div className="flex items-center gap-1 ml-2">
                  {!isEditingName ? (
                    <button 
                      onClick={() => {
                        setTempName(displayName);
                        setIsEditingName(true);
                      }}
                      className="p-1 text-slate-400 hover:text-primary transition-colors cursor-pointer border-none bg-transparent"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={async () => {
                          if (!tempName.trim()) {
                            setMessage({ type: 'error', text: 'El nombre no puede estar vacío' });
                            return;
                          }
                          
                          // 1. Actualizar metadatos de autenticación
                          const { data, error } = await supabase.auth.updateUser({
                            data: { full_name: tempName }
                          });
                          
                          if (error) {
                            setMessage({ type: 'error', text: error.message });
                            return;
                          }

                          // 2. Sincronizar con la tabla pública profiles
                          const { error: profileError } = await supabase
                            .from('profiles')
                            .update({ 
                              full_name: tempName,
                              name: tempName
                            })
                            .eq('id', user.id);

                          if (profileError) {
                            console.error("Error updating public profile name:", profileError);
                          }

                          if (data.user) {
                            setUser(data.user);
                          }
                          setMessage({ type: 'success', text: 'Nombre actualizado' });
                          setIsEditingName(false);
                        }}
                        className="p-1 text-green-500 hover:text-green-600 transition-colors cursor-pointer border-none bg-transparent"
                      >
                         <span className="material-symbols-outlined text-[20px]">check</span>
                      </button>
                      <button 
                        onClick={() => {
                          setIsEditingName(false);
                          setTempName(displayName);
                        }}
                        className="p-1 text-red-500 hover:text-red-600 transition-colors cursor-pointer border-none bg-transparent"
                      >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col px-4 py-3 border-b border-gray-100 dark:border-border-dark/50">
              <label className="text-xs text-text-secondary font-medium mb-1">Correo Electrónico</label>
              <div className="flex items-center">
                <span className="material-symbols-outlined text-text-secondary mr-3 text-[20px]">mail</span>
                <input readOnly className="flex-1 bg-transparent border-none p-0 text-slate-900 dark:text-white focus:ring-0 text-base font-medium outline-none" defaultValue={user.email}/>
              </div>
            </div>



          </div>
        </div>






      {/* Export Modal (Drawer) */}
      <div className={`fixed inset-0 z-[80] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-200 ${showExportModal ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div onClick={() => setShowExportModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div className={`relative w-full max-w-sm bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out border border-slate-100 dark:border-slate-800 ${showExportModal ? 'translate-y-0' : 'translate-y-full'}`}>
           <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                   <span className="material-symbols-outlined text-emerald-500">table_view</span>
                   Exportar Informe
                </h3>
                <button onClick={() => setShowExportModal(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 border-none bg-transparent cursor-pointer">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Selecciona el periodo</label>
                  <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => setExportRange('month')}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${exportRange === 'month' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                      >
                          <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-slate-400">calendar_today</span>
                              <div className="flex flex-col items-start">
                                  <span className={`text-sm font-bold ${exportRange === 'month' ? 'text-primary' : 'text-slate-700 dark:text-white'}`}>Este Mes</span>
                                  <span className="text-[10px] text-slate-400">Actividad del mes en curso</span>
                              </div>
                          </div>
                          {exportRange === 'month' && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
                      </button>

                      <button 
                        onClick={() => setExportRange('last-month')}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${exportRange === 'last-month' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                      >
                          <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-slate-400">history</span>
                              <div className="flex flex-col items-start">
                                  <span className={`text-sm font-bold ${exportRange === 'last-month' ? 'text-primary' : 'text-slate-700 dark:text-white'}`}>Mes Pasado</span>
                                  <span className="text-[10px] text-slate-400">Actividad del mes anterior completo</span>
                              </div>
                          </div>
                          {exportRange === 'last-month' && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
                      </button>

                      <button 
                        onClick={() => setExportRange('year')}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${exportRange === 'year' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                      >
                          <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-slate-400">calendar_month</span>
                              <div className="flex flex-col items-start">
                                  <span className={`text-sm font-bold ${exportRange === 'year' ? 'text-primary' : 'text-slate-700 dark:text-white'}`}>Todo el Año</span>
                                  <span className="text-[10px] text-slate-400">Histórico anual completo</span>
                              </div>
                          </div>
                          {exportRange === 'year' && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
                      </button>

                      {/* Opción Personalizado (Contenedor DIV para inputs internos) */}
                      <div 
                        className={`rounded-xl border transition-all overflow-hidden ${exportRange === 'custom' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                      >
                          <div 
                             onClick={() => setExportRange('custom')}
                             className="flex items-center justify-between p-3 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400">date_range</span>
                                <div className="flex flex-col items-start">
                                    <span className={`text-sm font-bold ${exportRange === 'custom' ? 'text-primary' : 'text-slate-700 dark:text-white'}`}>Personalizado</span>
                                    <span className="text-[10px] text-slate-400">Elegir fechas exactas</span>
                                </div>
                            </div>
                            {exportRange === 'custom' && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
                          </div>

                          <div 
                             className={`grid transition-[grid-template-rows,opacity,padding] duration-300 ease-in-out ${exportRange === 'custom' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                          >
                             <div className="overflow-hidden">
                                <div className="grid grid-cols-2 gap-3 px-3 pb-3 pt-0">
                                    <div className="space-y-1">
                                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Desde</label>
                                       <input 
                                          type="date" 
                                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 dark:text-white text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary border shadow-sm"
                                          value={customStartDate}
                                          onChange={(e) => setCustomStartDate(e.target.value)}
                                       />
                                    </div>
                                    <div className="space-y-1">
                                       <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-1">Hasta</label>
                                       <input 
                                          type="date" 
                                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-surface-dark border-gray-200 dark:border-gray-700 dark:text-white text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary border shadow-sm"
                                          value={customEndDate}
                                          onChange={(e) => setCustomEndDate(e.target.value)}
                                       />
                                    </div>
                                </div>
                             </div>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="flex gap-3">
                  <button 
                    onClick={() => handleExport('csv')}
                    disabled={isExporting}
                    className="flex-1 py-3.5 px-4 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center justify-center gap-2 border-none cursor-pointer disabled:opacity-50 shadow-lg shadow-green-600/20"
                  >
                     {isExporting ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     ) : (
                        <>
                           <span className="material-symbols-outlined">table_view</span>
                           <span>Excel</span>
                        </>
                     )}
                  </button>

                  <button 
                    onClick={() => handleExport('pdf')}
                    disabled={isExporting}
                    className="flex-1 py-3.5 px-4 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center justify-center gap-2 border-none cursor-pointer disabled:opacity-50 shadow-lg shadow-red-600/20"
                  >
                     {isExporting ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                     ) : (
                        <>
                           <span className="material-symbols-outlined">picture_as_pdf</span>
                           <span>PDF</span>
                        </>
                     )}
                  </button>
              </div>
           </div>
        </div>
      </div>

      {/* Password Change Modal */}
      <div className={`fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-200 ${showPasswordModal ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div onClick={() => setShowPasswordModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div className={`relative w-full max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out ${showPasswordModal ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cambiar Contraseña</h3>
            <button onClick={() => setShowPasswordModal(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 border-none bg-transparent cursor-pointer">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <form 
            className="p-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleUpdatePassword();
            }}
          >
             {/* Current Password */}
             <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña Actual</label>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">key</span>
                    <input 
                      type={showPasswords ? "text" : "password"}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border ${currentPasswordValid === false ? 'border-red-500 focus:border-red-500' : 'border-gray-200 dark:border-gray-800 focus:border-primary'} focus:ring-2 focus:ring-primary/20 outline-none transition-all dark:text-white`}
                      placeholder="Tu clave actual"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                </div>
                {/* Real-time Validation Feedback */}
                {currentPassword && (
                    <div className="mt-2 h-4 text-xs font-medium flex items-center gap-1.5 transition-colors">
                        {validatingCurrent ? (
                            <div className="flex items-center gap-2 text-gray-400">
                                <div className="w-3 h-3 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
                                Verificando...
                            </div>
                        ) : currentPasswordValid === true ? (
                            <div className="text-green-500 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                Contraseña correcta
                            </div>
                        ) : currentPasswordValid === false ? (
                            <div className="text-red-500 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">cancel</span>
                                Contraseña incorrecta
                            </div>
                        ) : null}
                    </div>
                )}
             </div>

             <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nueva Contraseña</label>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                    <input 
                      type={showPasswords ? "text" : "password"}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                      placeholder="Nueva clave segura"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                </div>
                {/* Visual Checklist */}
                <div className="flex flex-wrap gap-3 mt-2">
                    {passwordRequirements.map(req => (
                        <div key={req.id} className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${req.valid ? 'text-green-500' : 'text-gray-400'}`}>
                            <span className="material-symbols-outlined text-[14px]">
                                {req.valid ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            {req.text}
                        </div>
                    ))}
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar Contraseña</label>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">lock_reset</span>
                    <input 
                      type={showPasswords ? "text" : "password"}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white"
                      placeholder="Repite la nueva clave"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                    />
                </div>
                {confirmPassword && (
                    <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium transition-colors ${newPassword === confirmPassword ? 'text-green-500' : 'text-red-500'}`}>
                        <span className="material-symbols-outlined text-[14px]">
                            {newPassword === confirmPassword ? 'check_circle' : 'cancel'}
                        </span>
                        {newPassword === confirmPassword ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                    </div>
                )}
             </div>

             <div className="flex items-center gap-3 mt-4">
                 <button 
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="p-3.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors border-none cursor-pointer flex items-center justify-center shrink-0"
                    title={showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                 >
                    <span className="material-symbols-outlined text-[24px]">
                       {showPasswords ? 'visibility' : 'visibility_off'}
                    </span>
                 </button>

                 <button 
                    type="submit"
                    disabled={passwordLoading}
                    className="flex-1 py-3.5 rounded-xl bg-primary text-white font-bold text-base shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-70 border-none cursor-pointer flex items-center justify-center gap-2"
                 >
                    {passwordLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">save</span>
                        Guardar Cambios
                      </>
                    )}
                 </button>
             </div>
          </form>
        </div>
      </div>

        <div className="mt-6">
          <h3 className="text-slate-500 dark:text-text-secondary text-xs font-bold uppercase tracking-wider px-5 pb-2">Resumen Anual</h3>
          <div className="bg-white dark:bg-surface-dark mx-5 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-border-dark/50">
             <div className="p-5 flex items-center justify-between border-b border-gray-100 dark:border-border-dark/50">
             {loadingStats ? (
                <div className="w-full flex justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
             ) : (
                <>
                   {renderDonut()}
                   <div className="flex flex-col gap-2.5 flex-1 w-full ml-4">
                      {/* WORKING */}
                      <div className="flex items-center justify-between w-full">
                         <div className="flex items-center gap-2">
                             <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.working }}></span>
                             <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Trabajando</span>
                         </div>
                         <div className="flex flex-col items-end">
                             <span className="text-sm font-bold text-slate-900 dark:text-white">{minutesToLabel(yearStats.w)}</span>
                             <span className="text-[10px] text-slate-400 font-medium">
                                {yearStats.w + yearStats.b + yearStats.o > 0 
                                  ? Math.round((yearStats.w / (yearStats.w + yearStats.b + yearStats.o)) * 100) 
                                  : 0}%
                             </span>
                         </div>
                      </div>
                      
                      {/* BREAK */}
                      <div className="flex items-center justify-between w-full">
                         <div className="flex items-center gap-2">
                             <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.break }}></span>
                             <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Descanso</span>
                         </div>
                         <div className="flex flex-col items-end">
                             <span className="text-sm font-bold text-slate-900 dark:text-white">{minutesToLabel(yearStats.b)}</span>
                             <span className="text-[10px] text-slate-400 font-medium">
                                {yearStats.w + yearStats.b + yearStats.o > 0 
                                  ? Math.round((yearStats.b / (yearStats.w + yearStats.b + yearStats.o)) * 100) 
                                  : 0}%
                             </span>
                         </div>
                      </div>
                      
                      {/* OTHERS */}
                      <div className="flex items-center justify-between w-full">
                         <div className="flex items-center gap-2">
                             <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS.others }}></span>
                             <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Permiso</span>
                         </div>
                         <div className="flex flex-col items-end">
                             <span className="text-sm font-bold text-slate-900 dark:text-white">{minutesToLabel(yearStats.o)}</span>
                             <span className="text-[10px] text-slate-400 font-medium">
                                {yearStats.w + yearStats.b + yearStats.o > 0 
                                  ? Math.round((yearStats.o / (yearStats.w + yearStats.b + yearStats.o)) * 100) 
                                  : 0}%
                             </span>
                         </div>
                      </div>
                   </div>
                </>
             )}
             </div>
             
             {/* Export Button */}
             <button 
                onClick={() => setShowExportModal(true)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group border-none bg-transparent cursor-pointer"
             >
                <div className="flex items-center gap-3">
                   <div className="size-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <span className="material-symbols-outlined text-[20px]">download</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-slate-900 dark:text-white font-medium text-base">Exportar Datos</span>
                      <span className="text-xs text-text-secondary">Descargar informe en Excel (CSV)</span>
                   </div>
                </div>
                <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors text-[20px]">chevron_right</span>
             </button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-slate-500 dark:text-text-secondary text-xs font-bold uppercase tracking-wider px-5 pb-2">Empresa</h3>
          <div className="bg-white dark:bg-surface-dark mx-5 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-border-dark/50">
            {loadingCompany ? (
              <div className="w-full flex items-center justify-center py-5">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
              </div>
            ) : company ? (
              <div className="w-full divide-y divide-gray-100 dark:divide-border-dark/50">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <span className="material-symbols-outlined text-[20px]">business</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-900 dark:text-white font-bold text-base">{company.name}</span>
                      <span className="text-xs text-text-secondary">
                        {teamName ? `Equipo: ${teamName}` : 'Sin equipo asignado'}
                      </span>
                    </div>
                  </div>
                  {isPendingInvite ? (
                    <span className="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500">
                      Invitación Recibida
                    </span>
                  ) : (
                    <span className="inline-flex items-center py-1 px-2.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500">
                      Conectado
                    </span>
                  )}
                </div>

                {/* Listado de Gestores Autorizados */}
                {!isPendingInvite && companyManagers.length > 0 && (
                  <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-900/30 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Gestores autorizados (RRHH / Administradores)
                    </span>
                    <div className="flex flex-col gap-2 mt-1">
                      {companyManagers.map((mgr, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-border-dark/30 last:border-0 pb-1.5 last:pb-0">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-slate-400">person</span>
                            <div className="flex flex-col">
                              <span className="text-slate-800 dark:text-slate-200 font-bold">{mgr.name}</span>
                              {mgr.email && (
                                <span className="text-[10px] text-slate-400">{mgr.email}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[9px] bg-indigo-500/10 text-indigo-500 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-md self-center">
                            {mgr.role === 'admin' ? 'Administrador' : mgr.role === 'hr' ? 'RRHH' : 'Responsable'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                      Estas personas tienen permisos para supervisar, aprobar y editar tus registros de jornada laboral.
                    </p>
                  </div>
                )}
                
                {isPendingInvite && (
                  <div className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-900/40">
                    <button 
                      onClick={handleAcceptInviteProfile}
                      disabled={linkingCompany}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors border-none cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {linkingCompany ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">check</span>
                          Aceptar
                        </>
                      )}
                    </button>
                    <button 
                      onClick={handleRejectInviteProfile}
                      disabled={unlinkingCompany}
                      className="flex-1 py-2 px-3 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors border-none cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                      {unlinkingCompany ? (
                        <div className="w-3.5 h-3.5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[14px]">close</span>
                          Rechazar
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-400">
                    <span className="material-symbols-outlined text-[20px]">cloud_off</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-900 dark:text-white font-bold text-base">Cuenta Independiente</span>
                    <span className="text-xs text-text-secondary">Sin vinculación activa</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    No estás conectado a ninguna empresa. Puedes usar la app para registrar tus fichajes de forma local y generar tus propios informes.
                  </p>
                  <div className="border-t border-slate-100 dark:border-slate-800/50 pt-2.5">
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                      ¿Tu empresa usa Fycheo?
                    </span>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                      Pide a tu responsable de RRHH o administrador que te invite a la organización usando tu correo: <strong className="text-slate-700 dark:text-slate-300 font-semibold select-text">{user.email}</strong>. 
                      Recibirás la invitación en tu aplicación para vincularte al instante.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-slate-500 dark:text-text-secondary text-xs font-bold uppercase tracking-wider px-4 pb-2">Documentos</h3>
          <div className="bg-white dark:bg-surface-dark mx-4 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-border-dark/50">
            <button
              onClick={() => navigate('/documents')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group border-none bg-transparent cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[20px]">folder</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-900 dark:text-white font-medium text-base">Mis Documentos</span>
                  <span className="text-xs text-text-secondary">Nóminas, contratos y más</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unseenDocs > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
                    {unseenDocs}
                  </span>
                )}
              </div>
              <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-slate-500 dark:text-text-secondary text-xs font-bold uppercase tracking-wider px-4 pb-2">Solicitudes</h3>
          <div className="bg-white dark:bg-surface-dark mx-4 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-border-dark/50">
            <button
              onClick={() => navigate('/solicitudes')}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group border-none bg-transparent cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <span className="material-symbols-outlined text-[20px]">event_note</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-900 dark:text-white font-medium text-base">Mis Solicitudes</span>
                  <span className="text-xs text-text-secondary">Permisos, vacaciones y bajas</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {unseenSolicitudes > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
                    {unseenSolicitudes}
                  </span>
                )}
                <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors text-[20px]">chevron_right</span>
              </div>
            </button>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-slate-500 dark:text-text-secondary text-xs font-bold uppercase tracking-wider px-4 pb-2">Seguridad</h3>
          <div className="bg-white dark:bg-surface-dark mx-4 rounded-xl overflow-hidden shadow-sm border border-gray-100 dark:border-border-dark/50 divide-y divide-gray-100 dark:divide-border-dark/50">
            <button 
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left group border-none bg-transparent cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <span className="material-symbols-outlined text-[20px]">password</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-slate-900 dark:text-white font-medium text-base">Cambiar Contraseña</span>
                  <span className="text-xs text-text-secondary">Actualizar clave de acceso</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-text-secondary group-hover:text-primary transition-colors text-[20px]">chevron_right</span>
            </button>
          </div>
        </div>

        <div className="mt-8 mb-8 mx-4">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              setIsLoggedIn(false);
            }}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-base transition-colors hover:bg-red-100 dark:hover:bg-red-500/20 border-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Cerrar Sesión
          </button>
          <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-4 font-medium">Versión 1.0.0</p>
        </div>
      </div>

      {/* Toast Notification */}
      <div 
        className={`fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full shadow-lg z-[100] transition-all duration-300 pointer-events-none flex items-center gap-2
        ${message ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
        ${message?.type === 'error' ? 'bg-red-500 text-white' : ''}
        ${message?.type === 'success' ? 'bg-green-500 text-white' : ''}
        ${message?.type === 'info' ? 'bg-slate-700 text-white' : ''}
        `}
      >
        {message?.type === 'info' && <span className="material-symbols-outlined text-[18px]">info</span>}
        <span className="text-sm font-medium">{message?.text}</span>
      </div>

      {/* Consistent Bottom Navigation */}


      {/* Manual Entry Modal */}
      <div className={`fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4 transition-all duration-200 ${showModal ? 'visible opacity-100' : 'invisible opacity-0'}`}>
        <div onClick={() => { setShowModal(false); setContext(''); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div className={`relative w-full max-w-md bg-white dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden transition-transform duration-300 ease-out ${showModal ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Añadir Registro Manual</h3>
            <button onClick={() => { setShowModal(false); setContext(''); }} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-500 border-none bg-transparent cursor-pointer">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <form className="p-5 space-y-4 no-scrollbar max-h-[85vh] overflow-y-auto" onSubmit={(e) => { e.preventDefault(); setShowModal(false); setContext(''); }}>
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo de Registro</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setEntryType('clock-in')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${entryType === 'clock-in' ? 'bg-primary text-white border-primary shadow-md' : 'bg-transparent text-gray-500 border-gray-200 dark:border-gray-700 hover:border-primary'}`}>
                  <span className="material-symbols-outlined text-[18px]">login</span> Entrada
                </button>
                <button type="button" onClick={() => setEntryType('clock-out')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${entryType === 'clock-out' ? 'bg-slate-600 text-white border-slate-600 shadow-md' : 'bg-transparent text-gray-500 border-gray-200 dark:border-gray-700 hover:border-slate-600'}`}>
                  <span className="material-symbols-outlined text-[18px]">logout</span> Salida
                </button>
                <button type="button" onClick={() => setEntryType('break-start')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${entryType === 'break-start' ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'bg-transparent text-gray-500 border-gray-200 dark:border-gray-700 hover:border-amber-500'}`}>
                  <span className="material-symbols-outlined text-[18px]">coffee</span> Inicio Descanso
                </button>
                <button type="button" onClick={() => setEntryType('break-end')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${entryType === 'break-end' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-transparent text-gray-500 border-gray-200 dark:border-gray-700 hover:border-emerald-500'}`}>
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span> Fin Descanso
                </button>
                {/* Reordered "Otros" Buttons: Salida (Otros) left, Entrada (Otros) right */}
                <button type="button" onClick={() => setEntryType('others-out')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${entryType === 'others-out' ? 'bg-pink-400 text-white border-pink-400 shadow-md' : 'bg-transparent text-gray-500 border-gray-200 dark:border-gray-700 hover:border-pink-400'}`}>
                  <span className="material-symbols-outlined text-[18px]">edit_note</span> Salida (Otros)
                </button>
                <button type="button" onClick={() => setEntryType('others-in')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all border ${entryType === 'others-in' ? 'bg-pink-500 text-white border-pink-500 shadow-md' : 'bg-transparent text-gray-500 border-gray-200 dark:border-gray-700 hover:border-pink-500'}`}>
                  <span className="material-symbols-outlined text-[18px]">history_edu</span> Entrada (Otros)
                </button>
              </div>
            </div>

            {(entryType === 'others-in' || entryType === 'others-out') && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Contexto / Motivo</label>
                <input 
                  autoFocus
                  className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-pink-500 focus:border-pink-500 text-sm shadow-sm outline-none border transition-colors" 
                  type="text" 
                  placeholder="Ej: Visita médica, Diligencia..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Fecha</label>
              <input className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-primary focus:border-primary text-sm shadow-sm outline-none border" type="date" defaultValue="2024-10-24"/>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hora</label>
              <input className="block w-full px-3 py-2.5 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white focus:ring-primary focus:border-primary text-sm shadow-sm outline-none border" type="time" defaultValue="08:00"/>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setContext(''); }} className="flex-1 py-3 px-4 rounded-xl text-center text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border-none bg-transparent cursor-pointer" type="button">Cancelar</button>
              <button className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-bold shadow-lg transition-all hover:opacity-90 border-none cursor-pointer ${(entryType === 'others-in' || entryType === 'others-out') ? 'bg-pink-500 shadow-pink-500/25' : 'bg-primary shadow-primary/25'}`} type="submit">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;
