import { describe, expect, it } from 'vitest'
import {
  invoiceTypeMap,
  invoiceTypeOptions,
  paymentMethodMap,
  paymentMethodOptions,
  projectStatusOptions,
  projectStatusTextMap,
  projectTypeOptions,
  projectTypeTextMap,
  settlementStatusOptions,
  settlementStatusTextMap,
  settlementTypeOptions,
  settlementTypeTextMap,
} from './format'

describe('format dictionaries', () => {
  it('keeps project status options aligned with text maps', () => {
    expect(projectStatusOptions).toEqual([
      { label: projectStatusTextMap.preparing, value: 'preparing' },
      { label: projectStatusTextMap.in_progress, value: 'in_progress' },
      { label: projectStatusTextMap.settling, value: 'settling' },
      { label: projectStatusTextMap.completed, value: 'completed' },
    ])
  })

  it('keeps project and settlement type options aligned with text maps', () => {
    expect(projectTypeOptions).toEqual([
      { label: projectTypeTextMap.highway, value: 'highway' },
      { label: projectTypeTextMap.municipal, value: 'municipal' },
    ])

    expect(settlementTypeOptions).toEqual([
      { label: settlementTypeTextMap.interim, value: 'interim' },
      { label: settlementTypeTextMap.final, value: 'final' },
    ])
  })

  it('keeps settlement status options aligned with text maps', () => {
    expect(settlementStatusOptions).toEqual([
      { label: settlementStatusTextMap.draft, value: 'draft' },
      { label: settlementStatusTextMap.confirmed, value: 'confirmed' },
      { label: settlementStatusTextMap.approved, value: 'approved' },
    ])
  })

  it('derives payment and invoice options from shared maps', () => {
    expect(paymentMethodOptions).toEqual([
      { label: '银行转账', value: '银行转账' },
      { label: '支票', value: '支票' },
      { label: '现金', value: '现金' },
      { label: '承兑汇票', value: '承兑汇票' },
      { label: '其他', value: '其他' },
    ])

    expect(invoiceTypeOptions).toEqual([
      { label: invoiceTypeMap.special, value: 'special' },
      { label: invoiceTypeMap.general, value: 'general' },
      { label: invoiceTypeMap.electronic, value: 'electronic' },
    ])

    expect(paymentMethodMap['银行转账']).toBe('转账')
  })
})
