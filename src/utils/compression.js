/**
 * Response compression utilities for optimizing bandwidth
 */

/**
 * Check if request accepts gzip compression
 */
export function acceptsGzip(request) {
  const acceptEncoding = request.headers.get('Accept-Encoding');
  return acceptEncoding && acceptEncoding.includes('gzip');
}

/**
 * Compress response body using gzip (if supported by runtime)
 */
export async function compressResponse(response, request) {
  // Only compress text responses
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.startsWith('text/') && 
      !contentType.includes('json') && 
      !contentType.includes('javascript')) {
    return response;
  }
  
  // Check if client accepts gzip
  if (!acceptsGzip(request)) {
    return response;
  }
  
  // Check if already compressed
  if (response.headers.get('Content-Encoding')) {
    return response;
  }
  
  // Skip small responses (not worth compressing)
  const contentLength = response.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) < 1000) {
    return response;
  }
  
  try {
    // Get response body
    const body = await response.text();
    
    // Skip if too small after reading
    if (body.length < 1000) {
      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    
    // Check if CompressionStream is available (Cloudflare Workers)
    if (typeof CompressionStream !== 'undefined') {
      const compressed = await compressWithStream(body);
      
      const headers = new Headers(response.headers);
      headers.set('Content-Encoding', 'gzip');
      headers.set('Content-Length', compressed.byteLength.toString());
      headers.set('Vary', 'Accept-Encoding');
      
      return new Response(compressed, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }
    
    // Fallback: return uncompressed
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
    
  } catch (error) {
    // If compression fails, return original response
    return response;
  }
}

/**
 * Compress string using CompressionStream
 */
async function compressWithStream(text) {
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  
  // Write data
  writer.write(new TextEncoder().encode(text));
  writer.close();
  
  // Read compressed data
  const chunks = [];
  let done = false;
  
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      chunks.push(value);
    }
  }
  
  // Combine chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

/**
 * Minify JSON response by removing unnecessary whitespace
 */
export function minifyJSON(obj) {
  return JSON.stringify(obj, null, 0);
}

/**
 * Estimate compression ratio for metrics
 */
export function estimateCompressionRatio(original, compressed) {
  const originalSize = typeof original === 'string' ? 
    new TextEncoder().encode(original).length : original.byteLength;
  const compressedSize = typeof compressed === 'string' ? 
    new TextEncoder().encode(compressed).length : compressed.byteLength;
    
  return {
    originalSize,
    compressedSize,
    ratio: compressedSize / originalSize,
    savings: originalSize - compressedSize,
    savingsPercent: Math.round((1 - (compressedSize / originalSize)) * 100)
  };
}

/**
 * Response optimization middleware
 */
export async function optimizeResponse(response, request, options = {}) {
  const {
    enableCompression = true,
    enableMinification = true,
    minSizeForCompression = 1000
  } = options;
  
  let optimizedResponse = response;
  let stats = {
    compressed: false,
    minified: false,
    originalSize: 0,
    finalSize: 0
  };
  
  try {
    // Get original body for size calculation
    const originalBody = await response.clone().text();
    stats.originalSize = new TextEncoder().encode(originalBody).length;
    
    // Skip optimization for small responses
    if (stats.originalSize < minSizeForCompression) {
      return { response: optimizedResponse, stats };
    }
    
    // Minify JSON responses
    if (enableMinification && response.headers.get('Content-Type')?.includes('json')) {
      try {
        const parsed = JSON.parse(originalBody);
        const minified = minifyJSON(parsed);
        
        optimizedResponse = new Response(minified, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
        
        stats.minified = true;
      } catch {
        // Not valid JSON, skip minification
      }
    }
    
    // Apply compression
    if (enableCompression) {
      const compressed = await compressResponse(optimizedResponse, request);
      if (compressed.headers.get('Content-Encoding')) {
        optimizedResponse = compressed;
        stats.compressed = true;
      }
    }
    
    // Calculate final size
    const finalBody = await optimizedResponse.clone().text();
    stats.finalSize = new TextEncoder().encode(finalBody).length;
    
    // Add optimization headers for debugging
    if (stats.compressed || stats.minified) {
      const headers = new Headers(optimizedResponse.headers);
      headers.set('X-Optimized', 
        [stats.compressed && 'compressed', stats.minified && 'minified']
          .filter(Boolean)
          .join(',')
      );
      
      optimizedResponse = new Response(optimizedResponse.body, {
        status: optimizedResponse.status,
        statusText: optimizedResponse.statusText,
        headers
      });
    }
    
  } catch (error) {
    // If optimization fails, return original response
    console.warn('Response optimization failed:', error.message);
    optimizedResponse = response;
  }
  
  return { response: optimizedResponse, stats };
}