const TRAILING_NUMBER_REGEX = /^(.*?)(\d+)$/
const PROJECT_CODE_REGEX = /^XM-(\d+)$/
const CONTRACT_NO_REGEX = /^HT-(\d+)-(\d+)$/
const SETTLEMENT_NO_REGEX = /^JS-(\d+)-(\d+)$/
const LAST_DIGITS_REGEX = /(\d+)(?!.*\d)/

export const DEFAULT_PROJECT_CODE_PREFIX = 'XM'
export const DEFAULT_CONTRACT_NO_PREFIX = 'HT'
export const DEFAULT_PROJECT_SEQUENCE = '001'

const PROJECT_SEQUENCE_WIDTH = 3
const CONTRACT_SEQUENCE_WIDTH = 2

export interface ParsedSequentialCode {
  prefix: string
  numericPart: string
  sequence: number
}

function normalizeProjectSequence(rawSequence: string | number): string {
  const sequence = Number(rawSequence)
  if (!Number.isFinite(sequence) || sequence <= 0) {
    return DEFAULT_PROJECT_SEQUENCE
  }
  return String(Math.trunc(sequence)).padStart(PROJECT_SEQUENCE_WIDTH, '0')
}

function parseProjectCodeSequence(code: string): number | null {
  const matched = String(code || '').trim().match(PROJECT_CODE_REGEX)
  if (!matched) return null
  const sequence = Number(matched[1])
  if (!Number.isFinite(sequence) || sequence <= 0) return null
  return sequence
}

function parseContractNo(code: string): { projectSequence: number; contractSequence: number } | null {
  const matched = String(code || '').trim().match(CONTRACT_NO_REGEX)
  if (!matched) return null
  const [, rawProjectSequence, rawContractSequence] = matched
  const projectSequence = Number(rawProjectSequence)
  const contractSequence = Number(rawContractSequence)
  if (!Number.isFinite(projectSequence) || projectSequence <= 0) return null
  if (!Number.isFinite(contractSequence) || contractSequence <= 0) return null

  return {
    projectSequence,
    contractSequence,
  }
}

function inferProjectSequenceFromCodes(codes: string[]): string {
  const parsedContracts = codes
    .map(code => parseContractNo(code))
    .filter((parsed): parsed is { projectSequence: number; contractSequence: number } => parsed !== null)

  if (parsedContracts.length === 0) {
    return DEFAULT_PROJECT_SEQUENCE
  }

  const latest = parsedContracts.reduce((current, candidate) => {
    if (candidate.contractSequence > current.contractSequence) return candidate
    return current
  })

  return normalizeProjectSequence(latest.projectSequence)
}

export function parseSequentialCode(code: string): ParsedSequentialCode | null {
  const normalized = String(code || '').trim()
  if (!normalized) return null

  const matched = normalized.match(TRAILING_NUMBER_REGEX)
  if (!matched) return null

  const [, prefix, numericPart] = matched
  const sequence = Number(numericPart)
  if (!Number.isFinite(sequence)) return null

  return {
    prefix,
    numericPart,
    sequence,
  }
}

export function extractProjectSequence(code: string): string {
  const normalized = String(code || '').trim()
  if (!normalized) return ''

  const projectMatched = normalized.match(PROJECT_CODE_REGEX)
  if (projectMatched) {
    return normalizeProjectSequence(projectMatched[1])
  }

  const contractMatched = normalized.match(CONTRACT_NO_REGEX)
  if (contractMatched) {
    return normalizeProjectSequence(contractMatched[1])
  }

  const settlementMatched = normalized.match(SETTLEMENT_NO_REGEX)
  if (settlementMatched) {
    return normalizeProjectSequence(settlementMatched[1])
  }

  const fallbackMatched = normalized.match(LAST_DIGITS_REGEX)
  if (fallbackMatched) {
    return normalizeProjectSequence(fallbackMatched[1])
  }

  return ''
}

export function getNextSequentialCode(
  codes: string[],
  defaultPrefix: string,
): string {
  const parsedCodes = codes
    .map(code => parseSequentialCode(code))
    .filter((parsed): parsed is ParsedSequentialCode => parsed !== null)

  if (parsedCodes.length > 0) {
    const latest = parsedCodes.reduce((current, candidate) => {
      if (candidate.sequence > current.sequence) return candidate
      if (candidate.sequence < current.sequence) return current

      return candidate.numericPart.length > current.numericPart.length ? candidate : current
    })

    return `${latest.prefix}${String(latest.sequence + 1).padStart(latest.numericPart.length, '0')}`
  }

  return `${defaultPrefix}001`
}

export function getNextProjectCode(codes: string[]): string {
  const parsedSequences = codes
    .map(code => parseProjectCodeSequence(code))
    .filter((sequence): sequence is number => sequence !== null)

  const nextSequence = parsedSequences.length > 0
    ? Math.max(...parsedSequences) + 1
    : 1

  return `${DEFAULT_PROJECT_CODE_PREFIX}-${String(nextSequence).padStart(PROJECT_SEQUENCE_WIDTH, '0')}`
}

export function getNextContractNo(codes: string[], projectCode: string = ''): string {
  const projectSequence = extractProjectSequence(projectCode) || inferProjectSequenceFromCodes(codes)
  const projectSequenceNumber = Number(projectSequence)

  const contractSequences = codes
    .map(code => parseContractNo(code))
    .filter((parsed): parsed is { projectSequence: number; contractSequence: number } => parsed !== null)
    .filter(parsed => parsed.projectSequence === projectSequenceNumber)
    .map(parsed => parsed.contractSequence)

  const nextSequence = contractSequences.length > 0
    ? Math.max(...contractSequences) + 1
    : 1

  return `${DEFAULT_CONTRACT_NO_PREFIX}-${projectSequence}-${String(nextSequence).padStart(CONTRACT_SEQUENCE_WIDTH, '0')}`
}
