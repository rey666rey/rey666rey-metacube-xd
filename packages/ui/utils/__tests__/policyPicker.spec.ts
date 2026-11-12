import { describe, expect, it } from 'vitest'
import { filterPolicyNodes, groupPolicyNodes } from '../policyPicker'

const noMeta = () => undefined

describe('policy connection folders', () => {
  it('keeps nested aggregators as selectable members, without expanding their leaves', () => {
    const names = [
      '🇩🇪 Germany Aggregated',
      '[BlancVPN] Berlin',
      'DIRECT',
      'my-node',
    ]
    const snapshot = [...names]
    const folders = groupPolicyNodes(names, new Set([names[0]!]), noMeta)
    expect(folders.map((c) => c.id)).toEqual([
      'groups',
      'provider:BlancVPN',
      'custom',
      'system',
    ])
    expect(folders[0]!.names).toEqual(['🇩🇪 Germany Aggregated'])
    expect(names).toEqual(snapshot)
    expect(folders.flatMap((c) => c.names).sort()).toEqual([...names].sort())
  })

  it('splits a mixed subscription by original vendor rather than aggregating provider', () => {
    const names = [
      'MASTER · Finland · a',
      'V220 · Finland · b',
      'DOG · Finland · c',
      'LETO · Finland · d',
    ]
    const folders = groupPolicyNodes(
      names,
      new Set(),
      noMeta,
      () => 'Finland-Aggregated',
    )
    expect(folders.map((c) => c.label)).toEqual([
      'DOG',
      'LETO',
      'MASTER',
      'V220',
    ])
    expect(folders.flatMap((c) => c.names)).toHaveLength(4)
  })

  it('normalizes vendor variants and preserves input ordering within a folder', () => {
    const names = [
      '[Blank] Helsinki',
      '[BlancVPN] Berlin',
      '220 · Helsinki',
      'master · Berlin',
    ]
    const folders = groupPolicyNodes(names, new Set(), noMeta)
    expect(folders[0]!.names).toEqual(names.slice(0, 2))
    expect(folders.map((c) => c.label)).toEqual(['BlancVPN', 'MASTER', 'V220'])
  })

  it('uses provider membership even when the kernel node metadata omits it', () => {
    const folders = groupPolicyNodes(
      ['Node A'],
      new Set(),
      noMeta,
      () => 'BlancVPN',
    )
    expect(folders[0]!.label).toBe('BlancVPN')
  })

  it('uses metadata as a fallback, groups untagged own servers together and keeps system actions separate', () => {
    const folders = groupPolicyNodes(
      ['a', 'b', 'REJECT'],
      new Set(['REJECT']),
      (name) => ({ provider: name === 'a' ? 'media.example.org' : '' }),
    )
    expect(folders.map((c) => c.id)).toEqual(['custom', 'system'])
    expect(folders[0]!.names).toEqual(['a', 'b'])
  })

  it('retains unknown providers, handles empty input and does not duplicate names', () => {
    expect(groupPolicyNodes([], new Set(), noMeta)).toEqual([])
    const folders = groupPolicyNodes(['A', 'A'], new Set(), () => ({
      provider: 'Another VPN',
    }))
    expect(folders[0]!.label).toBe('Another VPN')
    expect(folders[0]!.names).toEqual(['A'])
  })
})

describe('local policy search', () => {
  const names = [
    '[BlancVPN] 🇫🇮 Хельсинки',
    'MASTER · Finland · a',
    '🇫🇮 Finland Proxy',
    '[BlancVPN] 🇩🇪 Берлин',
  ]

  it.each(['Fi', 'FINLAND', 'финляндия', '🇫🇮', 'Хельсинки', 'suomi'])(
    'finds Finland across names and languages: %s',
    (query) => {
      expect(filterPolicyNodes(names, query)).toEqual(names.slice(0, 3))
    },
  )

  it('combines country and vendor terms, and can match the folder label', () => {
    expect(filterPolicyNodes(names, 'master финляндия')).toEqual([names[1]])
    expect(filterPolicyNodes(['🇫🇮 Хельсинки'], 'blanc fi', 'BlancVPN')).toEqual(
      ['🇫🇮 Хельсинки'],
    )
  })

  it('does not depend on another policy search or modify the source list', () => {
    expect(filterPolicyNodes(names, 'Germany')).toEqual([names[3]])
    expect(filterPolicyNodes(names, 'fi')).toHaveLength(3)
    expect(names).toHaveLength(4)
    expect(filterPolicyNodes(names, '   ')).toBe(names)
    expect(filterPolicyNodes(names, 'not-a-location')).toEqual([])
  })

  it('does not infer Finland from arbitrary substrings', () => {
    expect(
      filterPolicyNodes(['profile node', 'final proxy'], 'финляндия'),
    ).toEqual([])
  })
  it('does not confuse country names that share United or match a partial word', () => {
    const names = [
      'United States',
      'United Kingdom',
      'United Arab Emirates',
      'Final server',
    ]
    expect(filterPolicyNodes(names, 'сша')).toEqual(['United States'])
    expect(filterPolicyNodes(names, 'англия')).toEqual(['United Kingdom'])
    expect(filterPolicyNodes(names, 'дубай')).toEqual(['United Arab Emirates'])
    expect(filterPolicyNodes(names, 'финляндия')).toEqual([])
  })
})
