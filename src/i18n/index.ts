import { createI18n } from 'vue-i18n'
import en from './en'
import de from './de'

function detectLocale(): 'de' | 'en' {
  // 1. Check localStorage for user preference
  const stored = localStorage.getItem('locale')
  if (stored === 'en' || stored === 'de') return stored

  // 2. Check browser language
  const browserLang = navigator.language || (navigator as any).userLanguage || ''
  if (browserLang.startsWith('en')) return 'en'

  // 3. Default to German
  return 'de'
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'de',
  messages: { en, de },
})

export default i18n
