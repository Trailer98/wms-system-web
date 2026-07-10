<template>
  <div class="common-data-table">
    <el-table
      v-loading="loading"
      :data="data"
      :border="border"
      :stripe="stripe"
      :empty-text="emptyText"
      :row-key="rowKey"
      class="common-data-table__table"
      v-bind="tableProps"
    >
      <el-table-column
        v-for="column in columns"
        :key="column.key || column.prop || column.label"
        :prop="column.prop"
        :label="column.label"
        :width="column.width"
        :min-width="column.minWidth"
        :fixed="column.fixed"
        :align="column.align"
        :show-overflow-tooltip="column.showOverflowTooltip"
      >
        <template #default="{ row, $index }">
          <slot
            v-if="column.slot"
            :name="column.slot"
            :row="row"
            :column="column"
            :index="$index"
          >
            {{ getColumnValue(row, column, $index) }}
          </slot>
          <span v-else>{{ getColumnValue(row, column, $index) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="showPagination" class="common-data-table__pagination">
      <el-pagination
        :current-page="pagination.pageNum"
        :page-size="pagination.pageSize"
        :page-sizes="pageSizes"
        :total="Number(pagination.total) || 0"
        :layout="paginationLayout"
        background
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  pagination: {
    type: Object,
    default: () => ({
      pageNum: 1,
      pageSize: 20,
      total: 0
    })
  },
  showPagination: {
    type: Boolean,
    default: true
  },
  pageSizes: {
    type: Array,
    default: () => [10, 20, 50, 100]
  },
  paginationLayout: {
    type: String,
    default: 'total, sizes, prev, pager, next, jumper'
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  border: {
    type: Boolean,
    default: true
  },
  stripe: {
    type: Boolean,
    default: true
  },
  tableProps: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['pagination-change'])

const getColumnValue = (row, column, index) => {
  if (typeof column.formatter === 'function') {
    return column.formatter(row, column, index)
  }

  if (!column.prop) return '-'

  const value = column.prop.split('.').reduce((result, key) => {
    return result?.[key]
  }, row)

  return value ?? '-'
}

const handleSizeChange = (pageSize) => {
  props.pagination.pageSize = pageSize
  props.pagination.pageNum = 1
  emit('pagination-change')
}

const handleCurrentChange = (pageNum) => {
  props.pagination.pageNum = pageNum
  emit('pagination-change')
}
</script>

<style scoped>
.common-data-table__table {
  width: 100%;
}

.common-data-table__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

@media (max-width: 768px) {
  .common-data-table__pagination {
    justify-content: flex-start;
  }
}
</style>
