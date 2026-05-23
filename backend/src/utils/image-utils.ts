import axios from 'axios';
import fs from 'fs';
import path from 'path';

export async function checkImageAvailability(url: string): Promise<boolean> {
  try {
    // Если это локальный путь к флагу
    if (url.startsWith('/flags/')) {
      const filePath = path.join(process.cwd(), 'frontend/public', url);
      return fs.existsSync(filePath);
    }
    
    // Для внешних URL
    const response = await axios.head(url);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

export function getFallbackFlag(code: string): string {
  // Map of codes to local flag files
  const specialFlags = {
    'nhl': '/flags/nhl.webp',
    'khl': '/flags/khl.webp',
    'wta': '/flags/wta.webp',
    'atp': '/flags/atp.webp',
    'itf': '/flags/itf.webp',
    'international': '/flags/international.webp',
    'all': '/flags/all.webp',
    'other': '/flags/other.webp'
  };

  // Default fallback flag
  const defaultFlag = '/flags/other.webp';

  // Return special flag if exists, otherwise default
  return specialFlags[code] || defaultFlag;
} 