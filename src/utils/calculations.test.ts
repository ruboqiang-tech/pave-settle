import { describe, expect, it } from 'vitest'
import { clampProgressPercentage, formatProgressRatio } from './calculations'

describe('calculations progress helpers', () => {
  it('clamps progress percentage into element-plus safe range', () => {
    expect(clampProgressPercentage(66.678)).toBe(66.68)
    expect(clampProgressPercentage(132.556)).toBe(100)
    expect(clampProgressPercentage(-5)).toBe(0)
  })

  it('formats actual progress ratio without forcing trailing zeroes', () => {
    expect(formatProgressRatio(100)).toBe('100%')
    expect(formatProgressRatio(66.7)).toBe('66.7%')
    expect(formatProgressRatio(66.678)).toBe('66.68%')
  })
})
