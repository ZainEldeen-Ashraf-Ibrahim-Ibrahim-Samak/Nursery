import mongoose, { Schema, Model } from 'mongoose'
import { promises as dnsPromises } from 'dns'

/**
 * mongoSync.ts — Mongoose models for cloud sync collections.
 *
 * Each model mirrors the SQLite table structure.
 * The _id in MongoDB is the SQLite id (integer) to enable deterministic conflict resolution.
 *
 * Fields synced to MongoDB match the SQLite columns plus an updated_at timestamp.
 */

// ── Connection Management ─────────────────────────────────────────────────────

let isConnected = false
let connectionError: string | null = null

async function convertSrvToStandardUri(uri: string): Promise<string> {
  if (!uri.startsWith('mongodb+srv://')) return uri;

  try {
    const { Resolver } = dnsPromises;
    const resolver = new Resolver();
    resolver.setServers(['8.8.8.8', '8.8.4.4']); // Use Google DNS to bypass local hotspots

    const url = new URL(uri);
    const hostname = url.hostname;

    // Fetch SRV records
    const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`);
    if (!srvRecords || srvRecords.length === 0) throw new Error('No SRV records found');

    // Fetch TXT records
    const txtRecords = await resolver.resolveTxt(hostname);
    const txtOptions = txtRecords.flat().join('&');

    // Construct hosts string
    const hosts = srvRecords.map(r => `${r.name}:${r.port}`).join(',');

    // Extract credentials
    const credentials = url.username ? `${url.username}:${url.password}@` : '';
    
    // Combine search params
    const searchParams = new URLSearchParams(url.search);
    const txtParams = new URLSearchParams(txtOptions);
    for (const [key, value] of txtParams) {
      if (!searchParams.has(key)) searchParams.set(key, value);
    }
    
    searchParams.set('ssl', 'true');

    return `mongodb://${credentials}${hosts}/${url.pathname.replace(/^\//, '')}?${searchParams.toString()}`;
  } catch (error) {
    console.error('Error converting SRV to standard URI, falling back to original:', error);
    return uri;
  }
}

export async function connectMongo(uri: string): Promise<void> {
  if (isConnected) return

  try {
    const finalUri = await convertSrvToStandardUri(uri);
    await mongoose.connect(finalUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    })
    isConnected = true
    connectionError = null

    mongoose.connection.on('disconnected', () => {
      isConnected = false
    })
  } catch (err: any) {
    isConnected = false
    connectionError = err.message || 'Failed to connect to MongoDB'
    throw new Error(connectionError || 'Failed to connect to MongoDB')
  }
}

export async function disconnectMongo(): Promise<void> {
  if (!isConnected) return
  await mongoose.disconnect()
  isConnected = false
}

export function getConnectionStatus(): { connected: boolean; error: string | null } {
  return { connected: isConnected, error: connectionError }
}

// ── Shared schema options ─────────────────────────────────────────────────────

const sharedOptions: mongoose.SchemaOptions = { versionKey: false, _id: false }

// ── Children ─────────────────────────────────────────────────────────────────

const childSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  guardian: String,
  guardian_phone: String,
  child_phone: String,
  national_id: String,
  service: String,
  unit: String,
  price: Number,
  reg_date: String,
  notes: String,
  is_active: Number,
  created_at: String,
  updated_at: String,
  synced: Number
}, sharedOptions)

export const ChildModel: Model<any> = mongoose.models['sync_children'] ||
  mongoose.model('sync_children', childSchema)

// ── Payments ─────────────────────────────────────────────────────────────────

const paymentSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  child_id: Number,
  service: String,
  unit: String,
  quantity: Number,
  price: Number,
  month: String,
  year: Number,
  total: Number,
  paid: Number,
  balance: Number,
  status: String,
  notes: String,
  created_at: String,
  updated_at: String,
  synced: Number
}, sharedOptions)

export const PaymentModel: Model<any> = mongoose.models['sync_payments'] ||
  mongoose.model('sync_payments', paymentSchema)

// ── Employees ─────────────────────────────────────────────────────────────────

const employeeSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  name: String,
  role: String,
  base_salary: Number,
  housing: Number,
  transport: Number,
  net_salary: Number,
  is_active: Number,
  created_at: String,
  updated_at: String,
  synced: Number
}, sharedOptions)

export const EmployeeModel: Model<any> = mongoose.models['sync_employees'] ||
  mongoose.model('sync_employees', employeeSchema)

// ── Salary Payments ───────────────────────────────────────────────────────────

const salaryPaymentSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  employee_id: Number,
  month: String,
  year: Number,
  bonus: Number,
  deductions: Number,
  actual_paid: Number,
  paid_date: String,
  created_at: String,
  updated_at: String,
  synced: Number
}, sharedOptions)

export const SalaryPaymentModel: Model<any> = mongoose.models['sync_salary_payments'] ||
  mongoose.model('sync_salary_payments', salaryPaymentSchema)

// ── Expenses ──────────────────────────────────────────────────────────────────

const expenseSchema = new Schema({
  id: { type: Number, required: true, unique: true },
  item: String,
  month: String,
  year: Number,
  amount: Number,
  category: String,
  notes: String,
  created_at: String,
  updated_at: String,
  synced: Number
}, sharedOptions)

export const ExpenseModel: Model<any> = mongoose.models['sync_expenses'] ||
  mongoose.model('sync_expenses', expenseSchema)

// ── Entity registry ───────────────────────────────────────────────────────────

export const SYNC_ENTITIES: {
  name: string
  model: Model<any>
  table: string
}[] = [
  { name: 'children', model: ChildModel, table: 'children' },
  { name: 'payments', model: PaymentModel, table: 'payments' },
  { name: 'employees', model: EmployeeModel, table: 'employees' },
  { name: 'salary_payments', model: SalaryPaymentModel, table: 'salary_payments' },
  { name: 'expenses', model: ExpenseModel, table: 'expenses' }
]
