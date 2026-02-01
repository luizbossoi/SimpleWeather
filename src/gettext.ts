/*
    Copyright 2025 Roman Lefler

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import GLib from "gi://GLib";

// Access gettext functions from globalThis (GJS runtime)
declare const globalThis: typeof global & {
    bindtextdomain?: (domain: string, location: string) => string;
    textdomain?: (domain: string) => string;
};

let gettextFn : ((str : string) => string) | undefined;
let localeDir : string | undefined;
let domain : string | undefined;
let currentLanguage : string = 'auto';
let translations : Map<string, string> = new Map();
let languageChangeCallbacks : (() => void)[] = [];

/**
 * Loads translation catalog for a specific language
 * @param languageCode - The language code to load
 */
function loadTranslations(languageCode: string): void {
    try {
        translations.clear();
        
        if (!localeDir || !domain || languageCode === 'auto') {
            return;
        }

        const localeVariations = [
            languageCode,
            `${languageCode}.UTF-8`,
            languageCode.split('_')[0]
        ];

        for (const locale of localeVariations) {
            try {
                const moPath = GLib.build_filenamev([localeDir, locale, 'LC_MESSAGES', `${domain}.mo`]);
                
                if (!moPath || !GLib.file_test(moPath, GLib.FileTest.EXISTS)) {
                    continue;
                }
                
                // Load .mo file and parse translations
                const [ok, contents] = GLib.file_get_contents(moPath);
                if (ok && contents) {
                    parseMoFile(contents, translations);
                    console.log(`[SimpleWeather] Loaded translations for ${locale}`);
                    return;
                }
            } catch (e) {
                // Continue trying other locale variations
                console.debug(`[SimpleWeather] Could not load translations for ${locale}:`, e);
            }
        }
        
        if (translations.size === 0) {
            console.debug(`[SimpleWeather] No translations found for ${languageCode}, using system default`);
        }
    } catch (e) {
        console.error('[SimpleWeather] Error in loadTranslations:', e);
    }
}

/**
 * Parses a .mo file and populates the translations map
 * @param contents - The raw .mo file contents
 * @param map - The map to populate with translations
 */
function parseMoFile(contents: Uint8Array, map: Map<string, string>): void {
    try {
        if (!contents || contents.length < 20) {
            throw new Error('Invalid MO file: too small');
        }
        
        // MO file format parser
        const view = new DataView(contents.buffer);
        const magic = view.getUint32(0, true);
        
        // Check magic number (0x950412de for little-endian, 0xde120495 for big-endian)
        const littleEndian = magic === 0x950412de;
        if (!littleEndian && magic !== 0xde120495) {
            throw new Error(`Invalid MO file magic number: 0x${magic.toString(16)}`);
        }
        
        const numStrings = view.getUint32(8, littleEndian);
        const origTableOffset = view.getUint32(12, littleEndian);
        const transTableOffset = view.getUint32(16, littleEndian);
        
        const decoder = new TextDecoder('utf-8');
        
        for (let i = 0; i < numStrings; i++) {
            try {
                // Read original string
                const origLength = view.getUint32(origTableOffset + i * 8, littleEndian);
                const origOffset = view.getUint32(origTableOffset + i * 8 + 4, littleEndian);
                
                if (origOffset + origLength > contents.length) {
                    continue; // Skip invalid entry
                }
                
                const origBytes = new Uint8Array(contents.buffer, origOffset, origLength);
                const original = decoder.decode(origBytes);
                
                // Read translated string
                const transLength = view.getUint32(transTableOffset + i * 8, littleEndian);
                const transOffset = view.getUint32(transTableOffset + i * 8 + 4, littleEndian);
                
                if (transOffset + transLength > contents.length) {
                    continue; // Skip invalid entry
                }
                
                const transBytes = new Uint8Array(contents.buffer, transOffset, transLength);
                const translated = decoder.decode(transBytes);
                
                if (original && translated) {
                    map.set(original, translated);
                }
            } catch (e) {
                // Skip this entry and continue with others
                console.debug(`[SimpleWeather] Error parsing MO entry ${i}:`, e);
            }
        }
    } catch (e) {
        console.error('[SimpleWeather] Error parsing MO file:', e);
        throw e;
    }
}

/**
 * Sets the language for the extension (internal control, no environment variables)
 * @param languageCode - The language code (e.g., 'pt_BR', 'es_ES', 'en')
 *                       or 'auto' to use system default
 */
export function setLanguage(languageCode: string): void {
    try {
        console.log(`[SimpleWeather] setLanguage called with: ${languageCode}`);
        const oldLanguage = currentLanguage;
        currentLanguage = languageCode;
        
        if (oldLanguage !== languageCode) {
            loadTranslations(languageCode);
            
            // Notify all listeners that language has changed
            languageChangeCallbacks.forEach(callback => {
                try {
                    callback();
                } catch (e) {
                    console.error('[SimpleWeather] Error in language change callback:', e);
                }
            });
        }
    } catch (e) {
        console.error('[SimpleWeather] Error in setLanguage:', e);
    }
}

/**
 * Register a callback to be called when language changes
 * @param callback - Function to call when language changes
 * @returns A function to unregister the callback
 */
export function onLanguageChange(callback: () => void): () => void {
    languageChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
        const index = languageChangeCallbacks.indexOf(callback);
        if (index > -1) {
            languageChangeCallbacks.splice(index, 1);
        }
    };
}

/**
 * Sets up the gettext abstraction.
 * Import the correct gettext for the process and pass it into here.
 * @param gettext - The gettext function to use
 * @param textLocaleDir - The directory containing locale files (optional)
 * @param textDomain - The gettext domain name (optional)
 */
export function setUpGettext(
    gettext : (str : string) => string,
    textLocaleDir? : string,
    textDomain? : string
) : void {
    gettextFn = gettext;
    localeDir = textLocaleDir;
    domain = textDomain;
}

/**
 * This is the normal GNU gettext function.
 * This function exists as an abstraction between the two imports for
 * extension.js and prefs.js, so the same code can be used in
 * both processes.
 */
export function gettext(str : string) : string {
    try {
        // If a custom language is set and we have translations, use them
        if (currentLanguage !== 'auto' && translations.has(str)) {
            return translations.get(str)!;
        }
        
        // Try to use the default gettext function (system locale)
        if (gettextFn) {
            try {
                return gettextFn(str);
            } catch (e) {
                // In prefs context, gettextFn might not work, just return original
                console.debug('[SimpleWeather] Fallback gettext not available, using original string');
            }
        }
    } catch (e) {
        console.error('[SimpleWeather] Error in gettext:', e);
    }
    
    // Final fallback: return the original string
    return str;
}

