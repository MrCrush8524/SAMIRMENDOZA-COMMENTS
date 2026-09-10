export const STRINGS = {
  en: {
    title: "IN SAMIR'S MIND",
    tagline: 'Walk Through Dreams',
    newDream: 'New Dream',
    continue: 'Continue',
    settings: 'Settings',
    extras: 'Extras',
    soundtrack: 'Dream Soundtrack',
    selectDreamer: 'Select Your Dreamer'
  },
  es: {
    title: "EN LA MENTE DE SAMIR",
    tagline: 'Camina a Través de los Sueños',
    newDream: 'Nuevo Sueño',
    continue: 'Continuar',
    settings: 'Ajustes',
    extras: 'Extras',
    soundtrack: 'Banda Sonora',
    selectDreamer: 'Elige a tu Soñador'
  },
  'pt-BR': {
    title: 'NA MENTE DO SAMIR',
    tagline: 'Caminhe Através dos Sonhos',
    newDream: 'Novo Sonho',
    continue: 'Continuar',
    settings: 'Configurações',
    extras: 'Extras',
    soundtrack: 'Trilha Sonora',
    selectDreamer: 'Escolha seu Sonhador'
  }
};

export function applyLanguage(lang) {
  const dict = STRINGS[lang] || STRINGS.en;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  try { localStorage.setItem('ism_lang', lang); } catch {}
}

export function getStoredLanguage() {
  try { return localStorage.getItem('ism_lang') || 'en'; } catch { return 'en'; }
}
