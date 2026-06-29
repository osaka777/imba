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
  buttonPosXPct?: number
  buttonPosYPct?: number
  buttonMobilePosXPct?: number
  buttonMobilePosYPct?: number
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
  titleSize: 28,
  titleMobileSize: undefined,
  descColor: '#ffffff',
  descSize: 13,
  descMobileSize: undefined,
  textShadow: true,
  buttonSize: 14,
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
  buttonPosXPct: undefined,
  buttonPosYPct: undefined,
  buttonMobilePosXPct: undefined,
  buttonMobilePosYPct: undefined,
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
    titleSize: slide.titleSize || 28,
    titleMobileSize: slide.titleMobileSize,
    descColor: slide.descColor || '#ffffff',
    descSize: slide.descSize || 13,
    descMobileSize: slide.descMobileSize,
    textShadow: slide.textShadow !== undefined ? slide.textShadow : true,
    buttonSize: slide.buttonSize ?? 14,
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
    buttonPosXPct: slide.buttonPosXPct,
    buttonPosYPct: slide.buttonPosYPct,
    buttonMobilePosXPct: slide.buttonMobilePosXPct,
    buttonMobilePosYPct: slide.buttonMobilePosYPct,
  }
}
