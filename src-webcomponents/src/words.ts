/**
 * The words of the element in the language of the system. Only the words of this component are in its module: the
 * build picks them from the dictionary (`__TRIPS_WORDS__`, see `wordKeys.ts` and `vite.config.ts`).
 */
import type { ElementWordKey } from './wordKeys';

declare const __TRIPS_WORDS__: Record<string, Partial<Record<ElementWordKey, string>> | undefined>;

/** A word; every `%s` in it is replaced by the next argument */
export type Word = (key: ElementWordKey, ...args: (string | number)[]) => string;

/**
 * The words of one language, English where a word is missing
 *
 * @param lang the language of the system
 */
export function getWord(lang: string): Word {
    const words = __TRIPS_WORDS__[lang] || {};
    const english = __TRIPS_WORDS__.en || {};
    return (key, ...args) => {
        let text = words[key] || english[key] || key;
        for (const arg of args) {
            text = text.replace('%s', String(arg));
        }
        return text;
    };
}

/** The language for `Intl` and `toLocale...()` */
export function intlLang(lang: string): string {
    return lang === 'zh-cn' ? 'zh-CN' : lang || 'en';
}
