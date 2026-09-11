import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { locale as rootLocale } from 'next/root-params';
import { notFound } from 'next/navigation';
import { routing } from './routing';

export default getRequestConfig(async () => {
  const candidate = await rootLocale();

  if (!hasLocale(routing.locales, candidate)) {
    notFound();
  }

  return {
    locale: candidate,
    messages: (await import(`../messages/${candidate}.json`)).default,
  };
});
