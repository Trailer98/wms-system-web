<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>库存调整</h2>
        <p>基于现有库存记录人工修正现存量或在正常区/异常区之间转移，新增调整单后需提交、确认才会真正变更库存。</p>
      </div>
      <el-button v-if="authStore.hasPermission('stock-adjust:create')" type="primary" @click="openCreateDialog">新增调整单</el-button>
    </div>

    <CommonQueryForm
      :model="queryForm"
      :fields="queryFields"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
    />

    <CommonDataTable
      :data="orders"
      :columns="tableColumns"
      :loading="loading"
      :pagination="pagination"
      empty-text="暂无库存调整单数据"
      @pagination-change="fetchOrders"
    >
      <template #status="{ row }">
        <el-tag :type="statusTagType(row.status)" effect="plain">{{ statusLabel(row.status) }}</el-tag>
      </template>
      <template #reasonType="{ row }">{{ reasonTypeLabel(row.reasonType) }}</template>
      <template #actions="{ row }">
        <el-button type="primary" link @click="openDetail(row)">详情</el-button>
        <el-button v-if="row.status === 'DRAFT' && authStore.hasPermission('stock-adjust:update')" type="primary" link @click="openEditDialog(row)">编辑</el-button>
        <el-button v-if="row.status === 'DRAFT' && authStore.hasPermission('stock-adjust:submit')" type="success" link :loading="actionLoadingId === row.id" @click="submitOrder(row)">提交</el-button>
        <el-button v-if="row.status === 'SUBMITTED' && authStore.hasPermission('stock-adjust:confirm')" type="success" link :loading="actionLoadingId === row.id" @click="confirmOrder(row)">确认</el-button>
        <el-button v-if="(row.status === 'DRAFT' || row.status === 'SUBMITTED') && authStore.hasPermission('stock-adjust:cancel')" type="danger" link :loading="actionLoadingId === row.id" @click="cancelOrder(row)">取消</el-button>
      </template>
    </CommonDataTable>

    <el-dialog v-model="formDialogVisible" :title="isEditMode ? '编辑库存调整单' : '新增库存调整单'" width="1040px">
      <el-form ref="orderFormRef" :model="orderForm" :rules="orderRules" label-width="90px">
        <el-row :gutter="16">
          <el-col :xs="24" :md="8">
            <el-form-item label="调整单号" prop="adjustNo">
              <el-input v-model.trim="orderForm.adjustNo" maxlength="64" show-word-limit placeholder="保存时由系统自动生成" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label="仓库" prop="warehouseId">
              <el-select v-model="orderForm.warehouseId" filterable placeholder="请选择仓库" :disabled="isEditMode" @change="handleWarehouseChange">
                <el-option v-for="warehouse in warehouses" :key="warehouse.id" :label="`${warehouse.code} - ${warehouse.name}`" :value="warehouse.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="8">
            <el-form-item label="调整原因" prop="reasonType">
              <el-select v-model="orderForm.reasonType" placeholder="请选择调整原因">
                <el-option v-for="option in reasonTypeOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model.trim="orderForm.reason" maxlength="255" placeholder="请输入调整说明" />
        </el-form-item>

        <el-alert
          v-if="isDamageOrQualityIssueReason(orderForm.reasonType)"
          type="warning"
          :closable="false"
          show-icon
          class="reason-hint"
          title="破损、质量问题不能直接调减库存，请为相关明细选择「转异常区」动作，实物仍然存在，只是转入异常区并冻结"
        />

        <div class="items-header">
          <h3>明细</h3>
          <el-button :disabled="!orderForm.warehouseId" @click="addItem">新增明细</el-button>
        </div>

        <el-table :data="orderForm.items" border class="order-items-table">
          <el-table-column label="调整动作" width="160">
            <template #default="{ row }">
              <el-select v-model="row.adjustAction" placeholder="动作" @change="() => handleActionChange(row)">
                <el-option v-for="option in adjustActionOptions" :key="option.value" :label="option.label" :value="option.value" />
              </el-select>
              <div v-if="row.adjustAction === 'TRANSFER_TO_EXCEPTION'" class="action-hint">
                不减少库存总量，转入异常区并冻结，不生成财务事件
              </div>
              <div v-else-if="row.adjustAction === 'RESTORE_FROM_EXCEPTION'" class="action-hint">
                恢复为可用库存，不生成财务事件
              </div>
            </template>
          </el-table-column>

          <el-table-column label="源库存 / SKU" min-width="260">
            <template #default="{ row, $index }">
              <div v-if="row.mode === 'inventory'" class="inventory-cell">
                <template v-if="row.inventoryId">
                  <div class="inventory-cell__sku">{{ row.skuCode }} - {{ row.skuName }}</div>
                  <div class="inventory-cell__location">
                    {{ row.warehouseCode }} / {{ row.areaCode }} / {{ row.locationCode }}
                    <el-tag v-if="row.inventoryStatus === 'EXCEPTION'" size="small" type="danger" effect="plain">异常区</el-tag>
                  </div>
                  <div class="inventory-cell__snapshot">
                    现存 {{ row.onHandQty }} · 锁定 {{ row.lockedQty }} · 冻结 {{ row.frozenQty }} · 可用 {{ row.availableQty }}
                  </div>
                </template>
                <el-button size="small" @click="openInventoryPicker($index)">{{ row.inventoryId ? '重新选择' : '选择库存' }}</el-button>
                <el-button
                  v-if="row.adjustAction === 'QUANTITY_INCREASE'"
                  size="small"
                  type="warning"
                  link
                  @click="toggleOffBookMode(row)"
                >切换为账外调增</el-button>
              </div>
              <div v-else class="offbook-cell">
                <el-alert type="warning" :closable="false" show-icon class="offbook-cell__alert">
                  该操作用于处理现场发现但系统未记录的库存，只允许调增，会创建新的库存记录或增加目标库位库存。
                </el-alert>
                <el-select v-model="row.skuId" filterable placeholder="请选择 SKU" size="small" class="offbook-cell__select">
                  <el-option v-for="sku in skus" :key="sku.id" :label="`${sku.code} - ${sku.name}`" :value="sku.id" />
                </el-select>
                <el-select v-model="row.areaId" filterable placeholder="库区" size="small" class="offbook-cell__select" :disabled="!areaOptions.length" @change="() => handleItemAreaChange(row)">
                  <el-option v-for="area in areaOptions" :key="area.id" :label="`${area.areaCode} - ${area.areaName}`" :value="area.id" />
                </el-select>
                <el-select v-model="row.locationId" filterable placeholder="库位" size="small" class="offbook-cell__select" :disabled="!row.locationOptions.length">
                  <el-option v-for="location in row.locationOptions" :key="location.id" :label="location.locationCode" :value="location.id" />
                </el-select>
                <el-button size="small" link @click="toggleOffBookMode(row)">改为选择已有库存</el-button>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="目标库区 / 库位" min-width="220">
            <template #default="{ row }">
              <template v-if="row.adjustAction === 'TRANSFER_TO_EXCEPTION' || row.adjustAction === 'RESTORE_FROM_EXCEPTION'">
                <el-select
                  v-model="row.targetAreaId"
                  filterable
                  placeholder="目标库区"
                  size="small"
                  class="offbook-cell__select"
                  :disabled="!row.targetAreaOptions.length"
                  @change="() => handleTargetAreaChange(row)"
                >
                  <el-option v-for="area in row.targetAreaOptions" :key="area.id" :label="`${area.areaCode} - ${area.areaName}`" :value="area.id" />
                </el-select>
                <el-select
                  v-model="row.targetLocationId"
                  filterable
                  placeholder="目标库位"
                  size="small"
                  class="offbook-cell__select target-location-select"
                  :disabled="!row.targetLocationOptions.length"
                >
                  <el-option v-for="location in row.targetLocationOptions" :key="location.id" :label="location.locationCode" :value="location.id" />
                </el-select>
              </template>
              <span v-else class="target-cell__placeholder">-</span>
            </template>
          </el-table-column>

          <el-table-column label="数量" width="140">
            <template #default="{ row }">
              <el-input-number v-model="row.adjustQty" :min="1" :precision="0" controls-position="right" />
            </template>
          </el-table-column>
          <el-table-column label="备注" min-width="140">
            <template #default="{ row }">
              <el-input v-model.trim="row.remark" maxlength="255" placeholder="备注" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" :disabled="orderForm.items.length === 1" @click="removeItem($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="inventoryPickerVisible" title="选择库存记录" width="960px" append-to-body>
      <CommonQueryForm
        :model="pickerQueryForm"
        :fields="pickerQueryFields"
        :loading="pickerLoading"
        @search="handlePickerSearch"
        @reset="handlePickerReset"
      />
      <CommonDataTable
        :data="pickerInventories"
        :columns="pickerColumns"
        :loading="pickerLoading"
        :pagination="pickerPagination"
        empty-text="暂无可选库存"
        @pagination-change="fetchPickerInventories"
      >
        <template #areaType="{ row }">
          <el-tag v-if="row.inventoryStatus === 'EXCEPTION'" size="small" type="danger" effect="plain">异常区</el-tag>
          <span v-else>{{ row.areaType || '-' }}</span>
        </template>
        <template #pickerActions="{ row }">
          <el-button type="primary" link @click="selectInventory(row)">选择</el-button>
        </template>
      </CommonDataTable>
    </el-dialog>

    <el-dialog v-model="detailVisible" title="库存调整单详情" width="960px">
      <el-descriptions v-if="activeOrder" :column="2" border>
        <el-descriptions-item label="调整单号">{{ activeOrder.adjustNo }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabel(activeOrder.status) }}</el-descriptions-item>
        <el-descriptions-item label="仓库">{{ activeOrder.warehouseCode }}</el-descriptions-item>
        <el-descriptions-item label="调整原因">{{ reasonTypeLabel(activeOrder.reasonType) }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ activeOrder.reason || '-' }}</el-descriptions-item>
        <el-descriptions-item label="创建人">{{ activeOrder.createdBy || '-' }}</el-descriptions-item>
        <el-descriptions-item label="确认人">{{ activeOrder.confirmedBy || '-' }}</el-descriptions-item>
      </el-descriptions>
      <CommonDataTable
        class="detail-items-table"
        :data="activeOrder?.items || []"
        :columns="detailColumns"
        :show-pagination="false"
        empty-text="暂无明细"
      >
        <template #adjustAction="{ row }">{{ adjustActionLabel(row.adjustAction) }}</template>
        <template #source="{ row }">
          <el-tag v-if="row.offBookIncrease" type="warning" effect="plain">账外调增</el-tag>
          <span v-else>已有库存</span>
        </template>
        <template #target="{ row }">
          <span v-if="row.targetAreaCode">{{ row.targetAreaCode }} / {{ row.targetLocationCode || '-' }}</span>
          <span v-else>-</span>
        </template>
        <template #holdStatus="{ row }">
          <el-tag v-if="row.holdStatus && row.holdStatus !== 'NONE'" size="small" :type="holdStatusTagType(row.holdStatus)" effect="plain">
            {{ holdStatusLabel(row.holdStatus) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </CommonDataTable>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, inject, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import CommonDataTable from '../components/common/CommonDataTable.vue'
import CommonQueryForm from '../components/common/CommonQueryForm.vue'
import { useAuthStore } from '../stores/auth'
import { formatDateTime, normalizePageResponse, unwrapApiData } from '../utils/apiResponse'

const axios = inject('$axios')
const authStore = useAuthStore()
const route = useRoute()

const loading = ref(false)
const saving = ref(false)
const actionLoadingId = ref(null)
const orders = ref([])
const warehouses = ref([])
const skus = ref([])
const areaOptions = ref([])
const formDialogVisible = ref(false)
const detailVisible = ref(false)
const activeOrder = ref(null)
const activeOrderId = ref(null)
const orderFormRef = ref()

const inventoryPickerVisible = ref(false)
const pickerLoading = ref(false)
const pickerInventories = ref([])
const pickerPagination = reactive({ pageNum: 1, pageSize: 20, total: 0 })
const activeItemIndex = ref(null)

const isEditMode = computed(() => !!activeOrderId.value)

const queryForm = reactive({
  adjustNo: '',
  status: '',
  reasonType: ''
})

const pagination = reactive({ pageNum: 1, pageSize: 20, total: 0 })

const reasonTypeOptions = [
  { label: '破损', value: 'DAMAGE' },
  { label: '丢失', value: 'LOST' },
  { label: '找到库存', value: 'FOUND' },
  { label: '数据错误', value: 'DATA_ERROR' },
  { label: '质量异常', value: 'QUALITY_ISSUE' },
  { label: '盘点差异', value: 'COUNT_DIFF' },
  { label: '其他', value: 'OTHER' }
]

const statusOptions = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已提交', value: 'SUBMITTED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' }
]

const adjustActionOptions = [
  { label: '数量调增', value: 'QUANTITY_INCREASE' },
  { label: '数量调减', value: 'QUANTITY_DECREASE' },
  { label: '转异常区', value: 'TRANSFER_TO_EXCEPTION' },
  { label: '异常恢复正常', value: 'RESTORE_FROM_EXCEPTION' }
]

const holdStatusOptions = [
  { label: '无冻结', value: 'NONE' },
  { label: '已冻结', value: 'HELD' },
  { label: '已释放', value: 'RELEASED' },
  { label: '已消耗', value: 'CONSUMED' }
]

const inventoryStatusOptions = [
  { label: '正常', value: 'NORMAL' },
  { label: '异常', value: 'EXCEPTION' }
]

const queryFields = [
  { prop: 'adjustNo', label: '调整单号', type: 'input', placeholder: '请输入调整单号', trim: true },
  { prop: 'status', label: '状态', type: 'select', placeholder: '请选择状态', options: statusOptions },
  { prop: 'reasonType', label: '调整原因', type: 'select', placeholder: '请选择原因', options: reasonTypeOptions }
]

const tableColumns = [
  { prop: 'adjustNo', label: '调整单号', minWidth: 160 },
  { label: '状态', width: 100, slot: 'status', align: 'center' },
  { label: '原因', width: 110, slot: 'reasonType' },
  { prop: 'reason', label: '调整说明', minWidth: 160, showOverflowTooltip: true },
  { prop: 'createdBy', label: '创建人', width: 100 },
  { prop: 'confirmedBy', label: '确认人', width: 100 },
  { label: '创建时间', minWidth: 170, formatter: (row) => formatDateTime(row.createdAt) },
  { label: '操作', width: 260, slot: 'actions', fixed: 'right', align: 'center' }
]

const detailColumns = [
  { label: '来源', width: 100, slot: 'source' },
  { prop: 'skuCode', label: 'SKU', minWidth: 130, formatter: (row) => `${row.skuCode || ''} ${row.skuName || ''}`.trim() || '-' },
  { prop: 'areaCode', label: '库区', width: 90 },
  { prop: 'locationCode', label: '库位', width: 90 },
  { label: '动作', width: 110, slot: 'adjustAction' },
  { prop: 'adjustQty', label: '数量', width: 80, align: 'right' },
  { label: '目标库区/库位', width: 150, slot: 'target' },
  { label: '冻结状态', width: 90, slot: 'holdStatus' },
  { prop: 'beforeOnHandQty', label: '调整前现存量', width: 110, align: 'right' },
  { prop: 'afterOnHandQty', label: '调整后现存量', width: 110, align: 'right' },
  { prop: 'beforeAvailableQty', label: '调整前可用量', width: 110, align: 'right' },
  { prop: 'afterAvailableQty', label: '调整后可用量', width: 110, align: 'right' },
  { prop: 'remark', label: '备注', minWidth: 120, showOverflowTooltip: true }
]

const pickerQueryForm = reactive({
  skuCode: '',
  areaId: '',
  locationCode: '',
  inventoryStatus: ''
})

const pickerQueryFields = computed(() => [
  { prop: 'skuCode', label: 'SKU 编码', type: 'input', placeholder: '请输入 SKU 编码', trim: true },
  { prop: 'areaId', label: '库区', type: 'select', placeholder: '请选择库区', options: areaOptions.value.map((area) => ({ label: `${area.areaCode} - ${area.areaName}`, value: area.id })) },
  { prop: 'locationCode', label: '库位', type: 'input', placeholder: '请输入库位编码（可选）', trim: true },
  { prop: 'inventoryStatus', label: '库存状态', type: 'select', placeholder: '不限', options: inventoryStatusOptions }
])

const pickerColumns = [
  { prop: 'skuCode', label: 'SKU', minWidth: 140, formatter: (row) => `${row.skuCode} - ${row.skuName}` },
  { prop: 'areaCode', label: '库区', width: 100 },
  { label: '库区类型', width: 100, slot: 'areaType' },
  { prop: 'locationCode', label: '库位', width: 100 },
  { prop: 'quantity', label: '现存量', width: 90, align: 'right' },
  { prop: 'reservedQuantity', label: '锁定量', width: 90, align: 'right' },
  { prop: 'frozenQuantity', label: '冻结量', width: 90, align: 'right' },
  { prop: 'availableQuantity', label: '可用量', width: 90, align: 'right' },
  { label: '操作', width: 80, slot: 'pickerActions', align: 'center' }
]

const reasonTypeLabel = (value) => reasonTypeOptions.find((option) => option.value === value)?.label || value || '-'
const statusLabel = (value) => statusOptions.find((option) => option.value === value)?.label || value || '-'
const adjustActionLabel = (value) => adjustActionOptions.find((option) => option.value === value)?.label || value || '-'
const holdStatusLabel = (value) => holdStatusOptions.find((option) => option.value === value)?.label || value || '-'
const holdStatusTagType = (value) => {
  if (value === 'HELD') return 'warning'
  if (value === 'CONSUMED') return 'success'
  return 'info'
}
const statusTagType = (status) => {
  if (status === 'COMPLETED') return 'success'
  if (status === 'CANCELLED') return 'info'
  if (status === 'SUBMITTED') return 'warning'
  return 'primary'
}
const isDamageOrQualityIssueReason = (reasonType) => reasonType === 'DAMAGE' || reasonType === 'QUALITY_ISSUE'

const filterTargetAreaOptions = (action) => {
  if (action === 'TRANSFER_TO_EXCEPTION') {
    return areaOptions.value.filter((area) => area.areaType === 'EXCEPTION')
  }
  if (action === 'RESTORE_FROM_EXCEPTION') {
    return areaOptions.value.filter((area) => area.areaType !== 'EXCEPTION')
  }
  return []
}

const initialItem = () => ({
  mode: 'inventory',
  adjustAction: 'QUANTITY_INCREASE',
  inventoryId: null,
  skuCode: '',
  skuName: '',
  warehouseCode: '',
  areaCode: '',
  inventoryStatus: '',
  locationCode: '',
  onHandQty: 0,
  lockedQty: 0,
  frozenQty: 0,
  availableQty: 0,
  skuId: '',
  areaId: '',
  locationId: '',
  locationOptions: [],
  targetAreaId: '',
  targetLocationId: '',
  targetAreaOptions: [],
  targetLocationOptions: [],
  adjustQty: 1,
  remark: ''
})

const orderForm = reactive({
  adjustNo: '',
  warehouseId: '',
  reasonType: '',
  reason: '',
  items: [initialItem()]
})

const orderRules = {
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  reasonType: [{ required: true, message: '请选择调整原因', trigger: 'change' }]
}

const fetchOptions = async () => {
  const [warehouseResponse, skuResponse] = await Promise.all([
    axios.get('/warehouses', { params: { pageNum: 1, pageSize: 100 } }),
    axios.get('/skus', { params: { pageNum: 1, pageSize: 100 } })
  ])
  warehouses.value = normalizePageResponse(warehouseResponse).rows
  skus.value = normalizePageResponse(skuResponse).rows
}

const loadUsableAreas = async (warehouseId) => {
  if (!warehouseId) return []
  const response = await axios.get(`/warehouse-areas/by-warehouse/${warehouseId}`)
  const data = unwrapApiData(response)
  return (Array.isArray(data) ? data : []).filter((area) => area.status === 'ENABLED')
}

const loadUsableLocations = async (areaId) => {
  if (!areaId) return []
  const response = await axios.get(`/warehouse-locations/by-area/${areaId}`)
  const data = unwrapApiData(response)
  return (Array.isArray(data) ? data : []).filter((location) => location.status === 'ENABLED')
}

const handleWarehouseChange = async () => {
  orderForm.items = [initialItem()]
  areaOptions.value = await loadUsableAreas(orderForm.warehouseId)
}

const handleItemAreaChange = async (item) => {
  item.locationId = ''
  item.locationOptions = await loadUsableLocations(item.areaId)
}

const handleActionChange = (row) => {
  if (row.adjustAction !== 'QUANTITY_INCREASE' && row.mode === 'offbook') {
    row.mode = 'inventory'
  }
  row.targetAreaId = ''
  row.targetLocationId = ''
  row.targetLocationOptions = []
  row.targetAreaOptions = filterTargetAreaOptions(row.adjustAction)
}

const handleTargetAreaChange = async (row) => {
  row.targetLocationId = ''
  row.targetLocationOptions = await loadUsableLocations(row.targetAreaId)
}

const addItem = () => {
  orderForm.items.push(initialItem())
}

const removeItem = (index) => {
  orderForm.items.splice(index, 1)
}

const toggleOffBookMode = (row) => {
  const index = orderForm.items.indexOf(row)
  if (index === -1) return
  if (row.mode === 'inventory') {
    orderForm.items.splice(index, 1, {
      ...initialItem(),
      mode: 'offbook',
      adjustAction: 'QUANTITY_INCREASE',
      adjustQty: row.adjustQty,
      remark: row.remark
    })
  } else {
    orderForm.items.splice(index, 1, {
      ...initialItem(),
      mode: 'inventory',
      adjustAction: 'QUANTITY_INCREASE',
      adjustQty: row.adjustQty,
      remark: row.remark
    })
  }
}

const openInventoryPicker = (index) => {
  activeItemIndex.value = index
  const row = orderForm.items[index]
  pickerQueryForm.skuCode = ''
  pickerQueryForm.areaId = ''
  pickerQueryForm.locationCode = ''
  pickerQueryForm.inventoryStatus = row.adjustAction === 'TRANSFER_TO_EXCEPTION'
    ? 'NORMAL'
    : row.adjustAction === 'RESTORE_FROM_EXCEPTION'
      ? 'EXCEPTION'
      : ''
  pickerPagination.pageNum = 1
  inventoryPickerVisible.value = true
  fetchPickerInventories()
}

const fetchPickerInventories = async () => {
  pickerLoading.value = true
  try {
    const params = {
      pageNum: pickerPagination.pageNum,
      pageSize: pickerPagination.pageSize,
      warehouseId: orderForm.warehouseId,
      hasStock: true
    }
    if (pickerQueryForm.skuCode) params.skuCode = pickerQueryForm.skuCode
    if (pickerQueryForm.areaId) params.areaId = pickerQueryForm.areaId
    if (pickerQueryForm.inventoryStatus) params.inventoryStatus = pickerQueryForm.inventoryStatus
    const response = await axios.get('/inventory', { params })
    const { rows, total } = normalizePageResponse(response)
    const locationFilter = pickerQueryForm.locationCode?.trim().toLowerCase()
    pickerInventories.value = locationFilter
      ? rows.filter((row) => row.locationCode?.toLowerCase().includes(locationFilter))
      : rows
    pickerPagination.total = total
  } finally {
    pickerLoading.value = false
  }
}

const handlePickerSearch = () => {
  pickerPagination.pageNum = 1
  fetchPickerInventories()
}

const handlePickerReset = () => {
  pickerQueryForm.skuCode = ''
  pickerQueryForm.areaId = ''
  pickerQueryForm.locationCode = ''
  pickerQueryForm.inventoryStatus = ''
  pickerPagination.pageNum = 1
  fetchPickerInventories()
}

const applyInventoryToItem = (item, inventory) => {
  item.mode = 'inventory'
  item.inventoryId = inventory.id
  item.skuCode = inventory.skuCode
  item.skuName = inventory.skuName
  item.warehouseCode = inventory.warehouseCode
  item.areaCode = inventory.areaCode
  item.inventoryStatus = inventory.inventoryStatus
  item.locationCode = inventory.locationCode
  item.onHandQty = inventory.quantity
  item.lockedQty = inventory.reservedQuantity
  item.frozenQty = inventory.frozenQuantity
  item.availableQty = inventory.availableQuantity
}

const selectInventory = (row) => {
  if (activeItemIndex.value === null) return
  applyInventoryToItem(orderForm.items[activeItemIndex.value], row)
  inventoryPickerVisible.value = false
}

const buildParams = () => {
  const params = { pageNum: pagination.pageNum, pageSize: pagination.pageSize }
  if (queryForm.adjustNo) params.adjustNo = queryForm.adjustNo
  if (queryForm.status) params.status = queryForm.status
  if (queryForm.reasonType) params.reasonType = queryForm.reasonType
  return params
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const response = await axios.get('/stock-adjust-orders/page', { params: buildParams() })
    const { rows, total } = normalizePageResponse(response)
    orders.value = rows
    pagination.total = total
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  fetchOrders()
}

const handleReset = () => {
  queryForm.adjustNo = ''
  queryForm.status = ''
  queryForm.reasonType = ''
  pagination.pageNum = 1
  fetchOrders()
}

const resetForm = () => {
  orderForm.adjustNo = ''
  orderForm.warehouseId = ''
  orderForm.reasonType = ''
  orderForm.reason = ''
  orderForm.items = [initialItem()]
  areaOptions.value = []
  activeOrderId.value = null
  orderFormRef.value?.clearValidate()
}

const openCreateDialog = () => {
  resetForm()
  formDialogVisible.value = true
}

const openEditDialog = async (row) => {
  const response = await axios.get(`/stock-adjust-orders/${row.id}`)
  const order = unwrapApiData(response)
  activeOrderId.value = order.id
  orderForm.adjustNo = order.adjustNo
  orderForm.warehouseId = order.warehouseId
  orderForm.reasonType = order.reasonType
  orderForm.reason = order.reason
  areaOptions.value = await loadUsableAreas(order.warehouseId)
  orderForm.items = []
  for (const item of order.items) {
    const action = item.adjustAction || (item.adjustType === 'INCREASE' ? 'QUANTITY_INCREASE' : 'QUANTITY_DECREASE')
    if (action === 'TRANSFER_TO_EXCEPTION' || action === 'RESTORE_FROM_EXCEPTION') {
      const inventoryResponse = await axios.get(`/inventory/${item.inventoryId}`)
      const inventory = unwrapApiData(inventoryResponse)
      const newItem = { ...initialItem(), adjustAction: action, adjustQty: item.adjustQty, remark: item.remark || '' }
      applyInventoryToItem(newItem, inventory)
      newItem.targetAreaOptions = filterTargetAreaOptions(action)
      newItem.targetAreaId = item.targetAreaId
      newItem.targetLocationOptions = await loadUsableLocations(item.targetAreaId)
      newItem.targetLocationId = item.targetLocationId
      orderForm.items.push(newItem)
    } else if (item.offBookIncrease) {
      orderForm.items.push({
        ...initialItem(),
        mode: 'offbook',
        adjustAction: 'QUANTITY_INCREASE',
        skuId: item.skuId,
        areaId: item.areaId,
        locationId: item.locationId,
        locationOptions: await loadUsableLocations(item.areaId),
        adjustQty: item.adjustQty,
        remark: item.remark || ''
      })
    } else {
      const inventoryResponse = await axios.get(`/inventory/${item.inventoryId}`)
      const inventory = unwrapApiData(inventoryResponse)
      const newItem = { ...initialItem(), adjustAction: action, adjustQty: item.adjustQty, remark: item.remark || '' }
      applyInventoryToItem(newItem, inventory)
      orderForm.items.push(newItem)
    }
  }
  formDialogVisible.value = true
}

const validateItems = () => {
  if (!orderForm.items.length) {
    ElMessage.warning('请至少添加一条调整明细')
    return false
  }
  for (const item of orderForm.items) {
    if (!item.adjustQty || item.adjustQty < 1) {
      ElMessage.warning('调整数量必须大于 0')
      return false
    }

    if (item.adjustAction === 'TRANSFER_TO_EXCEPTION' || item.adjustAction === 'RESTORE_FROM_EXCEPTION') {
      if (!item.inventoryId) {
        ElMessage.warning('请先为每条转移/恢复明细选择源库存')
        return false
      }
      if (!item.targetAreaId || !item.targetLocationId) {
        ElMessage.warning('请选择目标库区和目标库位')
        return false
      }
      if (item.adjustAction === 'TRANSFER_TO_EXCEPTION' && item.adjustQty > item.availableQty) {
        ElMessage.warning(`转移数量不能超过源库存可用量（当前可用 ${item.availableQty}）`)
        return false
      }
      if (item.adjustAction === 'RESTORE_FROM_EXCEPTION' && item.adjustQty > item.onHandQty) {
        ElMessage.warning(`恢复数量不能超过源库存现存量（当前现存 ${item.onHandQty}）`)
        return false
      }
      continue
    }

    if (item.adjustAction === 'QUANTITY_DECREASE' && isDamageOrQualityIssueReason(orderForm.reasonType)) {
      ElMessage.warning('破损、质量问题不能直接调减库存，请使用「转异常区」')
      return false
    }

    if (item.mode === 'inventory') {
      if (!item.inventoryId) {
        ElMessage.warning('请先为每条明细选择库存记录，或改用账外库存调增')
        return false
      }
      if (item.adjustAction === 'QUANTITY_DECREASE' && item.adjustQty > item.availableQty) {
        ElMessage.warning(`调减数量不能超过可用量（当前可用 ${item.availableQty}）`)
        return false
      }
    } else if (!item.skuId || !item.areaId || !item.locationId) {
      ElMessage.warning('账外库存调增需要完整选择 SKU、库区和库位')
      return false
    }
  }
  return true
}

const legacyAdjustType = (action) => (action === 'QUANTITY_INCREASE' ? 'INCREASE' : 'DECREASE')

const buildItemsPayload = () => orderForm.items.map((item) => {
  if (item.adjustAction === 'TRANSFER_TO_EXCEPTION' || item.adjustAction === 'RESTORE_FROM_EXCEPTION') {
    return {
      inventoryId: item.inventoryId,
      skuId: null,
      areaId: null,
      locationId: null,
      adjustType: 'DECREASE',
      adjustAction: item.adjustAction,
      adjustQty: item.adjustQty,
      allowCreateInventory: false,
      targetWarehouseId: orderForm.warehouseId,
      targetAreaId: item.targetAreaId,
      targetLocationId: item.targetLocationId,
      remark: item.remark || null
    }
  }
  if (item.mode === 'inventory') {
    return {
      inventoryId: item.inventoryId,
      skuId: null,
      areaId: null,
      locationId: null,
      adjustType: legacyAdjustType(item.adjustAction),
      adjustAction: item.adjustAction,
      adjustQty: item.adjustQty,
      allowCreateInventory: false,
      remark: item.remark || null
    }
  }
  return {
    inventoryId: null,
    skuId: item.skuId,
    areaId: item.areaId,
    locationId: item.locationId,
    adjustType: 'INCREASE',
    adjustAction: 'QUANTITY_INCREASE',
    adjustQty: item.adjustQty,
    allowCreateInventory: true,
    remark: item.remark || null
  }
})

const submitForm = async () => {
  const valid = await orderFormRef.value?.validate().catch(() => false)
  if (!valid || !validateItems()) return

  saving.value = true
  try {
    if (isEditMode.value) {
      await axios.put(`/stock-adjust-orders/${activeOrderId.value}`, {
        reasonType: orderForm.reasonType,
        reason: orderForm.reason || null,
        items: buildItemsPayload()
      })
      ElMessage.success('库存调整单保存成功')
    } else {
      const response = await axios.post('/stock-adjust-orders', {
        warehouseId: orderForm.warehouseId,
        reasonType: orderForm.reasonType,
        reason: orderForm.reason || null,
        items: buildItemsPayload()
      })
      const order = unwrapApiData(response)
      ElMessage.success(`创建成功，调整单号：${order.adjustNo}`)
    }
    formDialogVisible.value = false
    pagination.pageNum = 1
    await fetchOrders()
  } finally {
    saving.value = false
  }
}

const submitOrder = async (row) => {
  actionLoadingId.value = row.id
  try {
    await axios.post(`/stock-adjust-orders/${row.id}/submit`)
    ElMessage.success('调整单已提交')
    await fetchOrders()
  } finally {
    actionLoadingId.value = null
  }
}

const confirmOrder = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认执行调整单「${row.adjustNo}」吗？确认后将立即变更库存，且不可撤销。`, '提示', { type: 'warning' })
    .then(() => true).catch(() => false)
  if (!confirmed) return

  actionLoadingId.value = row.id
  try {
    await axios.post(`/stock-adjust-orders/${row.id}/confirm`)
    ElMessage.success('调整单已确认，库存已更新')
    await fetchOrders()
  } finally {
    actionLoadingId.value = null
  }
}

const cancelOrder = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认取消调整单「${row.adjustNo}」吗？`, '提示', { type: 'warning' })
    .then(() => true).catch(() => false)
  if (!confirmed) return

  actionLoadingId.value = row.id
  try {
    await axios.post(`/stock-adjust-orders/${row.id}/cancel`, {})
    ElMessage.success('调整单已取消')
    await fetchOrders()
  } finally {
    actionLoadingId.value = null
  }
}

const openDetail = async (row) => {
  const response = await axios.get(`/stock-adjust-orders/${row.id}`)
  activeOrder.value = unwrapApiData(response)
  detailVisible.value = true
}

const openCreateDialogFromInventory = async (inventoryId) => {
  const response = await axios.get(`/inventory/${inventoryId}`)
  const inventory = unwrapApiData(response)
  resetForm()
  orderForm.warehouseId = inventory.warehouseId
  areaOptions.value = await loadUsableAreas(inventory.warehouseId)
  const item = orderForm.items[0]
  applyInventoryToItem(item, inventory)
  if (inventory.inventoryStatus === 'EXCEPTION') {
    item.adjustAction = 'RESTORE_FROM_EXCEPTION'
    item.targetAreaOptions = filterTargetAreaOptions('RESTORE_FROM_EXCEPTION')
  }
  formDialogVisible.value = true
}

onMounted(async () => {
  await fetchOptions()
  await fetchOrders()
  if (route.query.inventoryId) {
    await openCreateDialogFromInventory(route.query.inventoryId)
  }
})
</script>

<style scoped>
.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 10px;
}

.items-header h3 {
  margin: 0;
  font-size: 15px;
}

.reason-hint {
  margin-top: 12px;
}

.order-items-table {
  margin-top: 14px;
}

.order-items-table :deep(.el-select) {
  width: 100%;
}

.detail-items-table {
  margin-top: 16px;
}

.inventory-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
}

.inventory-cell__sku {
  font-weight: 600;
}

.inventory-cell__location,
.inventory-cell__snapshot {
  color: #64748b;
  font-size: 12px;
}

.offbook-cell {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 0;
}

.offbook-cell__alert {
  padding: 6px 10px;
}

.offbook-cell__select {
  width: 100%;
}

.target-location-select {
  margin-top: 6px;
}

.target-cell__placeholder {
  color: #94a3b8;
}

.action-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}
</style>
