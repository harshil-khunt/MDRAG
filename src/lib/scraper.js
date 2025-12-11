import axios from 'axios';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import { extname } from 'path';
import { CheerioCrawler } from 'crawlee';
import { parseStringPromise } from 'xml2js';
import Tesseract from 'tesseract.js';
import {
  shouldSkipUrl,
  getUrlPriority,
  hashContent,
  isSubstantialContent,
  shouldSkipImage,
  cleanText
} from './crawl-optimizer.js';

/**
 * Fetch a URL and return a Buffer and content-type.
 */
export async function fetchUrlBuffer(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', maxContentLength: 50 * 1024 * 1024 });
  const contentType = resp.headers['content-type'] || '';
  return { buffer: Buffer.from(resp.data), contentType };
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPdfBuffer(buffer) {
  const res = await pdfParse(buffer);
  return res.text || '';
}

/**
 * Extract text from docx buffer (mammoth)
 */
export async function extractTextFromDocxBuffer(buffer) {
  const res = await mammoth.extractRawText({ buffer });
  return res.value || '';
}

/**
 * Extract text from HTML buffer (cheerio)
 */
export async function extractTextFromHtmlBuffer(buffer) {
  const html = buffer.toString('utf8');
  const $ = cheerio.load(html);
  // simple strategy: grab body text, collapse whitespace
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Extract image URLs from HTML
 */
export function extractImageUrlsFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const images = new Set();

  $('img[src]').each((_, element) => {
    try {
      const src = $(element).attr('src');
      if (!src) return;

      // Convert relative URLs to absolute
      const absoluteUrl = new URL(src, baseUrl).href;
      const urlObj = new URL(absoluteUrl);

      // Skip data URLs and external images from different domains
      if (urlObj.protocol === 'data:') return;
      
      // Only include images that are likely to be image formats
      const ext = urlObj.pathname.toLowerCase();
      if (ext.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)) {
        images.add(absoluteUrl);
      }
    } catch (e) {
      // Invalid URL, skip
    }
  });

  return Array.from(images);
}

/**
 * Extract text from image using OCR (Tesseract.js)
 */
export async function extractTextFromImage(imageUrl) {
  try {
    console.log(`Running OCR on image: ${imageUrl}`);
    
    const { data: { text } } = await Tesseract.recognize(
      imageUrl,
      'eng', // English language
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );

    const cleanedText = text.replace(/\s+/g, ' ').trim();
    console.log(`OCR extracted ${cleanedText.length} characters from ${imageUrl}`);
    return cleanedText;
  } catch (error) {
    console.error(`OCR failed for ${imageUrl}:`, error.message);
    return '';
  }
}

/**
 * Extract all internal links from HTML
 */
export function extractLinksFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const links = new Set();
  const baseDomain = new URL(baseUrl).hostname;

  $('a[href]').each((_, element) => {
    try {
      const href = $(element).attr('href');
      if (!href) return;

      // Convert relative URLs to absolute
      const absoluteUrl = new URL(href, baseUrl).href;
      const urlObj = new URL(absoluteUrl);

      // Only include links from the same domain
      if (urlObj.hostname === baseDomain) {
        // Remove hash and query params for deduplication
        const cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
        links.add(cleanUrl);
      }
    } catch (e) {
      // Invalid URL, skip
    }
  });

  return Array.from(links);
}

/**
 * Fetch and parse sitemap.xml from a domain
 * Returns array of URLs found in the sitemap
 */
export async function parseSitemap(baseUrl) {
  try {
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
    console.log(`Fetching sitemap from ${sitemapUrl}`);
    
    const resp = await axios.get(sitemapUrl, { 
      timeout: 10000,
      validateStatus: (status) => status === 200 
    });
    
    const result = await parseStringPromise(resp.data);
    const urls = [];

    // Handle standard sitemap format
    if (result.urlset && result.urlset.url) {
      for (const entry of result.urlset.url) {
        if (entry.loc && entry.loc[0]) {
          urls.push(entry.loc[0]);
        }
      }
    }

    // Handle sitemap index (multiple sitemaps)
    if (result.sitemapindex && result.sitemapindex.sitemap) {
      for (const sitemapEntry of result.sitemapindex.sitemap) {
        if (sitemapEntry.loc && sitemapEntry.loc[0]) {
          // Recursively fetch nested sitemaps
          try {
            const nestedResp = await axios.get(sitemapEntry.loc[0], { timeout: 10000 });
            const nestedResult = await parseStringPromise(nestedResp.data);
            if (nestedResult.urlset && nestedResult.urlset.url) {
              for (const entry of nestedResult.urlset.url) {
                if (entry.loc && entry.loc[0]) {
                  urls.push(entry.loc[0]);
                }
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch nested sitemap ${sitemapEntry.loc[0]}:`, e.message);
          }
        }
      }
    }

    console.log(`Found ${urls.length} URLs in sitemap`);
    return urls;
  } catch (error) {
    console.log(`No sitemap found or failed to parse: ${error.message}`);
    return [];
  }
}

/**
 * Crawl an entire domain using Crawlee with smart optimizations
 * Returns array of { url, text } objects
 * @param {boolean} enableOcr - Whether to extract text from images using OCR
 */
export async function crawlDomain(startUrl, maxPages = 100, maxDepth = 3, enableOcr = false) {
  const results = [];
  const baseDomain = new URL(startUrl).hostname;
  const seenHashes = new Set(); // Track content hashes for deduplication
  const maxOcrImages = 20; // Hard limit on OCR images
  let ocrImageCount = 0;

  // First try to get URLs from sitemap
  const sitemapUrls = await parseSitemap(startUrl);
  
  if (sitemapUrls.length > 0) {
    console.log(`Using sitemap with ${sitemapUrls.length} URLs. Processing up to ${maxPages} pages.`);
    
    // Filter and prioritize URLs
    const filteredUrls = sitemapUrls
      .filter(url => !shouldSkipUrl(url))
      .sort((a, b) => getUrlPriority(b) - getUrlPriority(a))
      .slice(0, maxPages);
    
    const skippedCount = sitemapUrls.length - filteredUrls.length;
    console.log(`Filtered out ${skippedCount} low-value URLs. Processing ${filteredUrls.length} URLs.`);
    
    for (let i = 0; i < filteredUrls.length; i++) {
      const url = filteredUrls[i];
      try {
        console.log(`Fetching [${i + 1}/${filteredUrls.length}]: ${url}`);
        
        const { buffer, contentType } = await fetchUrlBuffer(url);
        
        // Extract text based on content type
        let text = '';
        if (contentType.includes('html')) {
          text = await extractTextFromHtmlBuffer(buffer);
          
          // Clean and validate content
          text = cleanText(text);
          if (!isSubstantialContent(text)) {
            console.log(`Skipping ${url} - insufficient content`);
            continue;
          }
          
          // Check for duplicate content
          const contentHash = hashContent(text);
          if (seenHashes.has(contentHash)) {
            console.log(`Skipping ${url} - duplicate content`);
            continue;
          }
          seenHashes.add(contentHash);
          
          // Extract text from images if OCR is enabled
          if (enableOcr && ocrImageCount < maxOcrImages) {
            const html = buffer.toString('utf8');
            const imageUrls = extractImageUrlsFromHtml(html, url)
              .filter(imgUrl => !shouldSkipImage(imgUrl));
            
            const imagesToProcess = Math.min(imageUrls.length, 3, maxOcrImages - ocrImageCount);
            console.log(`Found ${imageUrls.length} meaningful images, processing ${imagesToProcess}`);
            
            for (const imgUrl of imageUrls.slice(0, imagesToProcess)) {
              const ocrText = await extractTextFromImage(imgUrl);
              if (ocrText && ocrText.length > 20) {
                text += `\n[Image text: ${ocrText}]`;
                ocrImageCount++;
              }
            }
          }
        } else {
          text = await extractTextFromBuffer(buffer, url, contentType);
          text = cleanText(text);
          
          if (!isSubstantialContent(text)) {
            console.log(`Skipping ${url} - insufficient content`);
            continue;
          }
          
          const contentHash = hashContent(text);
          if (seenHashes.has(contentHash)) {
            console.log(`Skipping ${url} - duplicate content`);
            continue;
          }
          seenHashes.add(contentHash);
        }
        
        if (text && text.length > 50) {
          results.push({ url, text });
        }
        
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Failed to fetch ${url}:`, error.message);
      }
    }
    
    console.log(`Sitemap crawl complete. Processed ${results.length} unique pages (filtered ${seenHashes.size - results.length} duplicates).`);
    return results;
  }

  // Fallback to traditional crawling if no sitemap
  console.log(`No sitemap found. Starting Crawlee crawl from ${startUrl}, max pages: ${maxPages}, max depth: ${maxDepth}`);

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: maxPages,
    maxConcurrency: 2, // Limit concurrent requests to be respectful
    requestHandlerTimeoutSecs: 30,
    
    async requestHandler({ request, $, enqueueLinks }) {
      // Skip low-value URLs
      if (shouldSkipUrl(request.url)) {
        console.log(`Skipping low-value URL: ${request.url}`);
        return;
      }
      
      console.log(`Crawling [${results.length + 1}/${maxPages}]: ${request.url}`);

      // Extract text from page
      let text = $('body').text().replace(/\s+/g, ' ').trim();
      text = cleanText(text);
      
      // Validate content quality
      if (!isSubstantialContent(text)) {
        console.log(`Skipping ${request.url} - insufficient content`);
        return;
      }
      
      // Check for duplicate content
      const contentHash = hashContent(text);
      if (seenHashes.has(contentHash)) {
        console.log(`Skipping ${request.url} - duplicate content`);
        return;
      }
      seenHashes.add(contentHash);
      
      // Extract text from images if OCR is enabled
      if (enableOcr && ocrImageCount < maxOcrImages) {
        const html = $.html();
        const imageUrls = extractImageUrlsFromHtml(html, request.url)
          .filter(imgUrl => !shouldSkipImage(imgUrl));
        
        const imagesToProcess = Math.min(imageUrls.length, 3, maxOcrImages - ocrImageCount);
        console.log(`Found ${imageUrls.length} meaningful images, processing ${imagesToProcess}`);
        
        for (const imgUrl of imageUrls.slice(0, imagesToProcess)) {
          const ocrText = await extractTextFromImage(imgUrl);
          if (ocrText && ocrText.length > 20) {
            text += `\n[Image text: ${ocrText}]`;
            ocrImageCount++;
          }
        }
      }

      if (text && text.length > 50) {
        results.push({ 
          url: request.url, 
          text 
        });
      }

      // Only enqueue links if we haven't reached max depth
      if (request.userData.depth < maxDepth) {
        await enqueueLinks({
          selector: 'a[href]',
          userData: { depth: request.userData.depth + 1 },
          strategy: 'same-hostname', // Only crawl same domain
          transformRequestFunction: (req) => {
            // Remove hash and query params for cleaner URLs
            const url = new URL(req.url);
            url.hash = '';
            req.url = url.toString();
            
            // Skip low-value URLs during link discovery
            if (shouldSkipUrl(req.url)) {
              return null; // Don't enqueue this URL
            }
            
            return req;
          }
        });
      }
    },

    failedRequestHandler({ request, error }) {
      console.error(`Request failed for ${request.url}:`, error.message);
    },
  });

  // Start crawling
  await crawler.run([{ 
    url: startUrl, 
    userData: { depth: 0 } 
  }]);

  console.log(`Crawlee crawl complete. Found ${results.length} unique pages (filtered ${seenHashes.size - results.length} duplicates).`);
  return results;
}

  
/**
 * Best-effort extractor by filename / content-type
 */
export async function extractTextFromBuffer(buffer, filename = '', contentType = '') {
  const ext = extname(filename || '').toLowerCase();
  if (contentType.includes('pdf') || ext === '.pdf') {
    return extractTextFromPdfBuffer(buffer);
  } else if (contentType.includes('word') || ext === '.docx' || ext === '.doc') {
    return extractTextFromDocxBuffer(buffer);
  } else if (contentType.includes('html') || ext === '.html' || ext === '.htm') {
    return extractTextFromHtmlBuffer(buffer);
  } else {
    // fallback: try PDF then docx then HTML heuristics
    // try PDF parse (may fail)
    try {
      const t = await extractTextFromPdfBuffer(buffer);
      if (t && t.length > 50) return t;
    } catch (e) { /* ignore */ }
    try {
      const t2 = await extractTextFromDocxBuffer(buffer);
      if (t2 && t2.length > 50) return t2;
    } catch (e) { /* ignore */ }
    // fallback to plain text
    return buffer.toString('utf8').replace(/\s+/g, ' ').trim();
  }
}
