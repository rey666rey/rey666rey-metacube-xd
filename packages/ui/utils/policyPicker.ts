/** Display-only folders. Never create or modify Mihomo proxy groups. */
export interface PolicyCategory {
  id: string
  label: string
  kind: 'groups' | 'provider' | 'custom' | 'system'
  names: string[]
}

interface PickerNode {
  type?: string
  provider?: string
}

const vendors = [
  { label: 'BlancVPN', re: /^(?:blanc(?:vpn)?|blank(?:vpn)?)$/i },
  { label: 'V220', re: /^v?220$/i },
  { label: 'MASTER', re: /^master(?:vpn)?$/i },
  { label: 'DOG', re: /^dog(?:vpn)?$/i },
  { label: 'LETO', re: /^leto(?:vpn)?$/i },
]

function vendorLabel(value: string) {
  return vendors.find((vendor) => vendor.re.test(value))?.label
}

function nameVendor(name: string) {
  const prefix = name.trim().match(/^\[([^\]]+)\]|^(\w+)(?=$|[\s·:|/_-])/)
  return prefix ? vendorLabel(prefix[1] || prefix[2] || '') : undefined
}

export function groupPolicyNodes(
  names: string[],
  groupNames: ReadonlySet<string>,
  metaOf: (name: string) => PickerNode | undefined,
  providerOf: (name: string) => string | undefined = () => undefined,
): PolicyCategory[] {
  const categories = new Map<string, PolicyCategory>()
  for (const name of names) {
    const meta = metaOf(name)
    let category: Omit<PolicyCategory, 'names'>
    if (/^(?:DIRECT|REJECT(?:-DROP)?|PASS|COMPATIBLE)$/i.test(name)) {
      category = { id: 'system', label: '', kind: 'system' }
    } else if (groupNames.has(name)) {
      category = { id: 'groups', label: '', kind: 'groups' }
    } else {
      const provider = providerOf(name) || meta?.provider || ''
      // Prefixes win: a single HTTP subscription can aggregate many vendors.
      const label = nameVendor(name) || vendorLabel(provider)
      if (label) {
        category = { id: `provider:${label}`, label, kind: 'provider' }
      } else if (provider && provider !== 'default' && !/\./.test(provider)) {
        category = {
          id: `provider:${provider}`,
          label: provider,
          kind: 'provider',
        }
      } else {
        category = { id: 'custom', label: '', kind: 'custom' }
      }
    }
    if (!categories.has(category.id))
      categories.set(category.id, { ...category, names: [] })
    const folder = categories.get(category.id)!
    if (!folder.names.includes(name)) folder.names.push(name)
  }
  const rank = { groups: 0, provider: 1, custom: 2, system: 3 }
  return [...categories.values()].sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      a.label.localeCompare(b.label, undefined, { numeric: true }),
  )
}

// Match flags anywhere, including after a vendor prefix. Aliases let a Latin
// search find Russian subscription names without rewriting the actual names.
const countries = [
  ['🇫🇮', 'finland|финляндия|suomi|helsinki|хельсинки'],
  ['🇩🇪', 'germany|германия|deutschland|frankfurt|франкфурт|berlin|берлин'],
  ['🇳🇱', 'netherlands|нидерланды|holland|голландия|amsterdam|амстердам'],
  ['🇺🇸', 'united states|usa|сша|америка'],
  ['🇬🇧', 'united kingdom|britain|uk|великобритания|англия|london|лондон'],
  ['🇫🇷', 'france|франция|paris|париж'],
  ['🇸🇪', 'sweden|швеция|stockholm|стокгольм'],
  ['🇳🇴', 'norway|норвегия|oslo|осло'],
  ['🇩🇰', 'denmark|дания|copenhagen|копенгаген'],
  ['🇨🇭', 'switzerland|швейцария|zurich|цюрих'],
  ['🇦🇹', 'austria|австрия|vienna|вена'],
  ['🇵🇱', 'poland|польша|warsaw|варшава'],
  ['🇨🇿', 'czechia|czech|чехия|prague|прага'],
  ['🇪🇪', 'estonia|эстония|tallinn|таллин'],
  ['🇱🇻', 'latvia|латвия|riga|рига'],
  ['🇱🇹', 'lithuania|литва|vilnius|вильнюс'],
  ['🇪🇸', 'spain|испания|madrid|мадрид'],
  ['🇮🇹', 'italy|италия|milan|милан'],
  ['🇹🇷', 'turkey|türkiye|турция|istanbul|стамбул'],
  ['🇷🇺', 'russia|россия|moscow|москва'],
  ['🇺🇦', 'ukraine|украина|kyiv|киев'],
  ['🇯🇵', 'japan|япония|tokyo|токио'],
  ['🇸🇬', 'singapore|сингапур'],
  ['🇭🇰', 'hong kong|гонконг'],
  ['🇨🇦', 'canada|канада|toronto|торонто'],
  ['🇦🇪', 'united arab emirates|uae|оаэ|эмираты|dubai|дубай'],
] as const

const countryMatchers = countries.map(([flag, words]) => ({
  flag,
  words: words.replaceAll('|', ' '),
  pattern: new RegExp(`(?:^|[^\\p{L}])(?:${words})(?=$|[^\\p{L}])`, 'u'),
}))

function searchText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/ё/g, 'е')
}

export function filterPolicyNodes(
  names: string[],
  query: string,
  categoryLabel = '',
) {
  const tokens = searchText(query).trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return names
  return names.filter((name) => {
    const normalized = searchText(name)
    const aliases = countryMatchers
      .filter(
        ({ flag, pattern }) => name.includes(flag) || pattern.test(normalized),
      )
      .map(({ flag, words }) => `${flag} ${words}`)
      .join(' ')
    const text = `${normalized} ${searchText(categoryLabel)} ${aliases}`
    return tokens.every((token) => text.includes(token))
  })
}
