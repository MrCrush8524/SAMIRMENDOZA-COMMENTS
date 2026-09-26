// Single source for the version shown in Settings and About.
export const VERSION = '2.6.0';

// Which build of AMB is running: the Android app, the Windows app, or the website.
export function platformName() {
  const cap = window.Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return 'Android app';
  if (window.ambDesktop) return window.ambDesktop.platform === 'darwin' ? 'Mac app' : 'Windows app';
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return standalone ? 'Home Screen app' : 'Web app';
}
