export interface PriceQuote {
  id: string
  supplier: string
  price: number
  taxCaliber: string
  deliveryPoint: string
  collectedAt: string
  remark?: string
}

export type PriceResourceCategory = 'labor' | 'material' | 'finished' | 'transport' | 'machine'

export interface PriceResourceItem {
  id: string
  category: PriceResourceCategory
  name: string
  spec: string
  unit: string
  quotes: PriceQuote[]
}
