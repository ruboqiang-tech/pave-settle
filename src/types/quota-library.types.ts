export type QuotaComponentCategory = 'labor' | 'material' | 'machine' | 'transport' | 'mixing' | 'fee' | 'other'

export type QuotaComponentBasis = 'baseUnit' | 'tonnage' | 'area'

export interface QuotaComponent {
  id: string
  category: QuotaComponentCategory
  name: string
  unit: string
  basis: QuotaComponentBasis
  consumption: number
  price: number
  formula: string
  resourceId?: string
}

export interface QuotaItem {
  id: string
  code: string
  name: string
  baseUnit: 'm3' | 'm2'
  defaultThicknessCm: number
  density: number
  lossRate: number
  caliber: string
  components: QuotaComponent[]
  projectPoolJson?: number[] | null
}

export interface ParamRule {
  defaultVal: number
  minValid: number
  maxValid: number
  desc: string
  warningMsg: string
}
