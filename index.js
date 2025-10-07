#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/* Color */
function flattenColorGroups(colorGroups) {
    const flattened = {};
    if (!colorGroups || typeof colorGroups !== 'object') {
        console.warn('An object with groups of colors was expected, but received:', colorGroups);
        return flattened;
    }

    Object.keys(colorGroups).forEach(groupName => {
        const shades = colorGroups[groupName];
        if (shades && typeof shades === 'object') {
            Object.keys(shades).forEach(shadeKey => {
                const shadeObj = shades[shadeKey];
                if (shadeObj && typeof shadeObj === 'object' && shadeObj.hasOwnProperty('value')) {
                    const flatKey = `${groupName}.${shadeKey}`;
                    flattened[flatKey] = shadeObj.value.toLowerCase();
                } else {
                    console.warn(`The wrong structure for the color ${groupName}.${shadeKey}:`, shadeObj);
                }
            })
        } else {
            console.warn(`The wrong structure for a group of colors ${groupName}:`, shades);
        }
    })
    return flattened;
}

/* Seed */
function flattenSeedTokens(seedTokens) {
    const flattened = {};
    if (!seedTokens || typeof seedTokens !== 'object') {
        console.warn('An object with seed tokens was expected, but received:', seedTokens);
        return flattened;
    }


    Object.keys(seedTokens).forEach(tokenName => {
        const tokenObj = seedTokens[tokenName];

        if (!tokenObj || typeof tokenObj !== 'object') {
            console.warn(`Incorrect structure for the seed token ${tokenName}:`, tokenObj);
            return;
        }

        let valueToUse;

        if (Object.hasOwn(tokenObj, 'value') && typeof tokenObj.value === 'object' && tokenObj.value !== null && Object.hasOwn(tokenObj.value, 'style')) {
            valueToUse = tokenObj.value.style;
        }

        else if (Object.hasOwn(tokenObj, 'value')) {
            valueToUse = tokenObj.value;
        }

        else if (Object.hasOwn(tokenObj, 'style') && tokenObj.style && typeof tokenObj.style === 'object' && Object.hasOwn(tokenObj.style, 'value')) {
            valueToUse = tokenObj.style.value;
        }

        else {
            console.warn(`Unsupported structure for the seed token ${tokenName}:`, tokenObj);
            return;
        }

        if (typeof valueToUse === 'string' && !isNaN(valueToUse) && !isNaN(parseFloat(valueToUse))) {
            if (Number.isInteger(parseFloat(valueToUse))) {
                valueToUse = parseInt(valueToUse, 10);
            } else {
                valueToUse = parseFloat(valueToUse);
            }
        }

        flattened[tokenName] = valueToUse;
    })

    return flattened;
}

/* Map */
function hexToRgb(hex) {
    if (typeof hex !== 'string') return hex;
    const hexMatch = hex.trim().toLowerCase().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!hexMatch) return hex;
    let hexValue = hexMatch[1];
    if (hexValue.length === 3) {
        hexValue = hexValue.split('').map(ch => ch + ch).join('');
    }
    const r = parseInt(hexValue.slice(0, 2), 16);
    const g = parseInt(hexValue.slice(2, 4), 16);
    const b = parseInt(hexValue.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
}

function flattenMapTokens(value, seedContext) {
    if (typeof value !== 'string') return value;
    const str = value.trim();

    const NAME = '[a-zA-Z_][\\w.-]*';
    const TOKEN_RE = new RegExp('(\\{(' + NAME + ')\\})|\\$(' + NAME + ')', 'g');
    const SINGLE_TOKEN_BRACED = new RegExp('^\\{(' + NAME + ')\\}$');
    const RGBA_RE = /^rgba\s*\((.*)\)\s*$/i;

    const isHex = (colorString) => typeof colorString === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(colorString);

    const getTokenValue = (name) =>
        Object.prototype.hasOwnProperty.call(seedContext, name) ? seedContext[name] : undefined;

    // {token} — return the token value as it is
    const tokenMatch = str.match(SINGLE_TOKEN_BRACED);
    if (tokenMatch) {
        const tokenValue = getTokenValue(tokenMatch[1]);
        return tokenValue !== undefined ? tokenValue : str;
    }

    // rgba
    const rgbaMatch = str.match(RGBA_RE);
    if (rgbaMatch) {
        const inside = rgbaMatch[1];
        const replaced = inside.replace(TOKEN_RE, (match, _g1, nameBraced) => {
            const name = nameBraced;
            const tokenValue = getTokenValue(name);
            if (tokenValue === undefined) return match;
            if (isHex(tokenValue)) return String(hexToRgb(tokenValue)); // "r, g, b"
            return String(tokenValue);
        });
        return 'rgba(' + replaced + ')';
    }

    // An attempt to calculate an arithmetic expression
    let hadUnknown = false;
    let hadNonNumeric = false;

    const expressionWithResolvedTokens = str.replace(TOKEN_RE, (match, _g1, tokenName) => {
        const tokenValue = getTokenValue(tokenName);
        if (tokenValue === undefined) {
            hadUnknown = true;
            return match;
        }
        if (typeof tokenValue === 'number') return String(tokenValue);

        const numericValue = typeof tokenValue === 'string' ? Number(tokenValue) : NaN;
        if (Number.isFinite(numericValue)) return String(numericValue);

        hadNonNumeric = true;
        return match;
    })

    if (!hadUnknown && !hadNonNumeric) {
        if (/[^0-9+\-*/().\s]/.test(expressionWithResolvedTokens)) {
            return str;
        }
        try {
            const result = Function('"use strict"; return (' + expressionWithResolvedTokens + ');')();
            return Number.isFinite(result) ? result : str;
        } catch {
            return str;
        }
    }

    // Universal substitution of tokens in any string
    const generic = str.replace(TOKEN_RE, (match, g1, tokenName) => {
        const tokenValue = getTokenValue(tokenName);
        if (tokenValue === undefined) return match;
        if (isHex(tokenValue)) return 'rgb(' + hexToRgb(tokenValue) + ')';
        return String(tokenValue);
    });

    return generic;
}

function flattenMapTokensWrapper(mapTokens, seedContext) {
    const flattened = {};
    if (!mapTokens || typeof mapTokens !== 'object') {
        console.warn('An object with map tokens was expected, but received:', mapTokens);
        return flattened;
    }

    Object.keys(mapTokens).forEach(tokenName => {
        const tokenContent = mapTokens[tokenName];

        if (tokenContent && typeof tokenContent === 'object' && tokenContent.hasOwnProperty('value')) {
            const rawValue = tokenContent.value;

            const computedValue = flattenMapTokens(rawValue, seedContext);
            flattened[tokenName] = computedValue;
        } else {
            console.warn(`Incorrect structure for the map token ${tokenName}:`, tokenContent);
        }
    })
    return flattened;
}

/* Alias */

function processSingleShadow(shadowDef, contextTokens) {
    if (!shadowDef || typeof shadowDef !== 'object') {
        return undefined;
    }

    if (typeof shadowDef.x === 'undefined' || typeof shadowDef.y === 'undefined' || typeof shadowDef.color === 'undefined') {
        console.warn('Invalid shadow structure, missing x, y or color:', shadowDef);
        return undefined;
    }

    const x = flattenMapTokens(shadowDef.x, contextTokens);
    const y = flattenMapTokens(shadowDef.y, contextTokens);
    const blur = flattenMapTokens(shadowDef.blur || '0', contextTokens);
    const spread = flattenMapTokens(shadowDef.spread || '0', contextTokens);
    const color = flattenMapTokens(shadowDef.color, contextTokens);

    if (typeof x !== 'number' || typeof y !== 'number' || typeof blur !== 'number' || typeof spread !== 'number' || typeof color !== 'string') {
        console.warn(`Invalid value type in shadow: x=${x}(${typeof x}), y=${y}(${typeof y}), blur=${blur}(${typeof blur}), spread=${spread}(${typeof spread}), color=${color}(${typeof color})`);
        return undefined;
    }

    // Forming a line for one shadow
    return `${x}px ${y}px ${blur}px ${spread}px ${color}`;
}

function processBoxShadow(shadowData, contextTokens) {
    let shadowsArray;

    if (Array.isArray(shadowData)) {
        // This is an array of shadows
        shadowsArray = shadowData;
    } else if (typeof shadowData === 'object' && shadowData !== null) {
        // This is a single shadow object
        shadowsArray = [shadowData];
    } else {
        console.warn('Expected array or shadow object, received::', shadowData);
        return undefined;
    }

    const processedShadows = [];
    for (const shadowDef of shadowsArray) {
        const shadowString = processSingleShadow(shadowDef, contextTokens);
        if (shadowString) {
            processedShadows.push(shadowString);
        }
    }

    if (processedShadows.length === 0) {
        return undefined;
    }

    // Combining all the shadow lines into one boxShadow line
    return processedShadows.join(', ');
}

function flattenAliasTokens(aliasTokens, contextTokens) {
    const flattened = {};
    if (!aliasTokens || typeof aliasTokens !== 'object') {
        console.warn('An object with alias tokens was expected, but received:', aliasTokens);
        return flattened;
    }

    Object.keys(aliasTokens).forEach((tokenName) => {
        const tokenContent = aliasTokens[tokenName];

        if (tokenName[0] === tokenName[0].toUpperCase()) {
            return;
        }

        if (tokenContent && typeof tokenContent === 'object' && Object.hasOwn(tokenContent, 'value')) {
            if (
                (Array.isArray(tokenContent.value) && tokenContent.value.length > 0) ||
                (typeof tokenContent.value === 'object' && tokenContent.value !== null && Object.hasOwn(tokenContent.value, 'x'))
            ) {
                const boxShadowValue = processBoxShadow(tokenContent.value, contextTokens);
                if (boxShadowValue !== undefined) {
                    flattened[tokenName] = boxShadowValue;
                } else {
                    console.warn(`${tokenName}: The boxShadow structure could not be processed.`, tokenContent.value);
                }
            }
            else {
                const rawValue = tokenContent.value;
                const processedValue = flattenMapTokens(rawValue, contextTokens);
                flattened[tokenName] = processedValue;
            }
        } else {
            console.warn(`Unsupported structure for alias token ${tokenName}:`, tokenContent);
        }
    });

    return flattened;
}

function checkAndResolveVarValues(contextTokens) {
    const resolved = {};

    Object.keys(contextTokens).forEach(tokenName => {
        const TOKEN_RE = /(\{([\w.-]+)\})|\$([\w.-]+)/g;
        const currentValue = contextTokens[tokenName];

        // Checking whether the value is a string containing a raw token.
        if (typeof currentValue === 'string' && TOKEN_RE.test(currentValue)) {
            const recomputedValue = flattenMapTokens(currentValue, contextTokens);

            // If the value has changed after repeated calculation, update it.
            if (recomputedValue !== currentValue) {
                resolved[tokenName] = recomputedValue;
            }
        }
    })
    return resolved;
};

/* DefaultValues */
function flattenDefaultValueTokens(defaultTokens) {
    if (!defaultTokens || typeof defaultTokens !== 'object') return {};

    const resolved = {};

    // 1) Basic numeric values
    for (const [name, token] of Object.entries(defaultTokens)) {
        if (token && typeof token === 'object' && Object.prototype.hasOwnProperty.call(token, 'value')) {
            const val = token.value;
            if (typeof val === 'number' && Number.isFinite(val)) {
                resolved[name] = val;
            }
        }
    }

    const extractRefKey = (value) => {
        if (typeof value !== 'string') return null;
        const tokenMatch = value.match(/^\s*\{([^}]+)\}\s*$/);
        return tokenMatch ? tokenMatch[1].trim() : null;
    };

    // 2) Iterative resolution of "{key}" links
    const maxRounds = Object.keys(defaultTokens).length + 5; // защита от циклов
    for (let round = 0; round < maxRounds; round++) {
        let changed = false;

        for (const [name, token] of Object.entries(defaultTokens)) {
            if (!token || typeof token !== 'object' || !Object.prototype.hasOwnProperty.call(token, 'value')) continue;

            const val = token.value;

            if (typeof val === 'number' && Number.isFinite(val)) {
                if (resolved[name] !== val) {
                    resolved[name] = val;
                    changed = true;
                }
                continue;
            }

            const refKey = extractRefKey(val);
            if (!refKey) continue;

            if (Object.prototype.hasOwnProperty.call(resolved, refKey)) {
                const num = resolved[refKey];
                if (typeof num === 'number' && Number.isFinite(num) && resolved[name] !== num) {
                    resolved[name] = num;
                    changed = true;
                }
            }
        }

        if (!changed) break;
    }

    // 3) Returning numeric values only
    const numericTokens = {};
    for (const [tokenName, tokenValue] of Object.entries(resolved)) {
        if (typeof tokenValue === 'number' && Number.isFinite(tokenValue)) numericTokens[tokenName] = tokenValue;
    }
    return numericTokens;
}

/* Components */
function flattenComponentsTokens(componentsTokens, contextTokens) {
    const flattened = {};
    if (!componentsTokens || typeof componentsTokens !== 'object') {
        console.warn('An object with components tokens was expected, but received:', componentsTokens);
        return flattened;
    }

    Object.keys(componentsTokens).forEach(componentName => {
        const componentTokens = componentsTokens[componentName];
        if (!componentTokens || typeof componentTokens !== 'object') {
            console.warn(`Incorrect structure for the component ${componentName}:`, componentTokens);
            return;
        }

        // Processing tokens for one component
        const processedComponentTokens = {};
        Object.keys(componentTokens).forEach(tokenName => {
            const tokenDefinition = componentTokens[tokenName];

            if (tokenDefinition && typeof tokenDefinition === 'object' && Object.hasOwn(tokenDefinition, 'value')) {
                const rawValue = tokenDefinition.value;

                const processedValue = flattenMapTokens(rawValue, contextTokens);
                processedComponentTokens[tokenName] = processedValue;
            } else {
                console.warn(`Unsupported token structure ${componentName}.${tokenName}:`, tokenDefinition);
            }
        })

        // Adding the processed component tokens to the final object
        flattened[componentName] = processedComponentTokens;
    })

    return flattened;
}

function flatten() {
    const configFilePath = path.resolve('./figma-tokens-flattener-config.json');
    let config = {};

    try {
        const configContent = fs.readFileSync(configFilePath, 'utf-8');
        config = JSON.parse(configContent);
    } catch (configError) {
        if (configError.code === 'ENOENT') {
            console.log('The configuration file is figma-tokens-flattener-config.json was not found. We use the path - the root directory.');
        } else {
            console.error('Error when reading or parsing the configuration file:', configError.message);
            // Continue with an empty configuration, by default
        }
    }

    const inputFilePath = path.resolve(config.source?.tokensFile || './tokens.json');
    const outputDir = path.resolve(config.target?.jsonsDir || './'); // Save it to the current default directory

    const baseKeys = ['colors', 'seed', 'map', 'alias', 'components']; // The keys we need from the original token

    try {
        const fileContent = fs.readFileSync(inputFilePath, 'utf-8');
        const allTokensData = JSON.parse(fileContent);

        let lightTokens = {};
        let darkTokens = {};

        for (const baseKey of baseKeys) {
            const lightFullKey = `light/${baseKey}`;
            const darkFullKey = `dark/${baseKey}`;
            const lightDefaultKey = `Default/Light`;
            const darkDefaultKey = `Default/Dark`;

            //  _____________________________Обработка light токенов
            if (allTokensData.hasOwnProperty(lightFullKey)) {
                // Special processing transformation of each collection into a flat structure

                if (baseKey === 'colors') {
                    const flattenedColors = flattenColorGroups(allTokensData[lightFullKey]);
                    lightTokens = { ...lightTokens, ...flattenedColors }; // Объединяем с существующими токенами
                }
                else if (baseKey === 'seed') {
                    const flattenedSeeds = flattenSeedTokens(allTokensData[lightFullKey]);
                    lightTokens = { ...lightTokens, ...flattenedSeeds };
                }
                else if (baseKey === 'map') {
                    const flattenedMaps = flattenMapTokensWrapper(allTokensData[lightFullKey], lightTokens);
                    lightTokens = { ...lightTokens, ...flattenedMaps };
                }
                else if (baseKey === 'alias') {
                    const flattenedAliases = flattenAliasTokens(allTokensData[lightFullKey], lightTokens);
                    lightTokens = { ...lightTokens, ...flattenedAliases };
                    const resolved = checkAndResolveVarValues(lightTokens);
                    lightTokens = { ...lightTokens, ...resolved };
                }
                else if (baseKey === 'components') {
                    // We add the remaining default values. They may have nesting, so we put everything in a flat structure.
                    const flattenDefaultValues = flattenDefaultValueTokens(allTokensData[lightDefaultKey]);
                    lightTokens = { ...flattenDefaultValues, ...lightTokens };

                    const flattenedComponents = flattenComponentsTokens(allTokensData[lightFullKey], lightTokens);
                    lightTokens = { ...lightTokens, components: flattenedComponents };
                }
            } else {
                console.warn(`Collection not found, collection key: ${lightFullKey}`);
            }

            // _____________________________Обработка dark токенов
            if (allTokensData.hasOwnProperty(darkFullKey)) {

                if (baseKey === 'colors') {
                    const flattenedColors = flattenColorGroups(allTokensData[darkFullKey]);
                    darkTokens = { ...darkTokens, ...flattenedColors };
                } else if (baseKey === 'seed') {
                    const flattenedSeeds = flattenSeedTokens(allTokensData[darkFullKey]);
                    darkTokens = { ...darkTokens, ...flattenedSeeds };
                }
                else if (baseKey === 'map') {
                    const flattenedMaps = flattenMapTokensWrapper(allTokensData[darkFullKey], darkTokens);
                    darkTokens = { ...darkTokens, ...flattenedMaps };
                }
                else if (baseKey === 'alias') {
                    const flattenedAliases = flattenAliasTokens(allTokensData[darkFullKey], darkTokens);
                    darkTokens = { ...darkTokens, ...flattenedAliases };
                    const resolved = checkAndResolveVarValues(darkTokens);
                    darkTokens = { ...darkTokens, ...resolved };
                }
                else if (baseKey === 'components') {
                    // We add the remaining default values. They may have nesting, so we put everything in a flat structure.
                    const flattenDefaultValues = flattenDefaultValueTokens(allTokensData[darkDefaultKey]);
                    darkTokens = { ...flattenDefaultValues, ...darkTokens };

                    const flattenedComponents = flattenComponentsTokens(allTokensData[darkFullKey], darkTokens);
                    darkTokens = { ...darkTokens, components: flattenedComponents };
                }
            } else {
                console.warn(`Collection not found, collection key: ${darkFullKey}`);
            }
        }

        const lightOutputPath = path.join(outputDir, 'light.json');
        const darkOutputPath = path.join(outputDir, 'dark.json');

        console.log(`Saving light and dark tokens in: ${outputDir}`);
        fs.writeFileSync(lightOutputPath, JSON.stringify(lightTokens, null, 2));

        fs.writeFileSync(darkOutputPath, JSON.stringify(darkTokens, null, 2));

        console.log('\nReady! Light files.json and dark.json files have been created.');

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: The tokens file.json was not found on the path ${inputFilePath}`);
        } else if (error instanceof SyntaxError) {
            console.error('Error: The contents of the tokens file.json is not valid JSON.');
            console.error(error.message);
        } else {
            console.error('Error when reading or parsing the tokens.json file:', error.message);
        }
    }
};

// module.exports = {
//     flatten
// };

flatten();