import crypto from 'crypto';

/**
 * Smart URL filtering - skip low-value pages
 */
export function shouldSkipUrl(url) {
  const skipPatterns = [
    /\/tag\//i,
    /\/author\//i,
    /\/page\/\d+/i,
    /\/print\//i,
    /\/search/i,
    /\/category\//i,
    /\/archive\//i,
    /\/feed\//i,
    /\?.*page=/i,
    /\?.*sort=/i,
    /\?.*filter=/i,
    /\/wp-admin\//i,
    /\/admin\//i,
    /\.pdf$/i,
    /\.zip$/i,
    /\/cart\//i,
    /\/checkout\//i,
    /\/account\//i,
    /\/login/i,
    /\/register/i,
  ];
  return skipPatterns.some(p => p.test(url));
}

/**
 * Priority scoring for URLs - crawl important pages first
 */
export function getUrlPriority(url) {
  const highPriority = [
    /\/(about|services|products|pricing|contact|home)/i,
    /^https?:\/\/[^\/]+\/?$/,  // Homepage
  ];
  
  const mediumPriority = [
    /\/blog\/[^\/]+$/i,
    /\/news\//i,
    /\/solutions\//i,
    /\/features\//i,
  ];

  if (highPriority.some(p => p.test(url))) return 10;
  if (mediumPriority.some(p => p.test(url))) return 5;
  return 1;
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
 */
export function deduplicateChunks(chunks) {
  const seen = new Set();
  const unique = [];
  
  for (const chunk of chunks) {
    const signature = chunk.slice(0, 200).toLowerCase().replace(/\s+/g, ' ');
    
    if (!seen.has(signature) && chunk.length >= 100) {
      seen.add(signature);
      unique.push(chunk);
    }
  }
  
  console.log(`Deduplication: ${chunks.length} → ${unique.length} chunks (${Math.round((1 - unique.length/chunks.length) * 100)}% reduction)`);
  return unique;
}