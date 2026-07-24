import { describe, expect, it } from 'vitest'
import { buildCsvContent, parseCsvContent, parseCsvObjects } from './csv'

describe('csv utils', () => {
  it('joins flat rows into csv text', () => {
    expect(buildCsvContent([
      ['项目名称', '合同金额'],
      ['项目A', 100],
    ])).toBe('项目名称,合同金额\r\n项目A,100')
  })

  it('escapes commas, quotes and line breaks', () => {
    expect(buildCsvContent([
      ['备注', '内容'],
      ['说明', '包含,逗号'],
      ['引号', '他说"可以"'],
      ['换行', '第一行\n第二行'],
    ])).toBe(
      '备注,内容\r\n说明,"包含,逗号"\r\n引号,"他说""可以"""\r\n换行,"第一行\n第二行"',
    )
  })

  it('parses csv text with quotes, bom and blank lines', () => {
    expect(parseCsvContent('\uFEFF项目名称,备注\r\n"项目,A","第一行\n第二行"\r\n\r\n')).toEqual([
      ['项目名称', '备注'],
      ['项目,A', '第一行\n第二行'],
    ])
  })

  it('maps csv rows to objects by header', () => {
    expect(parseCsvObjects('itemName,unit,quantity\n透层油,㎡,100')).toEqual([
      {
        itemName: '透层油',
        unit: '㎡',
        quantity: '100',
      },
    ])
  })
})
