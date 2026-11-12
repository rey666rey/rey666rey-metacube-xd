<script setup lang="ts">
import type { PolicyCategory } from '~/utils/policyPicker'
import {
  IconChevronDown,
  IconFolder,
  IconSearch,
  IconX,
} from '@tabler/icons-vue'
import ProxyNodeCard from '~/components/ProxyNodeCard.vue'
import ProxyNodeChip from '~/components/ProxyNodeChip.vue'
import ProxyNodeListItem from '~/components/ProxyNodeListItem.vue'
import ProxyNodeTableRow from '~/components/ProxyNodeTableRow.vue'
import {
  PROXIES_CARD_SIZE_GAP,
  PROXIES_CARD_SIZE_MIN_WIDTH,
  PROXIES_DISPLAY_MODE,
} from '~/constants'
import { filterPolicyNodes, groupPolicyNodes } from '~/utils/policyPicker'

const props = defineProps<{
  groupName: string
  names: string[]
  selectedName: string
  testUrl: string | null
  timeout: number | null
  recommendedName?: string | null
  listMode?: boolean
  keyword?: string
  hideSearch?: boolean
}>()
const emit = defineEmits<{ select: [name: string] }>()
const { t } = useI18n()
const proxiesStore = useProxiesStore()
const configStore = useConfigStore()
const endpointStore = useEndpointStore()

interface PickerState {
  query: string
  expanded: Record<string, boolean>
}
// Keep each policy's search/folders across collapse/remount; only in browser
// memory, scoped by backend. No settings are written to the router or core.
const pickerStates = useState<Record<string, PickerState>>(
  'policy-picker',
  () => ({}),
)
const stateKey = computed(() =>
  JSON.stringify([endpointStore.selectedEndpoint, props.groupName]),
)
watch(
  stateKey,
  (key) => {
    if (!pickerStates.value[key])
      pickerStates.value[key] = { query: '', expanded: {} }
  },
  { immediate: true, flush: 'sync' },
)
const state = computed(() => pickerStates.value[stateKey.value]!)
const keyword = computed(() => props.keyword ?? state.value.query)
const searchClosed = ref(new Set<string>())
const limits = ref<Record<string, number>>({})
watch(
  () => keyword.value,
  () => {
    searchClosed.value = new Set()
    limits.value = {}
  },
)

const providerIndex = computed(() => {
  const map = new Map<string, string>()
  for (const provider of proxiesStore.proxyProviders) {
    for (const node of provider.proxies) {
      if (!map.has(node.name)) map.set(node.name, provider.name)
    }
  }
  return map
})
const categories = computed(() =>
  groupPolicyNodes(
    props.names,
    new Set(proxiesStore.proxies.map((group) => group.name)),
    proxiesStore.getNode,
    (name) => providerIndex.value.get(name),
  ),
)
function label(category: PolicyCategory) {
  if (category.kind === 'groups') return t('policyPicker.groups')
  if (category.kind === 'custom') return t('policyPicker.custom')
  if (category.kind === 'system') return t('policyPicker.system')
  return category.label
}
const searching = computed(() => !!keyword.value.trim())
const visibleCategories = computed(() =>
  categories.value
    .map((category) => ({
      ...category,
      visible: filterPolicyNodes(
        category.names,
        keyword.value,
        label(category),
      ),
    }))
    .filter((category) => category.visible.length),
)
const resultCount = computed(() =>
  visibleCategories.value.reduce(
    (n, category) => n + category.visible.length,
    0,
  ),
)

function isOpen(category: PolicyCategory) {
  if (searching.value) return !searchClosed.value.has(category.id)
  return (
    state.value.expanded[category.id] ??
    (category.kind === 'groups' || category.names.includes(props.selectedName))
  )
}
function toggle(category: PolicyCategory) {
  if (searching.value) {
    const next = new Set(searchClosed.value)
    if (next.has(category.id)) next.delete(category.id)
    else next.add(category.id)
    searchClosed.value = next
  } else {
    state.value.expanded[category.id] = !isOpen(category)
  }
}
const allExpanded = computed(
  () =>
    visibleCategories.value.length > 0 && visibleCategories.value.every(isOpen),
)
function toggleAll() {
  const expand = !allExpanded.value
  if (searching.value)
    searchClosed.value = expand
      ? new Set()
      : new Set(visibleCategories.value.map((c) => c.id))
  else
    for (const category of categories.value)
      state.value.expanded[category.id] = expand
}

const mode = computed(() =>
  props.listMode ? PROXIES_DISPLAY_MODE.LIST : configStore.proxiesDisplayMode,
)
const nodeComponent = computed(() => {
  if (mode.value === PROXIES_DISPLAY_MODE.LIST) return ProxyNodeListItem
  if (mode.value === PROXIES_DISPLAY_MODE.CHIPS) return ProxyNodeChip
  if (mode.value === PROXIES_DISPLAY_MODE.TABLE) return ProxyNodeTableRow
  return ProxyNodeCard
})
const layout = computed(() => {
  if (mode.value === PROXIES_DISPLAY_MODE.CARD) return 'grid'
  if (mode.value === PROXIES_DISPLAY_MODE.CHIPS) return 'flex flex-wrap gap-2'
  return 'flex flex-col gap-2'
})
const gridStyle = computed(() =>
  mode.value === PROXIES_DISPLAY_MODE.CARD
    ? {
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${PROXIES_CARD_SIZE_MIN_WIDTH[configStore.proxiesCardSize]}px), 1fr))`,
        gap: `${PROXIES_CARD_SIZE_GAP[configStore.proxiesCardSize]}px`,
      }
    : undefined,
)
function limit(category: PolicyCategory) {
  return Math.max(
    limits.value[category.id] ?? 50,
    category.names.indexOf(props.selectedName) + 1,
  )
}
function revealSelected() {
  const category = categories.value.find((c) =>
    c.names.includes(props.selectedName),
  )
  if (!category) return
  state.value.expanded[category.id] = true
  const next = new Set(searchClosed.value)
  next.delete(category.id)
  searchClosed.value = next
}
defineExpose({ revealSelected })
</script>

<template>
  <div
    class="flex w-full min-w-0 flex-col gap-3"
    style="grid-column: 1 / -1"
    :data-policy-picker="groupName"
  >
    <div v-if="!hideSearch" class="flex flex-wrap items-center gap-2">
      <label
        class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-base-content/15 bg-base-100/60 px-3 py-2 focus-within:border-primary/50"
      >
        <IconSearch :size="16" class="shrink-0 text-base-content/50" />
        <input
          v-model="state.query"
          type="search"
          class="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-base-content/40 [&::-webkit-search-cancel-button]:appearance-none"
          :aria-label="t('policyPicker.searchIn', { group: groupName })"
          :placeholder="t('policyPicker.search')"
          @keydown.esc="state.query = ''"
        />
        <button
          v-if="state.query"
          type="button"
          class="rounded p-1 hover:bg-base-content/10"
          :aria-label="t('clear')"
          @click="state.query = ''"
        >
          <IconX :size="14" />
        </button>
      </label>
      <button
        type="button"
        class="rounded-lg px-2 py-2 text-xs text-base-content/60 hover:bg-base-content/8 hover:text-primary"
        @click="toggleAll"
      >
        {{
          allExpanded ? t('policyPicker.collapse') : t('policyPicker.expand')
        }}
      </button>
    </div>
    <div
      v-if="!hideSearch"
      class="flex items-center gap-2 text-xs text-base-content/50"
      role="status"
      aria-live="polite"
    >
      <span>{{
        t('policyPicker.results', { count: resultCount, total: names.length })
      }}</span>
      <span
        v-if="
          searching &&
          !visibleCategories.some((c) => c.visible.includes(selectedName))
        "
        class="min-w-0 truncate"
        :title="selectedName"
      >
        · {{ t('policyPicker.selectedOutside') }}
      </span>
    </div>
    <section
      v-for="category in visibleCategories"
      :key="category.id"
      class="min-w-0 rounded-lg border border-base-content/10 bg-base-100/20"
      :data-policy-category="category.id"
    >
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm transition-colors hover:bg-base-content/5"
        :aria-expanded="isOpen(category)"
        @click="toggle(category)"
      >
        <IconChevronDown
          :size="16"
          class="shrink-0 text-base-content/50 transition-transform"
          :class="isOpen(category) ? '' : '-rotate-90'"
        />
        <IconFolder :size="17" class="shrink-0 text-primary/70" />
        <span class="min-w-0 truncate font-semibold">{{
          label(category)
        }}</span>
        <span
          class="rounded-md bg-base-content/8 px-1.5 py-0.5 text-xs text-base-content/50"
          >{{
            searching
              ? `${category.visible.length} / ${category.names.length}`
              : category.names.length
          }}</span
        >
        <span
          v-if="category.names.includes(selectedName)"
          class="ml-auto shrink-0 rounded-md bg-primary/15 px-2 py-0.5 text-xs text-primary"
          >{{ t('policyPicker.selected') }}</span
        >
      </button>
      <div v-if="isOpen(category)" class="min-w-0 px-2 pb-2 sm:px-3 sm:pb-3">
        <div :class="layout" :style="gridStyle">
          <component
            :is="nodeComponent"
            v-for="name in category.visible.slice(0, limit(category))"
            :key="name"
            :proxy-name="name"
            :test-url="testUrl"
            :timeout="timeout"
            :is-selected="selectedName === name"
            :data-selected="selectedName === name ? 'true' : undefined"
            :data-policy-node="name"
            v-bind="
              nodeComponent === ProxyNodeCard
                ? { isRecommended: recommendedName === name, groupName }
                : {}
            "
            @click="emit('select', name)"
          />
        </div>
        <button
          v-if="category.visible.length > limit(category)"
          type="button"
          class="mt-3 w-full rounded-lg border border-base-content/10 px-3 py-2 text-sm text-primary hover:bg-primary/10"
          @click="limits[category.id] = limit(category) + 50"
        >
          {{
            t('policyPicker.more', {
              count: category.visible.length - limit(category),
            })
          }}
        </button>
      </div>
    </section>
    <div
      v-if="!resultCount"
      class="rounded-lg border border-dashed border-base-content/15 px-4 py-8 text-center text-sm text-base-content/50"
    >
      {{ t('policyPicker.empty') }}
    </div>
  </div>
</template>
