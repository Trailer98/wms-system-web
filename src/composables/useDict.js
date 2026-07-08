import { reactive } from 'vue'
import { getDictBatch } from '../api/sysDict'

// Module-scoped (not per-component) on purpose: every page that calls useDict() shares one cache, so
// navigating between pages in the same SPA session never re-fetches a dict it already has. A real
// browser refresh clears this (it's just JS memory), which is the "refresh reloads" behavior the
// dictionary admin page relies on to show edits made elsewhere.
const dictCache = reactive({})
const pendingFetches = new Map()

const fetchMissing = async (dictCodes) => {
  const missing = dictCodes.filter((code) => !(code in dictCache) && !pendingFetches.has(code))
  if (!missing.length) return

  const fetchPromise = getDictBatch(missing)
    .then((result) => {
      missing.forEach((code) => {
        dictCache[code] = Array.isArray(result[code]) ? result[code] : []
      })
    })
    .catch(() => {
      // Never let a dictionary outage break the page: leave these codes uncached so every label call
      // falls back to the raw value below, and let a later preload attempt retry.
      missing.forEach((code) => {
        if (!(code in dictCache)) dictCache[code] = []
      })
    })
    .finally(() => {
      missing.forEach((code) => pendingFetches.delete(code))
    })

  missing.forEach((code) => pendingFetches.set(code, fetchPromise))
  await fetchPromise
}

/**
 * @param {string[]} dictCodes dict codes this component will need labels/options for
 * @returns {{
 *   preload: () => Promise<void>,
 *   getDictLabel: (dictCode: string, value: string) => string,
 *   getDictTagType: (dictCode: string, value: string) => string,
 *   getDictOptions: (dictCode: string) => Array<{label: string, value: string}>
 * }}
 */
export function useDict(dictCodes = []) {
  const preload = () => fetchMissing(dictCodes)

  const getDictLabel = (dictCode, value) => {
    if (value === null || value === undefined || value === '') return value
    const items = dictCache[dictCode]
    const match = items?.find((item) => item.value === value)
    return match ? match.label : value
  }

  const getDictTagType = (dictCode, value) => {
    const items = dictCache[dictCode]
    return items?.find((item) => item.value === value)?.tagType || ''
  }

  const getDictOptions = (dictCode) => {
    const items = dictCache[dictCode]
    if (!items) return []
    return items.map((item) => ({ label: item.label, value: item.value }))
  }

  return { preload, getDictLabel, getDictTagType, getDictOptions }
}
