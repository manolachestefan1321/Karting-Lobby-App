import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Sets the page's Google title and description in the visitor's language.
 * Updates the tags already in public/index.html (generated from config/brand.ts)
 * instead of adding new ones, so there is only ever one of each.
 */
export function usePageMeta(title: string, description: string) {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.title = title;
    document.documentElement.lang = i18n.language;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, [title, description, i18n.language]);
}
