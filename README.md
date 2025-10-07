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
