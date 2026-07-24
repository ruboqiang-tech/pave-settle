// 项目状态
export type ProjectStatus = 'preparing' | 'in_progress' | 'settling' | 'completed'

// 工程类型
export type ProjectType = 'highway' | 'municipal'

// 结算类型
export type SettlementType = 'interim' | 'final'

// 结算单状态
export type SettlementStatus = 'draft' | 'confirmed' | 'approved'

// 项目
export interface Project {
  id: number
  code: string
  name: string
  projectType: ProjectType
  location: string
  ownerUnit: string
  generalContractor: string
  startDate: string
  plannedEndDate: string
  actualEndDate?: string
  status: ProjectStatus
  createdAt: string
  budgetFileId?: number | null
  difficulty?: 'easy' | 'medium' | 'hard'
}

// 合同
export interface Contract {
  id: number
  projectId: number
  contractNo: string
  contractName: string
  contractDate: string
  noTaxAmount: number
  contractTaxRate: number
  taxAmount: number
  contractAmount: number
  amountSource: 'manual' | 'auto'
  summary: string
}

// 合同附件
export interface ContractAttachment {
  id: number
  contractId: number
  fileName: string
  fileType: string
  fileSize: number
  fileData: string
  uploadedAt: string
}

// 工程量清单项
export interface BillOfQuantities {
  id: number
  contractId: number
  itemCode: string
  itemName: string
  remark: string
  note: string
  unit: string
  quantity: number
  taxRate: number
  noTaxUnitPrice: number
  unitPrice: number
  noTaxTotalPrice: number
  taxAmount: number
  totalPrice: number
  category: string
  chapterCode: string
  sortOrder: number
}

// 结算单
export interface Settlement {
  id: number
  projectId: number
  /**
   * 关联的合同 ID 列表。
   * 注意：数据库中存储为 JSON 字符串（如 "[1,2,3]"），读取时由 mapSettlement 解析为 number[]。
   * 这是因为 sql.js 运行在浏览器内存中，不支持多表关联查询的结果集展开，
   * 用 JSON 字段是在单库无外联约束场景下的折中方案。
   * 副作用：该字段无法利用 SQL 索引加速查询，若数据量增大应考虑迁移到关联表。
   */
  contractIds: number[]
  settlementNo: string
  settlementType: SettlementType
  startDate: string
  endDate: string
  previousCumulative: number
  currentAmount: number
  currentCumulative: number
  materialAdjustment: number
  changeAmount: number
  deductionAmount: number
  surchargeAmount: number
  changeRemark: string
  materialRemark: string
  surchargeRemark: string
  deductionRemark: string
  remark: string
  status: SettlementStatus
  createdAt: string
}

// 结算单附件
export interface SettlementAttachment {
  id: number
  settlementId: number
  fileName: string
  fileType: string
  fileSize: number
  fileData: string
  uploadedAt: string
}

// 结算明细
export interface SettlementDetail {
  id: number
  settlementId: number
  boqId: number
  contractId: number
  itemCode?: string
  itemName?: string
  remark?: string
  unit?: string
  note?: string
  contractQuantity: number
  previousCumulative: number
  currentQuantity: number
  currentCumulative: number
  unitPrice: number
  currentAmount: number
}

// 收付款记录
export interface Payment {
  id: number
  projectId: number
  paymentType: 'receive' | 'pay'
  paymentDate: string
  amount: number
  paymentMethod: string
  referenceNo: string
  description: string
}

// 结算单显示项（用于前端展示）
export interface SettlementDisplayItem {
  boqId: number
  itemCode: string
  itemName: string
  unit: string
  contractQuantity: number
  previousCumulative: number
  currentQuantity: number
  currentCumulative: number
  noTaxUnitPrice: number
  unitPrice: number
  currentAmount: number
}

// 结算明细行（前端展示用，包含BOQ的名称等字段）
export interface SettlementDetailRow {
  boqId: number
  contractId: number
  contractName: string
  itemCode: string
  itemName: string
  remark: string
  note: string
  unit: string
  contractQuantity: number
  previousCumulative: number
  currentQuantity: number
  currentCumulative: number
  noTaxUnitPrice: number
  unitPrice: number
  currentAmount: number
}

export interface CostAdjustmentData {
  changeAmount: number
  changeRemark: string
  materialAdjustment: number
  materialRemark: string
  surchargeAmount: number
  surchargeRemark: string
  deductionAmount: number
  deductionRemark: string
}

// 项目统计
export interface ProjectStats {
  totalProjects: number
  inProgressProjects: number
  settlingProjects: number
  completedProjects: number
  totalContractAmount: number
  totalSettledAmount: number
  currentMonthSettlement: number
}

// 发票类型
export type InvoiceType = 'special' | 'general' | 'electronic'

// 发票记录
export interface Invoice {
  id: number
  projectId: number
  invoiceNo: string
  invoiceType: InvoiceType
  invoiceAmount: number   // 不含税金额
  taxRate: number         // 税率%
  taxAmount: number       // 税额
  totalAmount: number     // 价税合计
  invoiceDate: string
  remark: string
  createdAt: string
}
