# Formatting Configuration - Quick Reference

## ✅ Implementation Complete

The RAG system now uses **centralized formatting configuration** for easy switching between WhatsApp and Markdown modes.

## 🚀 How to Switch Modes (1 Line!)

Open `src/lib/formattingConfig.js` and change line 11:

```javascript
export const FORMATTING_MODE = 'whatsapp'; // Change to 'markdown'
```

That's it! Restart your server and all responses will use the new format.

## 📁 Files Created/Modified

### New Files:
- `src/lib/formattingConfig.js` - Centralized formatting configuration
- `FORMATTING_MODE_GUIDE.md` - Detailed guide
- `FORMATTING_CONFIG_SUMMARY.md` - This file

### Modified Files:
- `src/lib/rag.js` - Now imports and uses formatting functions

## 🎯 Current Mode: WhatsApp

**Output Format:**
```
Here are the features:

• Automated scheduling
• Quick replies
• Bulk messaging

Visit https://example.com for more info.
```

**Formatting:**
- Bold: `*text*`
- Bullets: `•` or `-`
- Links: Full URLs (https://...)

## 🔄 Switching to Markdown

Change one line in `formattingConfig.js`:
```javascript
export const FORMATTING_MODE = 'markdown';
```

**Output will become:**
```
Here are the features:

- Automated scheduling
- Quick replies
- Bulk messaging

Visit [our website](https://example.com) for more info.
```

**Formatting:**
- Bold: `**text**`
- Bullets: `-` or `*`
- Links: `[text](url)`

## 🏗️ Architecture

```
formattingConfig.js (Configuration)
        ↓
    rag.js (Uses formatting functions)
        ↓
    AI Output (Formatted responses)
```

**Functions in formattingConfig.js:**
- `getFormattingInstructions()` - Rules for AI
- `getFormattingExamples()` - Example answers
- `getUrlFormattingInstructions()` - URL formatting
- `getFormattingInfo()` - Current mode info

## ✨ Benefits

✅ **One-line switch** - Change entire system formatting in one place  
✅ **Clean code** - Formatting separate from RAG logic  
✅ **Easy to extend** - Add Slack, Discord, etc. easily  
✅ **Maintainable** - All formatting rules in one file  
✅ **No scattered flags** - No need to search through code  

## 🧪 Testing

1. Change `FORMATTING_MODE` in `formattingConfig.js`
2. Restart server
3. Ask a test question
4. Verify formatting matches expected mode

## 📝 Adding New Modes

Want to add Slack formatting?

1. Add to `FORMATTING_RULES` in `formattingConfig.js`:
```javascript
slack: {
  name: 'Slack',
  bold: '*text*',
  bullet: '•',
  link: '<url|text>',
  description: 'Slack-compatible formatting'
}
```

2. Add case in `getFormattingInstructions()`
3. Add examples in `getFormattingExamples()`
4. Set `FORMATTING_MODE = 'slack'`

## 🎉 Summary

You now have a clean, maintainable formatting system that:
- Works with WhatsApp (current)
- Can switch to Markdown (one line)
- Can be extended to any platform
- Keeps RAG logic clean and focused

**To switch modes: Edit ONE line in `src/lib/formattingConfig.js`**
