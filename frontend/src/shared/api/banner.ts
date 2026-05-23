export interface Banner {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imagePath?: string;
  linkUrl?: string;
  isActive: boolean;
  order: number;
  textPosition?: string;
  textVerticalPos?: string;
  textOffsetX?: number;
  textOffsetY?: number;
  titlePosXPct?: number;
  titlePosYPct?: number;
  descPosXPct?: number;
  descPosYPct?: number;
  showTitle?: boolean;
  showDesc?: boolean;
  showButton?: boolean;
  buttonText?: string;
  buttonPosXPct?: number;
  buttonPosYPct?: number;
  titleColor?: string;
  titleSize?: number;
  descColor?: string;
  descSize?: number;
  textShadow?: boolean;
  createdAt: string;
  updatedAt: string;
}

class BannerAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = this.getBaseUrl();
  }

  private getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';
  }

  async getActiveBanners(): Promise<Banner[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/banners`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching active banners:', error);
      return [];
    }
  }
}

export const bannerAPI = new BannerAPI();