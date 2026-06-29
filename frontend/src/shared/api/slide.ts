export interface Slide {
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
  titleMobilePosXPct?: number;
  titleMobilePosYPct?: number;
  descPosXPct?: number;
  descPosYPct?: number;
  descMobilePosXPct?: number;
  descMobilePosYPct?: number;
  showTitle?: boolean;
  showDesc?: boolean;
  showButton?: boolean;
  buttonText?: string;
  buttonPosXPct?: number;
  buttonPosYPct?: number;
  buttonMobilePosXPct?: number;
  buttonMobilePosYPct?: number;
  titleColor?: string;
  titleSize?: number;
  titleMobileSize?: number;
  descColor?: string;
  descSize?: number;
  descMobileSize?: number;
  textShadow?: boolean;
  buttonSize?: number;
  buttonMobileSize?: number;
  createdAt: string;
  updatedAt: string;
}

class SlideAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = this.getBaseUrl();
  }

  private getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000';
  }

  async getActiveSlides(): Promise<Slide[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/slides`, {
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

export const slideAPI = new SlideAPI();