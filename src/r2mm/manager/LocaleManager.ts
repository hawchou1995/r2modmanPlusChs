import ManagerSettings from "./ManagerSettings";
import GameManager from '../../model/game/GameManager';
import { i18n } from '../../i18n/instance';

/** Used when a stored locale is missing, or is not a locale the manager ships. */
export const FALLBACK_LOCALE = 'en';

/**
 * Used before the user has explicitly picked a language.
 *
 * This fork ships Simplified Chinese as the out-of-the-box language, so a fresh
 * install starts in Chinese. Anyone who has already stored a locale keeps it.
 */
export const DEFAULT_LOCALE = 'zh-cn';

export default class LocaleManager {

    public static async apply() {
        const settings = await ManagerSettings.getSingleton(GameManager.activeGame);
        await settings.load();
        LocaleManager.set(await settings.getLocale());
    }

    public static async save(locale: string) {
        const settings = await ManagerSettings.getSingleton(GameManager.activeGame);
        await settings.setLocale(locale);
        LocaleManager.set(locale);
    }

    private static set(locale: string | undefined) {
        if (locale !== undefined && i18n.global.availableLocales.includes(locale)) {
            i18n.global.locale.value = locale;
            return;
        }

        if (locale === undefined && i18n.global.availableLocales.includes(DEFAULT_LOCALE)) {
            i18n.global.locale.value = DEFAULT_LOCALE;
            return;
        }

        i18n.global.locale.value = FALLBACK_LOCALE;
    }

}
