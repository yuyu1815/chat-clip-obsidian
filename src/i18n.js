import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ja from './locales/ja.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
    },
    lng: 'ja',
    fallbackLng: 'ja',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    debug: false,
  });

export default i18n; 