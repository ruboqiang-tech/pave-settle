import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTRACT_NO_PREFIX,
  DEFAULT_PROJECT_CODE_PREFIX,
  extractProjectSequence,
  getNextContractNo,
  getNextProjectCode,
  getNextSequentialCode,
  parseSequentialCode,
} from './numbering'

describe('numbering utils', () => {
  it('parses prefix and trailing sequence from sequential codes', () => {
    expect(parseSequentialCode('XM-009')).toEqual({
      prefix: 'XM-',
      numericPart: '009',
      sequence: 9,
    })
    expect(parseSequentialCode('HT-2026-001')).toEqual({
      prefix: 'HT-2026-',
      numericPart: '001',
      sequence: 1,
    })
  })

  it('returns null for codes without trailing numbers', () => {
    expect(parseSequentialCode('HT-DEMO-001-A')).toBeNull()
    expect(parseSequentialCode('')).toBeNull()
  })

  it('increments the latest parsable code and preserves width', () => {
    expect(getNextSequentialCode(['XM-099', 'XM-098'], DEFAULT_PROJECT_CODE_PREFIX)).toBe('XM-100')
    expect(getNextSequentialCode(['HT-2026-009'], DEFAULT_CONTRACT_NO_PREFIX)).toBe('HT-2026-010')
  })

  it('uses the highest sequence even when the list is unordered', () => {
    expect(getNextSequentialCode(['XM-001', 'XM-003', 'XM-002'], DEFAULT_PROJECT_CODE_PREFIX)).toBe('XM-004')
    expect(getNextSequentialCode(['HT-2026-001', 'HT-2026-003', 'HT-2026-002'], DEFAULT_CONTRACT_NO_PREFIX)).toBe('HT-2026-004')
  })

  it('gets next project code with XM-3位主编号', () => {
    expect(getNextProjectCode(['XM-001', 'XM-003', '手工项目'])).toBe('XM-004')
    expect(getNextProjectCode(['演示项目'])).toBe('XM-001')
  })

  it('gets next contract no with HT-项目主编号-项目内顺序号', () => {
    expect(getNextContractNo(['HT-001-01', 'HT-001-03', 'HT-DEMO-A'], 'XM-001')).toBe('HT-001-04')
    expect(getNextContractNo(['HT-002-01'], 'XM-001')).toBe('HT-001-01')
    expect(getNextContractNo(['HT-DEMO-A'], 'XM-001')).toBe('HT-001-01')
  })

  it('extracts project sequence from project/contract/settlement codes', () => {
    expect(extractProjectSequence('XM-007')).toBe('007')
    expect(extractProjectSequence('HT-007-02')).toBe('007')
    expect(extractProjectSequence('JS-007-03')).toBe('007')
  })
})
