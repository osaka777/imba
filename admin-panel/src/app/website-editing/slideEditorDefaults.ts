import type { Slide } from '@/shared/api/slides'

export type SlideFormData = {
  title: string
  description: string
  imageUrl: string
  imagePath: string
  linkUrl: string
  isActive: boolean
  order: number
  textPosition: string
  textVerticalPos: string
  textOffsetX: number
  textOffsetY: number
  titleColor: string
  titleSize: number
  titleMobileSize?: number
  descColor: string
  descSize: number
  descMobileSize?: number
  textShadow: boolean
  buttonSize: number
  buttonMobileSize?: number
  titlePosXPct?: number
  titlePosYPct?: number
  titleMobilePosXPct?: number
  titleMobilePosYPct?: number
  descPosXPct?: number
  descPosYPct?: number
  descMobilePosXPct?: number
  descMobilePosYPct?: number
  showTitle: boolean
  showDesc: boolean
  showButton: boolean
  buttonText: string
  buttonColor: string
  buttonTextColor: string
  buttonPosXPct?: number
  buttonPosYPct?: number
  buttonMobilePosXPct?: number
  buttonMobilePosYPct?: number
  layoutMode: 'classic' | 'centered' | 'custom'
  showSecondaryButton: boolean
  secondaryButtonText: string
  secondaryButtonLink: string
  secondaryButtonColor: string
  secondaryButtonTextColor: string
  secondaryButtonOpacity: number
}

export const DEFAULT_SLIDE_FORM: SlideFormData = {
  title: '',
  description: '',
  imageUrl: '',
  imagePath: '',
  linkUrl: '',
  isActive: true,
  order: 1,
  textPosition: 'center',
  textVerticalPos: 'center',
  textOffsetX: 0,
  textOffsetY: 0,
  titleColor: '#ffffff',
  titleSize: 35,
  titleMobileSize: undefined,
  descColor: '#ffffff',
  descSize: 13,
  descMobileSize: undefined,
  textShadow: true,
  buttonSize: 13,
  buttonMobileSize: undefined,
  titlePosXPct: undefined,
  titlePosYPct: undefined,
  titleMobilePosXPct: undefined,
  titleMobilePosYPct: undefined,
  descPosXPct: undefined,
  descPosYPct: undefined,
  descMobilePosXPct: undefined,
  descMobilePosYPct: undefined,
  showTitle: true,
  showDesc: true,
  showButton: false,
  buttonText: '',
  buttonColor: '#2563eb',
  buttonTextColor: '#ffffff',
  buttonPosXPct: undefined,
  buttonPosYPct: undefined,
  buttonMobilePosXPct: undefined,
  buttonMobilePosYPct: undefined,
  layoutMode: 'classic',
  showSecondaryButton: false,
  secondaryButtonText: 'Подробнее',
  secondaryButtonLink: '',
  secondaryButtonColor: '#ffffff',
  secondaryButtonTextColor: '#ffffff',
  secondaryButtonOpacity: 20,
}

export function slideToFormData(slide: Slide): SlideFormData {
  return {
    title: slide.title,
    description: slide.description || '',
    imageUrl: slide.imageUrl || '',
    imagePath: slide.imagePath || '',
    linkUrl: slide.linkUrl || '',
    isActive: slide.isActive,
    order: slide.order,
    textPosition: slide.textPosition || 'center',
    textVerticalPos: slide.textVerticalPos || 'center',
    textOffsetX: slide.textOffsetX || 0,
    textOffsetY: slide.textOffsetY || 0,
    titleColor: slide.titleColor || '#ffffff',
    titleSize: slide.titleSize || 35,
    titleMobileSize: slide.titleMobileSize,
    descColor: slide.descColor || '#ffffff',
    descSize: slide.descSize || 13,
    descMobileSize: slide.descMobileSize,
    textShadow: slide.textShadow !== undefined ? slide.textShadow : true,
    buttonSize: slide.buttonSize ?? 13,
    buttonMobileSize: slide.buttonMobileSize,
    titlePosXPct: slide.titlePosXPct,
    titlePosYPct: slide.titlePosYPct,
    titleMobilePosXPct: slide.titleMobilePosXPct,
    titleMobilePosYPct: slide.titleMobilePosYPct,
    descPosXPct: slide.descPosXPct,
    descPosYPct: slide.descPosYPct,
    descMobilePosXPct: slide.descMobilePosXPct,
    descMobilePosYPct: slide.descMobilePosYPct,
    showTitle: slide.showTitle !== undefined ? slide.showTitle : true,
    showDesc: slide.showDesc !== undefined ? slide.showDesc : true,
    showButton: slide.showButton ?? false,
    buttonText: slide.buttonText ?? '',
    buttonColor: slide.buttonColor || '#2563eb',
    buttonTextColor: slide.buttonTextColor || '#ffffff',
    buttonPosXPct: slide.buttonPosXPct,
    buttonPosYPct: slide.buttonPosYPct,
    buttonMobilePosXPct: slide.buttonMobilePosXPct,
    buttonMobilePosYPct: slide.buttonMobilePosYPct,
    layoutMode:
      slide.layoutMode === 'custom'
        ? 'custom'
        : slide.layoutMode === 'centered'
          ? 'centered'
          : 'classic',
    showSecondaryButton: slide.showSecondaryButton ?? false,
    secondaryButtonText: slide.secondaryButtonText ?? 'Подробнее',
    secondaryButtonLink: slide.secondaryButtonLink ?? '',
    secondaryButtonColor: slide.secondaryButtonColor || '#ffffff',
    secondaryButtonTextColor: slide.secondaryButtonTextColor || '#ffffff',
    secondaryButtonOpacity: slide.secondaryButtonOpacity ?? 20,
  }
}
