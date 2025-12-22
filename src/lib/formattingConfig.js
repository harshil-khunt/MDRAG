/**
 * Formatting Configuration
 * 
 * Change FORMATTING_MODE to switch between different output formats
 * - 'whatsapp': WhatsApp-compatible formatting (limited markdown)
 * - 'markdown': Full Markdown formatting (for web, Slack, etc.)
 */

// ============================================================================
// CHANGE THIS LINE TO SWITCH FORMATTING MODE
// ============================================================================
export const FORMATTING_MODE = 'whatsapp'; // Options: 'whatsapp' | 'markdown'
// ============================================================================

/**
 * Formatting rules for each mode
 */
export const FORMATTING_RULES = {
  whatsapp: {
    name: 'WhatsApp',
    bold: '*text*',
    italic: '_text_',
    strikethrough: '~text~',
    code: '`code`',
    bullet: '•',
    link: 'https://example.com (full URL)',
    description: 'WhatsApp-compatible formatting with limited markdown support'
  },
  markdown: {
    name: 'Markdown',
    bold: '**text**',
    italic: '_text_',
    strikethrough: '~~text~~',
    code: '`code`',
    bullet: '-',
    link: '[text](url)',
    description: 'Full Markdown formatting with rich features'
  }
};

/**
 * Get formatting instructions for the AI prompt
 */
export function getFormattingInstructions() {
  const mode = FORMATTING_MODE;
  const rules = FORMATTING_RULES[mode];
  
  if (mode === 'whatsapp') {
    return `**FORMATTING RULES - WHATSAPP MODE**

Write like a human having a conversation using WhatsApp-compatible formatting:

**WhatsApp Formatting:**
- Use *bold* for emphasis: *important text*
- Use _italic_ for subtle emphasis: _note this_
- Use plain text for most content
- Use line breaks for structure
- Include full URLs (no markdown links): https://example.com
- Use • or - for bullet points (plain text, not markdown)
- Use 1. 2. 3. for numbered lists (plain text, not markdown)

**WHEN TO USE WHAT:**

Paragraphs (for simple, short answers):
- Contact info, pricing, simple explanations
- Example: "You can reach us at https://example.com/contact or email support@example.com. We typically respond within 24 hours."

Paragraphs + Bullet Points (for "What is" questions with multiple aspects):
- Intro paragraph explaining the concept
- Plain text bullets with • symbol
- Closing paragraph with offer to help
- Example: "Cyber forensics is the investigation of digital crimes. It involves:

• Data collection and preservation
• Analysis of digital evidence  
• Legal compliance and reporting

Overall, it helps solve cybercrimes and strengthen security."

Numbered Lists (for procedures):
- Step-by-step instructions with plain numbers
- Each step on new line
- Example: "To reset your password:

1. Go to Settings
2. Click *Forgot Password*
3. Check your email for reset link

Let me know if you need help!"

**KEY RULES:**
- Use • bullets to highlight main points when there are multiple key aspects
- Use *bold* to emphasize important terms or steps
- Always include full URLs (https://...)
- Keep formatting simple and WhatsApp-compatible`;
  } else {
    return `**FORMATTING RULES - MARKDOWN MODE**

Write like a human having a conversation using full Markdown formatting:

**Markdown Formatting:**
- Use **bold** for emphasis: **important text**
- Use _italic_ for subtle emphasis: _note this_
- Use line breaks for structure
- Use [text](url) for clickable links
- Use - or * for markdown bullet points
- Use 1. 2. 3. for numbered lists

**WHEN TO USE WHAT:**

Paragraphs (for simple, short answers):
- Contact info, pricing, simple explanations
- Example: "You can reach us at [our contact page](https://example.com/contact) or email support@example.com. We typically respond within 24 hours."

Paragraphs + Bullet Points (for "What is" questions with multiple aspects):
- Intro paragraph explaining the concept
- Markdown bullets with - or *
- Closing paragraph with offer to help
- Example: "Cyber forensics is the investigation of digital crimes. It involves:

- Data collection and preservation
- Analysis of digital evidence  
- Legal compliance and reporting

Overall, it helps solve cybercrimes and strengthen security."

Numbered Lists (for procedures):
- Step-by-step instructions with numbers
- Each step on new line
- Example: "To reset your password:

1. Go to Settings
2. Click **Forgot Password**
3. Check your email for reset link

Let me know if you need help!"

**KEY RULES:**
- Use - bullets to highlight main points when there are multiple key aspects
- Use **bold** to emphasize important terms or steps
- Format links as [text](url) for clickability
- Use full Markdown features`;
  }
}

/**
 * Get example answers formatted for current mode
 */
export function getFormattingExamples() {
  const mode = FORMATTING_MODE;
  
  if (mode === 'whatsapp') {
    return `**ANSWER EXAMPLES - WHATSAPP FORMAT:**

Q: "What's the pricing?"
A: "We have two plans:

• *Monthly:* ₹249/month
• *Annual:* ₹2,490/year (saves you 17%)

Which one are you interested in? I can tell you more about what's included."

Q: "How do I contact support?"
A: "You can reach support through several channels:

• *Contact Page:* https://example.com/contact (submit a ticket)
• *Email:* support@example.com (24-hour response time)
• *Live Chat:* Available on website during business hours

The quickest way is through the contact page. Is there something specific I can help you with?"

Q: "How do I install the extension?"
A: "To install the extension, follow these steps:

1. Open the official installation link: https://go.example.com/install
2. Choose your browser (Chrome, Edge, or Firefox)
3. Click *Add Extension* or *Install*
4. Follow the prompts to complete installation

Once installed, open WhatsApp Web to activate it. Need help with anything else?"`;
  } else {
    return `**ANSWER EXAMPLES - MARKDOWN FORMAT:**

Q: "What's the pricing?"
A: "We have two plans:

- **Monthly:** ₹249/month
- **Annual:** ₹2,490/year (saves you 17%)

Which one are you interested in? I can tell you more about what's included."

Q: "How do I contact support?"
A: "You can reach support through several channels:

- **Contact Page:** [Submit a ticket](https://example.com/contact)
- **Email:** support@example.com (24-hour response time)
- **Live Chat:** Available on website during business hours

The quickest way is through the [contact page](https://example.com/contact). Is there something specific I can help you with?"

Q: "How do I install the extension?"
A: "To install the extension, follow these steps:

1. Open the [official installation link](https://go.example.com/install)
2. Choose your browser (Chrome, Edge, or Firefox)
3. Click **Add Extension** or **Install**
4. Follow the prompts to complete installation

Once installed, open WhatsApp Web to activate it. Need help with anything else?"`;
  }
}

/**
 * Get URL formatting instructions
 */
export function getUrlFormattingInstructions() {
  const mode = FORMATTING_MODE;
  
  if (mode === 'whatsapp') {
    return `**URL FORMATTING:**
- Always include full URLs when mentioned in content
- Format: Plain text with full URL (https://...)
- Examples:
  - "Visit our website at https://example.com to purchase"
  - "Download from this link: https://go.example.com/download"
  - "Install the extension: https://go.wawf.app/Install"
- NEVER say "visit the official website" without including the actual URL`;
  } else {
    return `**URL FORMATTING:**
- Always include URLs when mentioned in content
- Format: [descriptive text](https://actual-url.com)
- Examples:
  - "Visit [our website](https://example.com) to purchase"
  - "Download from [this link](https://go.example.com/download)"
  - "Install the extension: [Install Link](https://go.wawf.app/Install)"
- NEVER say "visit the official website" without including the actual URL`;
  }
}

/**
 * Get current formatting mode info
 */
export function getFormattingInfo() {
  const mode = FORMATTING_MODE;
  const rules = FORMATTING_RULES[mode];
  
  return {
    mode,
    name: rules.name,
    description: rules.description,
    rules: rules
  };
}
