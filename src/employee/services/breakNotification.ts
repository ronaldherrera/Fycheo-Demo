let breakInterval: ReturnType<typeof setInterval> | null = null;

function formatElapsed(startTime: Date): string {
  const totalSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds}s`;
}

async function showNotification(startTime: Date, silent: boolean) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const elapsed = Date.now() - startTime.getTime();

  await registration.showNotification('⏸ En descanso', {
    body: elapsed < 10_000
      ? 'Descanso iniciado'
      : `Llevas ${formatElapsed(startTime)} descansando`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'descanso-activo',
    renotify: false,
    silent,
  } as NotificationOptions);
}

export async function startBreakNotification(startTime: Date = new Date()) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') return;

  // Si ya había un intervalo activo, limpiarlo
  if (breakInterval) clearInterval(breakInterval);

  // Notificación inicial (con sonido)
  await showNotification(startTime, false);

  // Actualizar cada minuto en silencio
  breakInterval = setInterval(() => {
    showNotification(startTime, true);
  }, 60_000);
}

export async function stopBreakNotification() {
  if (breakInterval) {
    clearInterval(breakInterval);
    breakInterval = null;
  }

  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const notifications = await registration.getNotifications({ tag: 'descanso-activo' });
  notifications.forEach((n) => n.close());
}
