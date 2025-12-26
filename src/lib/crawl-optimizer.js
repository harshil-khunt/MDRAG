import crypto from 'crypto';

/**
 * Smart URL filtering - skip low-value and irrelevant pages
 * Focus on core content pages that users actually care about
 */
export function shouldSkipUrl(url) {
  const skipPatterns = [
    // Blog & News (usually not core product info)
    /\/blog\//i,
    /\/news\//i,
    /\/article\//i,
    /\/post\//i,
    /\/press\//i,
    /\/media\//i,
    /\/updates\//i,
    /\/announcements\//i,
    
    // Archives & Pagination
    /\/tag\//i,
    /\/author\//i,
    /\/page\/\d+/i,
    /\/category\//i,
    /\/archive\//i,
    /\/\d{4}\/\d{2}\//i, // Date-based URLs (2024/12/)
    /\?.*page=/i,
    /\?.*p=/i,
    
    // Technical & Admin
    /\/wp-admin\//i,
    /\/admin\//i,
    /\/wp-content\//i,
    /\/wp-includes\//i,
    /\/print\//i,
    /\/feed\//i,
    /\/rss/i,
    /\/api\//i,
    /\/ajax\//i,
    
    // E-commerce (usually not core info)
    /\/cart\//i,
    /\/checkout\//i,
    /\/account\//i,
    /\/my-account\//i,
    /\/wishlist\//i,
    /\/compare\//i,
    
    // Auth & User
    /\/login/i,
    /\/register/i,
    /\/signup/i,
    /\/signin/i,
    /\/logout/i,
    /\/password/i,
    
    // Search & Filters
    /\/search/i,
    /\?.*search=/i,
    /\?.*s=/i,
    /\?.*q=/i,
    /\?.*sort=/i,
    /\?.*filter=/i,
    /\?.*orderby=/i,
    
    // File Downloads
    /\.pdf$/i,
    /\.zip$/i,
    /\.doc$/i,
    /\.docx$/i,
    /\.xls$/i,
    /\.xlsx$/i,
    /\.ppt$/i,
    /\.pptx$/i,
    /\/download\//i,
    
    // Social & External
    /\/share\//i,
    /\/redirect\//i,
    /\/goto\//i,
    /\/out\//i,
    
    // Legal (usually boilerplate)
    /\/legal\//i,
    /\/disclaimer\//i,
    /\/cookies\//i,
    
    // Misc Low-Value
    /\/sitemap/i,
    /\/404/i,
    /\/error/i,
    /\/test/i,
    /\/demo/i,
    /\/sample/i,
  ];
  
  return skipPatterns.some(p => p.test(url)); 
}

/**
 * Priority scoring for URLs - crawl important pages first
 * Focus on pages users actually ask about
 */
export function getUrlPriority(url) {
  // HIGHEST PRIORITY - Core business pages users ask about
  const criticalPages = [
    /^https?:\/\/[^\/]+\/?$/,  // Homepage
    /\/(pricing|price|plans|cost)/i,
    /\/(features|capabilities|what-we-do)/i,
    /\/(products|services|solutions)/i,
    /\/(about|about-us|company)/i,
    /\/(contact|support|help)/i,
    /\/(faq|frequently-asked)/i,
    /\/(how-it-works|how-to|getting-started)/i,
    /\/(documentation|docs|api)/i,
  ];
  
  // HIGH PRIORITY - Important info pages
  const importantPages = [
    /\/(team|careers|jobs)/i,
    /\/(case-studies|customers|testimonials)/i,
    /\/(integrations|partners)/i,
    /\/(security|compliance)/i,
    /\/(terms|privacy)/i,
  ];
  
  // MEDIUM PRIORITY - Useful but not critical
  const usefulPages = [
    /\/(resources|guides|tutorials)/i,
    /\/(industries|use-cases)/i,
    /\/(comparison|vs-)/i,
  ];

  if (criticalPages.some(p => p.test(url))) return 100;
  if (importantPages.some(p => p.test(url))) return 50;
  if (usefulPages.some(p => p.test(url))) return 25;
  return 1; // Low priority - might skip if maxPages reached
}

/**
 * Content hash for deduplication
 */
export function hashContent(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Check if content is substantial enough to process
 */
export function isSubstantialContent(text) {
  if (!text || text.length < 200) return false;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  return sentences.length >= 3;
}

/**
 * Smart image filtering - skip non-content images
 */
export function shouldSkipImage(imgUrl, imgAlt = '') {
  const skipPatterns = [
    /logo/i,
    /icon/i,
    /avatar/i,
    /thumbnail/i,
    /banner/i,
    /social/i,
    /pixel/i,
    /spacer/i,
    /button/i,
    /arrow/i,
    /spinner/i,
    /loading/i,
    /1x1/i,
    /tracking/i,
    /\.svg$/i,
    /placeholder/i,
    /background/i,
  ];
  const combined = (imgUrl + ' ' + imgAlt).toLowerCase();
  return skipPatterns.some(p => p.test(combined));
}

/**
 * Clean and normalize text - remove boilerplate
 */
export function cleanText(text) {
  const boilerplate = [
    /©\s*\d{4}.*?all rights reserved/gi,
    /privacy policy|terms of service|cookie policy/gi,
    /follow us on|social media/gi,
    /subscribe to our newsletter/gi,
  ];
  
  let cleaned = text;
  boilerplate.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned
    .replace(/\s+/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

/**
 * Deduplicate chunks based on content similarity
 * Less aggressive - only remove truly identical chunks
 */
export function deduplicateChunks(chunks) {
  const seen = new Set();
  const unique = [];
  
  for (const chunk of chunks) {
    // Use more of the chunk for signature (500 chars instead of 200)
    // This prevents removing chunks that start similarly but have different content
    const signature = chunk.slice(0, 500).toLowerCase().replace(/\s+/g, ' ');
    
    if (!seen.has(signature) && chunk.length >= 100) {
      seen.add(signature);
      unique.push(chunk);
    }
  }
  
  const reductionPercent = chunks.length > 0 ? Math.round((1 - unique.length/chunks.length) * 100) : 0;
  console.log(`Deduplication: ${chunks.length} → ${unique.length} chunks (${reductionPercent}% reduction)`);
  return unique;
}