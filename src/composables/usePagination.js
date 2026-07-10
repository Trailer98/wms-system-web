import { reactive } from 'vue'

/**
 * Lightweight, opt-in pagination helper for list pages. Designed to sit alongside the existing
 * {@code CommonDataTable} contract (which mutates the passed `pagination` object's pageNum/pageSize
 * directly and emits `pagination-change`), NOT to replace it — so a page can adopt this for the
 * reactive state + the reset/after-removal behaviors while still driving the table the same way as
 * every other page. Kept deliberately small (no fetch orchestration, no watchers) to match this
 * project's "no big refactor" convention: the page still owns its own `fetch()` function.
 *
 * Standard behaviors this centralizes:
 *  - `pagination` reactive ({ pageNum, pageSize, total }) to hand straight to CommonDataTable.
 *  - `resetToFirstPage()` — for the 查询 (search) and 重置 (reset) buttons.
 *  - `pageParams()` — spreads pageNum/pageSize into a request params object.
 *  - `adjustPageAfterRemoval(removedCount)` — implements the "删除后刷新当前页，若当前页被删空且
 *    pageNum > 1 则回退上一页再查" rule: returns true if pageNum was decremented, so the caller knows
 *    the subsequent fetch will land on the right page.
 *
 * @param {{ pageSize?: number }} [options]
 */
export function usePagination(options = {}) {
  const pagination = reactive({
    pageNum: 1,
    pageSize: options.pageSize ?? 20,
    total: 0
  })

  const resetToFirstPage = () => {
    pagination.pageNum = 1
  }

  const pageParams = (filters = {}) => ({
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    ...filters
  })

  /**
   * Call after a delete/removal succeeds, before re-fetching. If everything currently on the page
   * was removed and we're past page 1, step back one page so the user doesn't land on an empty page.
   * @param {number} [removedCount=1] how many rows were just removed from the current page
   * @returns {boolean} whether pageNum was decremented
   */
  const adjustPageAfterRemoval = (removedCount = 1) => {
    const remainingOnPage = pagination.total - (pagination.pageNum - 1) * pagination.pageSize - removedCount
    if (remainingOnPage <= 0 && pagination.pageNum > 1) {
      pagination.pageNum -= 1
      return true
    }
    return false
  }

  return { pagination, resetToFirstPage, pageParams, adjustPageAfterRemoval }
}
