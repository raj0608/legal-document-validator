// The page's languages, and its text in each one. Pure data, shared by the browser and the server.
import { en } from "./english.js";
import { es } from "./spanish.js";

export const LANGS = [
  ["en", "English", "en-US", "English"],
  ["es", "Español", "es-US", "Spanish"],
  ["zh-Hans", "中文（简体）", "zh-CN", "Simplified Chinese"],
  ["zh-Hant", "中文（繁體）", "zh-TW", "Traditional Chinese"],
  ["tl", "Tagalog", "fil-PH", "Tagalog (Filipino)"],
  ["vi", "Tiếng Việt", "vi-VN", "Vietnamese"],
  ["ar", "العربية", "ar", "Arabic", true],
  ["fr", "Français", "fr-FR", "French"],
  ["ko", "한국어", "ko-KR", "Korean"],
  ["ru", "Русский", "ru-RU", "Russian"],
  ["ht", "Kreyòl ayisyen", "fr-HT", "Haitian Creole"],
  ["pt", "Português", "pt-BR", "Portuguese"],
  ["de", "Deutsch", "de-DE", "German"],
  ["hi", "हिन्दी", "hi-IN", "Hindi"],
  ["pl", "Polski", "pl-PL", "Polish"],
  ["ja", "日本語", "ja-JP", "Japanese"],
  ["it", "Italiano", "it-IT", "Italian"],
  ["fa", "فارسی", "fa-IR", "Persian (Farsi)", true],
  ["ur", "اردو", "ur-PK", "Urdu", true],
  ["pa", "ਪੰਜਾਬੀ", "pa-IN", "Punjabi (Gurmukhi script)"],
  ["bn", "বাংলা", "bn-IN", "Bengali"],
  ["gu", "ગુજરાતી", "gu-IN", "Gujarati"],
  ["ne", "नेपाली", "ne-NP", "Nepali"],
  ["my", "မြန်မာ", "my-MM", "Burmese (Myanmar language, Unicode script)"],
  ["so", "Soomaali", "so-SO", "Somali"],
  ["am", "አማርኛ", "am-ET", "Amharic"]
];
export const LANG = Object.fromEntries(LANGS.map((l) => [l[0], { label: l[1], locale: l[2], name: l[3], rtl: !!l[4] }]));

export const I18N = { en, es };
