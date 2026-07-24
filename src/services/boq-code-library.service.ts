export type BOQCodeStandard = 'highway' | 'municipal' | 'custom'

export interface BOQCodeOption {
  standard: Exclude<BOQCodeStandard, 'custom'>
  code: string
  name: string
  unit: string
  keywords: string[]
}

export const BOQ_CODE_OPTIONS: BOQCodeOption[] = [
  { standard: 'highway', code: '300-1-a', name: '路基挖方', unit: 'm3', keywords: ['挖方', '土石方'] },
  { standard: 'highway', code: '302-1', name: '级配碎石垫层', unit: 'm2', keywords: ['级配碎石', '垫层'] },
  { standard: 'highway', code: '304-3', name: '水泥稳定碎石基层', unit: 'm2', keywords: ['水稳', '水泥稳定碎石', '基层'] },
  { standard: 'highway', code: '309-1', name: '透层', unit: 'm2', keywords: ['透层'] },
  { standard: 'highway', code: '309-2', name: '粘层', unit: 'm2', keywords: ['粘层'] },
  { standard: 'highway', code: '311-1', name: '沥青混凝土面层', unit: 'm2', keywords: ['沥青', 'AC-', 'SMA'] },
  { standard: 'municipal', code: '040201001', name: '水泥稳定碎石', unit: 'm2', keywords: ['水稳', '水泥稳定碎石', '基层'] },
  { standard: 'municipal', code: '040202001', name: '透层、粘层', unit: 'm2', keywords: ['透层', '粘层'] },
  { standard: 'municipal', code: '040203001', name: '沥青混凝土路面', unit: 'm2', keywords: ['沥青', 'AC-', 'SMA'] },
  { standard: 'municipal', code: '040204001', name: '铣刨路面', unit: 'm2', keywords: ['铣刨'] },
]

export const boqCodeLibraryService = {
  listByStandard(standard?: BOQCodeStandard): BOQCodeOption[] {
    if (!standard || standard === 'custom') return []
    return BOQ_CODE_OPTIONS.filter(option => option.standard === standard)
  },

  inferByName(name: string): BOQCodeOption | undefined {
    return BOQ_CODE_OPTIONS.find(option => option.keywords.some(keyword => name.includes(keyword)))
  },
}
