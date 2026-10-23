export interface SafeFetchResult<T> {
  data?: T;
  error?: string;
  isHtml?: boolean;
  isCloudflare?: boolean;
  status: number;
}

export async function safeFetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    throw new Error(`Network connection error: ${err.message || 'Unable to reach server'}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();

  let parsedJson: any = null;
  const isHtml = text.trim().toLowerCase().startsWith('<!doctype') || text.trim().toLowerCase().startsWith('<html');

  if (contentType.includes('application/json') || (!isHtml && text.trim().startsWith('{'))) {
    try {
      parsedJson = JSON.parse(text);
    } catch {
      // JSON parse failed
    }
  }

  if (!res.ok) {
    if (parsedJson && parsedJson.error) {
      const err: any = new Error(parsedJson.error);
      err.status = res.status;
      err.upstreamStatus = parsedJson.upstreamStatus;
      err.isCloudflareError = parsedJson.isCloudflareError;
      throw err;
    }

    if (isHtml) {
      if (text.includes('525') || text.includes('SSL handshake')) {
        const err: any = new Error('AO3 Cloudflare SSL Handshake Failed (HTTP 525). AO3 origin servers are temporarily unreachable.');
        err.status = res.status;
        err.upstreamStatus = 525;
        err.isCloudflareError = true;
        throw err;
      }
      const err: any = new Error(`Server returned HTML error page (HTTP ${res.status}).`);
      err.status = res.status;
      throw err;
    }

    const err: any = new Error(`Request failed with HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  if (isHtml || !parsedJson) {
    // Response was OK (200), but content was HTML instead of JSON
    if (text.includes('525') || text.includes('SSL handshake')) {
      const err: any = new Error('AO3 Cloudflare SSL Handshake Failed (HTTP 525). AO3 origin servers are temporarily unreachable.');
      err.status = 525;
      err.isCloudflareError = true;
      throw err;
    }
    throw new Error('API server returned HTML page instead of JSON. Client fallback mode activated.');
  }

  return parsedJson as T;
}
