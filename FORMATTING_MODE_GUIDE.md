# Formatting Mode Configuration Guide

## Current Mode: WhatsApp Formatting

The RAG system uses a **centralized formatting configuration** in `src/lib/formattingConfig.js`.

## How to Switch Formatting Modes

### Quick Switch (1 Line Change!)

Open `src/lib/formattingConfig.js` and change line 11:

```javascript
// Current (WhatsApp mode)
export const FORMATTING_MODE = 'whatsapp';

// Change to (Markdown mode)
export const FORMATTING_MODE = 'markdown';
```

That's it! The entire system will automatically use the new formatting.

## Formatting Modes

### WhatsApp Mode (Current Default)

**Supported:**
- `*bold*` → **bold**
- `_italic_` → _italic_
- `~strikethrough~` → ~~strikethrough~~
- ``` `monospace` ``` → `monospace`
- Plain text bullets: • or -
- Plain text numbers: 1. 2. 3.
- Full URLs: https://example.com

**Example Output:**
```
Here are the features:

• Automated scheduling
• Quick replies
• Bulk messaging

Visit https://example.com for more info.
```

### Markdown Mode

**Supported:**
- `**bold**` → **bold**
- `_italic_` → _italic_
- `~~strikethrough~~` → ~~strikethrough~~
- ``` `monospace` ``` → `monospace`
- Markdown bullets: - or *
- Markdown numbers: 1. 2. 3.
- Clickable links: [text](url)

**Example Output:**
```
Here are the features:

- Automated scheduling
- Quick replies
- Bulk messaging

Visit [our website](https://example.com) for more info.
```

## Architecture

### Centralized Configuration
All formatting logic is in one file: `src/lib/formattingConfig.js`

**Functions:**
- `getFormattingInstructions()` - Returns formatting rules for AI
- `getFormattingExamples()` - Returns example answers
- `getUrlFormattingInstructions()` - Returns URL formatting rules
- `getFormattingInfo()` - Returns current mode info

### How It Works

1. **RAG imports formatting functions:**
   ```javascript
   import { getFormattingInstructions, getFormattingExamples, getUrlFormattingInstructions } from './formattingConfig.js';
   ```

2. **RAG uses them in system prompt:**
   ```javascript
   const formattingInstructions = getFormattingInstructions();
   const formattingExamples = getFormattingExamples();
   const urlInstructions = getUrlFormattingInstructions();
   
   const systemPrompt = `${roleSpecificPrompt}
   
   ${formattingInstructions}
   ${formattingExamples}
   ${urlInstructions}
   ...`;
   ```

3. **AI automatically follows the rules** based on current mode

## Adding New Formatting Modes

Want to add Slack, Discord, or other formats? Easy!

1. Open `src/lib/formattingConfig.js`
2. Add new mode to `FORMATTING_RULES`:
   ```javascript
   slack: {
     name: 'Slack',
     bold: '*text*',
     italic: '_text_',
     bullet: '•',
     link: '<url|text>',
     description: 'Slack-compatible formatting'
   }
   ```

3. Add formatting instructions in `getFormattingInstructions()`
4. Add examples in `getFormattingExamples()`
5. Change `FORMATTING_MODE = 'slack'`

## Files Modified

- `src/lib/formattingConfig.js` - NEW: Centralized formatting config
- `src/lib/rag.js` - Imports and uses formatting functions
- `FORMATTING_MODE_GUIDE.md` - This guide

## Benefits of This Approach

✅ **One-line switch** - Change mode in one place  
✅ **Clean separation** - Formatting logic separate from RAG logic  
✅ **Easy to extend** - Add new modes without touching RAG  
✅ **Type-safe** - All formatting in one file  
✅ **Maintainable** - No scattered formatting rules  

## Testing

After changing mode:
1. Restart your server
2. Ask a test question
3. Verify formatting matches expected mode
4. Check links, bullets, and bold text

## Notes

- The frontend (`ChatTab.tsx`) uses `react-markdown` which supports both modes
- WhatsApp mode is more restrictive but works everywhere
- Markdown mode provides richer formatting
- The core RAG logic (reasoning, context, etc.) is unchanged
- Only output formatting changes between modes
