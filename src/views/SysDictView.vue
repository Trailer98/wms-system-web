<template>
  <section class="page-shell">
    <div class="page-header">
      <div>
        <h2>数据字典</h2>
        <p>维护业务编码（如库存流水操作类型）对应的中文文案、排序和标签样式；编码本身仍由后端枚举决定。</p>
      </div>
      <el-button v-if="authStore.hasPermission('sys-dict:create')" type="primary" @click="openCreateTypeDialog">新增字典类型</el-button>
    </div>

    <div class="dict-layout">
      <div class="dict-types-panel">
        <div
          v-for="type in dictTypes"
          :key="type.id"
          class="dict-type-item"
          :class="{ 'dict-type-item--active': type.id === activeType?.id }"
          @click="selectType(type)"
        >
          <div class="dict-type-item__main">
            <span class="dict-type-item__name">{{ type.dictName }}</span>
            <span class="dict-type-item__code">{{ type.dictCode }}</span>
          </div>
          <el-tag size="small" :type="type.status === 'ENABLED' ? 'success' : 'info'" effect="plain">
            {{ type.status === 'ENABLED' ? '启用' : '停用' }}
          </el-tag>
        </div>
        <div v-if="!loadingTypes && !dictTypes.length" class="dict-types-empty">暂无字典类型</div>
      </div>

      <div class="dict-items-panel">
        <template v-if="activeType">
          <div class="dict-items-header">
            <div>
              <h3>{{ activeType.dictName }}</h3>
              <p class="dict-items-header__code">{{ activeType.dictCode }}</p>
            </div>
            <div class="dict-items-header__actions">
              <el-button v-if="authStore.hasPermission('sys-dict:update')" @click="openEditTypeDialog(activeType)">编辑类型</el-button>
              <el-button
                v-if="authStore.hasPermission('sys-dict:disable')"
                :type="activeType.status === 'ENABLED' ? 'danger' : 'success'"
                @click="toggleTypeStatus(activeType)"
              >
                {{ activeType.status === 'ENABLED' ? '停用类型' : '启用类型' }}
              </el-button>
              <el-button v-if="authStore.hasPermission('sys-dict:create')" type="primary" @click="openCreateItemDialog">新增字典项</el-button>
            </div>
          </div>

          <el-table :data="dictItems" v-loading="loadingItems" border>
            <el-table-column prop="itemValue" label="编码" min-width="180" />
            <el-table-column prop="itemLabel" label="中文名称" min-width="140" />
            <el-table-column label="标签样式" width="150">
              <template #default="{ row }">
                <el-tag v-if="row.tagType" :type="row.tagType" effect="plain">{{ row.itemLabel }}</el-tag>
                <el-tag v-else effect="plain">{{ row.itemLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="80" align="center" />
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ENABLED' ? 'success' : 'info'" effect="plain">
                  {{ row.status === 'ENABLED' ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="来源" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.isSystem" type="warning" effect="plain">系统内置</el-tag>
                <span v-else>自定义</span>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            <el-table-column label="操作" width="200" fixed="right" align="center">
              <template #default="{ row }">
                <el-button v-if="authStore.hasPermission('sys-dict:update')" type="primary" link @click="openEditItemDialog(row)">编辑</el-button>
                <el-button
                  v-if="authStore.hasPermission('sys-dict:disable')"
                  :type="row.status === 'ENABLED' ? 'danger' : 'success'"
                  link
                  @click="toggleItemStatus(row)"
                >
                  {{ row.status === 'ENABLED' ? '停用' : '启用' }}
                </el-button>
                <el-button
                  v-if="authStore.hasPermission('sys-dict:delete') && !row.isSystem"
                  type="danger"
                  link
                  @click="deleteItem(row)"
                >删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
        <div v-else class="dict-items-empty">请选择左侧的字典类型</div>
      </div>
    </div>

    <el-dialog v-model="typeDialogVisible" :title="isEditTypeMode ? '编辑字典类型' : '新增字典类型'" width="480px">
      <el-form ref="typeFormRef" :model="typeForm" :rules="typeRules" label-width="90px">
        <el-form-item label="字典编码" prop="dictCode">
          <el-input v-model.trim="typeForm.dictCode" maxlength="64" :disabled="isEditTypeMode" placeholder="如 stock_movement_operation_type" />
        </el-form-item>
        <el-form-item label="字典名称" prop="dictName">
          <el-input v-model.trim="typeForm.dictName" maxlength="128" placeholder="请输入字典名称" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="typeForm.sortOrder" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model.trim="typeForm.remark" type="textarea" maxlength="255" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingType" @click="submitType">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="itemDialogVisible" :title="isEditItemMode ? '编辑字典项' : '新增字典项'" width="520px">
      <el-form ref="itemFormRef" :model="itemForm" :rules="itemRules" label-width="100px">
        <el-form-item label="编码" prop="itemValue">
          <el-input v-model.trim="itemForm.itemValue" maxlength="128" :disabled="isEditItemMode" placeholder="如 STOCK_ADJUST_DECREASE" />
        </el-form-item>
        <el-form-item label="中文名称" prop="itemLabel">
          <el-input v-model.trim="itemForm.itemLabel" maxlength="128" placeholder="请输入中文名称" />
        </el-form-item>
        <el-form-item label="英文名称">
          <el-input v-model.trim="itemForm.itemLabelEn" maxlength="128" placeholder="可选" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="itemForm.sortOrder" :min="0" controls-position="right" />
        </el-form-item>
        <el-form-item label="标签样式">
          <el-select v-model="itemForm.tagType" placeholder="默认" clearable>
            <el-option label="success（绿）" value="success" />
            <el-option label="warning（橙）" value="warning" />
            <el-option label="danger（红）" value="danger" />
            <el-option label="info（灰）" value="info" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model.trim="itemForm.remark" type="textarea" maxlength="255" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingItem" @click="submitItem">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup>
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import {
  changeDictItemStatus,
  changeDictTypeStatus,
  createDictItem,
  createDictType,
  deleteDictItem as deleteDictItemApi,
  getDictItemsForAdmin,
  getDictTypesPage,
  updateDictItem,
  updateDictType
} from '../api/sysDict'
import { useAuthStore } from '../stores/auth'
import { normalizePageResponse } from '../utils/apiResponse'

const authStore = useAuthStore()

const dictTypes = ref([])
const loadingTypes = ref(false)
const activeType = ref(null)
const dictItems = ref([])
const loadingItems = ref(false)

const typeDialogVisible = ref(false)
const isEditTypeMode = ref(false)
const activeTypeId = ref(null)
const typeFormRef = ref()
const savingType = ref(false)
const typeForm = reactive({ dictCode: '', dictName: '', remark: '', sortOrder: 0 })
const typeRules = {
  dictCode: [{ required: true, message: '请输入字典编码', trigger: 'blur' }],
  dictName: [{ required: true, message: '请输入字典名称', trigger: 'blur' }]
}

const itemDialogVisible = ref(false)
const isEditItemMode = ref(false)
const activeItemId = ref(null)
const itemFormRef = ref()
const savingItem = ref(false)
const itemForm = reactive({ itemValue: '', itemLabel: '', itemLabelEn: '', sortOrder: 0, tagType: '', remark: '' })
const itemRules = {
  itemValue: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  itemLabel: [{ required: true, message: '请输入中文名称', trigger: 'blur' }]
}

const fetchTypes = async () => {
  loadingTypes.value = true
  try {
    const response = await getDictTypesPage({ pageNum: 1, pageSize: 100 })
    const { rows } = normalizePageResponse(response)
    dictTypes.value = rows
    if (!activeType.value && rows.length) {
      await selectType(rows[0])
    } else if (activeType.value) {
      const refreshed = rows.find((row) => row.id === activeType.value.id)
      if (refreshed) activeType.value = refreshed
    }
  } finally {
    loadingTypes.value = false
  }
}

const fetchItems = async (dictCode) => {
  loadingItems.value = true
  try {
    dictItems.value = await getDictItemsForAdmin(dictCode)
  } finally {
    loadingItems.value = false
  }
}

const selectType = async (type) => {
  activeType.value = type
  await fetchItems(type.dictCode)
}

const openCreateTypeDialog = () => {
  isEditTypeMode.value = false
  typeForm.dictCode = ''
  typeForm.dictName = ''
  typeForm.remark = ''
  typeForm.sortOrder = 0
  typeDialogVisible.value = true
}

const openEditTypeDialog = (type) => {
  isEditTypeMode.value = true
  activeTypeId.value = type.id
  typeForm.dictCode = type.dictCode
  typeForm.dictName = type.dictName
  typeForm.remark = type.remark
  typeForm.sortOrder = type.sortOrder
  typeDialogVisible.value = true
}

const submitType = async () => {
  const valid = await typeFormRef.value?.validate().catch(() => false)
  if (!valid) return

  savingType.value = true
  try {
    if (isEditTypeMode.value) {
      await updateDictType(activeTypeId.value, { dictName: typeForm.dictName, remark: typeForm.remark, sortOrder: typeForm.sortOrder })
      ElMessage.success('字典类型已更新')
    } else {
      await createDictType({ dictCode: typeForm.dictCode, dictName: typeForm.dictName, remark: typeForm.remark, sortOrder: typeForm.sortOrder })
      ElMessage.success('字典类型创建成功')
    }
    typeDialogVisible.value = false
    await fetchTypes()
  } finally {
    savingType.value = false
  }
}

const toggleTypeStatus = async (type) => {
  const nextStatus = type.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  const confirmed = await ElMessageBox.confirm(
    `确认${nextStatus === 'ENABLED' ? '启用' : '停用'}字典类型「${type.dictName}」吗？`,
    '提示',
    { type: 'warning' }
  ).then(() => true).catch(() => false)
  if (!confirmed) return

  await changeDictTypeStatus(type.id, nextStatus)
  ElMessage.success('状态已更新')
  await fetchTypes()
}

const openCreateItemDialog = () => {
  isEditItemMode.value = false
  itemForm.itemValue = ''
  itemForm.itemLabel = ''
  itemForm.itemLabelEn = ''
  itemForm.sortOrder = 0
  itemForm.tagType = ''
  itemForm.remark = ''
  itemDialogVisible.value = true
}

const openEditItemDialog = (row) => {
  isEditItemMode.value = true
  activeItemId.value = row.id
  itemForm.itemValue = row.itemValue
  itemForm.itemLabel = row.itemLabel
  itemForm.itemLabelEn = row.itemLabelEn
  itemForm.sortOrder = row.sortOrder
  itemForm.tagType = row.tagType || ''
  itemForm.remark = row.remark
  itemDialogVisible.value = true
}

const submitItem = async () => {
  const valid = await itemFormRef.value?.validate().catch(() => false)
  if (!valid) return

  savingItem.value = true
  try {
    if (isEditItemMode.value) {
      await updateDictItem(activeItemId.value, {
        itemLabel: itemForm.itemLabel,
        itemLabelEn: itemForm.itemLabelEn || null,
        sortOrder: itemForm.sortOrder,
        tagType: itemForm.tagType || null,
        cssClass: null,
        remark: itemForm.remark || null
      })
      ElMessage.success('字典项已更新')
    } else {
      await createDictItem({
        dictCode: activeType.value.dictCode,
        itemValue: itemForm.itemValue,
        itemLabel: itemForm.itemLabel,
        itemLabelEn: itemForm.itemLabelEn || null,
        sortOrder: itemForm.sortOrder,
        tagType: itemForm.tagType || null,
        cssClass: null,
        remark: itemForm.remark || null
      })
      ElMessage.success('字典项创建成功')
    }
    itemDialogVisible.value = false
    await fetchItems(activeType.value.dictCode)
  } finally {
    savingItem.value = false
  }
}

const toggleItemStatus = async (row) => {
  const nextStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
  const confirmed = await ElMessageBox.confirm(
    `确认${nextStatus === 'ENABLED' ? '启用' : '停用'}字典项「${row.itemLabel}」吗？${nextStatus === 'DISABLED' ? '停用后新增筛选下拉将不再显示该项，历史数据仍可正常显示文案。' : ''}`,
    '提示',
    { type: 'warning' }
  ).then(() => true).catch(() => false)
  if (!confirmed) return

  await changeDictItemStatus(row.id, nextStatus)
  ElMessage.success('状态已更新')
  await fetchItems(activeType.value.dictCode)
}

const deleteItem = async (row) => {
  const confirmed = await ElMessageBox.confirm(`确认删除字典项「${row.itemLabel}」吗？此操作不可恢复。`, '提示', { type: 'warning' })
    .then(() => true).catch(() => false)
  if (!confirmed) return

  await deleteDictItemApi(row.id)
  ElMessage.success('字典项已删除')
  await fetchItems(activeType.value.dictCode)
}

onMounted(fetchTypes)
</script>

<style scoped>
.dict-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.dict-types-panel {
  width: 280px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
}

.dict-type-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  cursor: pointer;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.dict-type-item:last-child {
  border-bottom: none;
}

.dict-type-item:hover {
  background: var(--el-fill-color-light);
}

.dict-type-item--active {
  background: var(--el-color-primary-light-9);
}

.dict-type-item__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dict-type-item__name {
  font-weight: 600;
}

.dict-type-item__code {
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dict-types-empty,
.dict-items-empty {
  padding: 32px;
  text-align: center;
  color: #94a3b8;
}

.dict-items-panel {
  flex: 1;
  min-width: 0;
}

.dict-items-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 14px;
}

.dict-items-header h3 {
  margin: 0 0 4px;
}

.dict-items-header__code {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.dict-items-header__actions {
  display: flex;
  gap: 8px;
}
</style>
