# figma-tokens-flattener

A tool for transforming Ant Design tokens from Tokens Studio for Figma (Single file) into flat style mappings for light and dark themes.

## Installation

`npm install figma-tokens-flattener --save-dev`

## Create Configuration

Create a figma-tokens-flattener-config.json file in your project root:

```
{
    "source": {
        "tokensFile": "src/tokens/tokens.json" // path to the token file
    },
    "target": {
        "jsonsDir": "src/tokens" // path for the created files
    }
}
```

## Run Transformation

`npx simple-token-transformer flatten`

## Alternative Way (Recommended)

Add a script to your package.json:

```
{
    "scripts": {
        "flatten-tokens": "figma-tokens-flattener"
    }
}
```

And run with:

`npm run flatten-tokens`

## How It Works

1. Reading Tokens - The tool reads the JSON file exported from Tokens Studio for Figma

2. Theme Separation - Automatically splits tokens into light and dark themes

3. Flat Structure Transformation - Converts nested token structure into flat mapping

4. Result Saving - Creates separate JSON files for each theme

## Output

After running the command, the following files will be created in the target directory:

light.json - tokens for light theme

dark.json - tokens for dark theme

## Custom theme parsing

### The designer creates a new theme based on a light theme.

1. Make a duplicate of the light theme in figma
2. In the token studio plugin, place the actual colors at the positions alias, map, seed, colors
3. Upload as a single file
4. Upload custom variable colors via any tokens pro type token and remove unnecessary fields with a simple script

### frontend developer receives 2 files.

1. tokens.json (the usual cast of the theme from figma)
2. **\***\_variable.json file that contains the structure to be referenced from tokens.json
   the name must be strictly "**\***\_variable.json" ("example_variable.json", "sky_variable.json" etc.)
3. In tokens.json we will have json links (where needed):

```
"blue": {
   "1": {
   "value": "{Sky.core.blue.F5FAFE}",
   "type": "color"
   },
   }
```

4. In example_variable.json, we will have values along the link paths

```
{
    "Sky": {
        "core": {
            "blue": {
                "F5FAFE": {
                    "value": "#f5fafe",
                    "type": "color"
                }
            }
        }
    }
}
```
5. The variables file is located in the same directory as the token.json file. The values will be substituted and we will be able to get any custom theme.

This approach allows you to create any custom themes based on the bright standard antd theme.
