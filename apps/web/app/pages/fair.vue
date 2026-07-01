<script setup lang="ts">
import type { FetchError } from 'ofetch'

// const { isLoggedIn, user } = useAuth()

// if (!isLoggedIn.value) {
//   await navigateTo('/')
// }

async function test() {
  const $api = useApi()
  try {
    const response = await $api('/api/fair', { method: 'POST', body: { message: 'Hello World!' } })
    console.log(response)
  } catch (err) {
    const e = err as FetchError
    console.error(e.status)
    console.error(e.data)
  }
}

type Estimate = {
  tef: {
    min: number
    max: number
  }
  vulnerability: number,
  primary_loss: {
    min: number
    max: number
  }
  secondary_loss?: {
    min: number
    max: number
  }
}

type Risk = {
  name: string
  tef: number
  lef: number
  ale: number
  alr: {
    min: number
    max: number
  }
  cost: number
  benefit: number
}

type Item = {
  id: number
  actor: string
  action: string
  asset: string
  loss: string
  estimate: Estimate,
  risk: Risk[]
  suggestion: string
}

const items = ref<Item[]>([
  {
    suggestion: 'Apply a cat-deterrent furniture spray (e.g., bitter apple) directly to the Ames couch leather at a one-time cost of roughly $10–$15; this addresses vulnerability at the asset level and could reduce the 0.85 vulnerability score, further lowering LEF and ALE without requiring ongoing expenditure.',
    estimate: {
      tef: { min: 0.58, max: 0.84 },
      vulnerability: 0.85,
      primary_loss: { min: 2500, max: 15000 }
    },
    risk: [
      {
        name: "Current",
        tef: 0.71,
        lef: 0.6035,
        ale: 5280.63,
        alr: {
          min: 1508.75,
          max: 9052.50
        },
        cost: 0,
        benefit: 0
      },
      {
        name: "Vertical Scratching Post",
        tef: 0.33,
        lef: 0.2805,
        ale: 2454.38,
        alr: {
          min: 701.25,
          max: 4207.5
        },
        cost: 50.00,
        benefit: 2776.25
      }
    ],
    id: 1, actor: 'Black Cat', action: 'Scratch leather', asset: '3 person Ames couch', loss: 'Integrity'
  },
  {
    suggestion: '',
    estimate: {
      tef: { min: 0.03, max: 0.15 },
      vulnerability: 1,
      primary_loss: { min: 2500, max: 15000 }
    },
    risk: [
      {
        name: "Current",
        tef: 0.09,
        lef: 0.09,
        ale: 787.50,
        alr: {
          min: 75.00,
          max: 2250.00
        },
        cost: 0,
        benefit: 0
      },
      {
        name: "Puppy Training",
        tef: 0.054,
        lef: 0.054,
        ale: 472.50,
        alr: {
          min: 45.00,
          max: 1350.00
        },
        cost: 360.00,
        benefit: -45.00
      }
    ],
    id: 2, actor: 'Grey Pug', action: 'Chew armrest', asset: '3 person Ames couch', loss: 'Integrity'
  },
])
const selected = ref<Set<number>>(new Set())
let nextId = 3

function addItem() {
  items.value.push({
    suggestion: '',
    estimate: {} as Estimate,
    risk: [],
    id: nextId++,
    actor: 'New threat',
    action: 'New action',
    asset: '3 person Ames couch',
    loss: 'Some loss'
  })
}

function removeItem(id: number) {
  if (id < 3) return
  items.value = items.value.filter(i => i.id !== id)
  selected.value.delete(id)
}

function toggleSelect(id: number) {
  if (selected.value.has(id)) {
    selected.value.delete(id)
  } else {
    selected.value.add(id)
  }
  selected.value = new Set(selected.value)
}

const allSelected = computed(() =>
  items.value.length > 0 && items.value.every(i => selected.value.has(i.id))
)

function toggleSelectAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(items.value.map(i => i.id))
  }
}

const dialogRef = ref<HTMLDialogElement | null>(null)
const editTarget = ref<Item | null>(null)
const editForm = reactive({
  tef_min: 0, tef_max: 0,
  vulnerability: 0,
  primary_loss_min: 0, primary_loss_max: 0,
  secondary_loss_min: null as number | null,
  secondary_loss_max: null as number | null,
})

function editItem(item: Item) {
  editTarget.value = item
  editForm.tef_min = item.estimate.tef?.min ?? null
  editForm.tef_max = item.estimate.tef?.max ?? null
  editForm.vulnerability = item.estimate.vulnerability
  editForm.primary_loss_min = item.estimate.primary_loss?.min ?? null
  editForm.primary_loss_max = item.estimate.primary_loss?.max ?? null
  editForm.secondary_loss_min = item.estimate.secondary_loss?.min ?? null
  editForm.secondary_loss_max = item.estimate.secondary_loss?.max ?? null
  dialogRef.value?.showModal()
}

function saveEdit() {
  if (!editTarget.value) return
  editTarget.value.estimate = {
    tef: { min: editForm.tef_min, max: editForm.tef_max },
    vulnerability: editForm.vulnerability,
    primary_loss: { min: editForm.primary_loss_min, max: editForm.primary_loss_max },
    ...(editForm.secondary_loss_min !== null && editForm.secondary_loss_max !== null
      ? { secondary_loss: { min: editForm.secondary_loss_min, max: editForm.secondary_loss_max } }
      : {}),
  }
  dialogRef.value?.close()
}

function cancelEdit() {
  dialogRef.value?.close()
}

const shownItem = ref<Item | null>(null)

function showItem(item: Item) {
  shownItem.value = shownItem.value?.id === item.id ? null : item
}
</script>

<template>
  <main class="fair">
    <h1>Factor Analysis of Information Risk (FAIR)</h1>
    <p>
        Apply the FAIR model to quantify information and operational risk in financial terms.
    </p>
    <p>
        Actual analysis happens on the backend with a prompt sent to Claude AI.
        We currently have this feature turned off because of token costs.
    </p>
    <p>
      Below we have an example for demonstration purposes.
    </p>
    <div class="table-toolbar">
      <button class="btn btn-primary" @click="addItem">+ Add</button>
      <button class="btn btn-primary" @click="test">Analyze</button>
    </div>

    <table class="fair-table">
      <thead>
        <tr>
          <th class="col-select">
            <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
          </th>
          <th>ID</th>
          <th>Actor</th>
          <th>Action</th>
          <th>Asset</th>
          <th>Loss</th>
          <th>Options</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          :class="{ selected: selected.has(item.id) }"
        >
          <td class="col-select">
            <input
              type="checkbox"
              :checked="selected.has(item.id)"
              @change="toggleSelect(item.id)"
            />
          </td>
          <td>{{ item.id }}</td>
          <td>{{ item.actor }}</td>
          <td>{{ item.action }}</td>
          <td>{{ item.asset }}</td>
          <td>{{ item.loss }}</td>
          <td class="actions">
            <button class="btn btn-sm" title="Show" @click="showItem(item)">👁</button>
            <button class="btn btn-sm" title="Edit" @click="editItem(item)">✎</button>
            <button class="btn btn-sm btn-danger" title="Remove" @click="removeItem(item.id)">🗙</button>
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="4" class="empty">No items.</td>
        </tr>
      </tbody>
    </table>

    <dialog ref="dialogRef" class="edit-dialog">
      <h2 class="dialog-title">Edit Estimate — {{ editTarget?.actor }}: {{ editTarget?.action }}</h2>
      <form method="dialog" @submit.prevent="saveEdit">
        <fieldset>
          <legend>Threat Event Frequency (TEF)</legend>
          <label>Min <input type="number" step="any" v-model.number="editForm.tef_min" /></label>
          <label>Max <input type="number" step="any" v-model.number="editForm.tef_max" /></label>
        </fieldset>
        <fieldset>
          <legend>Vulnerability</legend>
          <label>Value <input type="number" step="any" min="0" max="1" v-model.number="editForm.vulnerability" /></label>
        </fieldset>
        <fieldset>
          <legend>Primary Loss ($)</legend>
          <label>Min <input type="number" step="any" v-model.number="editForm.primary_loss_min" /></label>
          <label>Max <input type="number" step="any" v-model.number="editForm.primary_loss_max" /></label>
        </fieldset>
        <fieldset>
          <legend>Secondary Loss ($) <span class="optional">optional</span></legend>
          <label>Min <input type="number" step="any" v-model.number="editForm.secondary_loss_min" placeholder="—" /></label>
          <label>Max <input type="number" step="any" v-model.number="editForm.secondary_loss_max" placeholder="—" /></label>
        </fieldset>
        <div class="dialog-actions">
          <button type="button" class="btn" @click="cancelEdit">Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    </dialog>

    <template v-if="shownItem">
      <h2 class="risk-title">Risk analysis — {{ shownItem.actor }}: {{ shownItem.action }}</h2>
      <table class="fair-table">
        <thead>
          <tr>
            <th>Control</th>
            <th>TEF</th>
            <th>LEF</th>
            <th>ALE ($)</th>
            <th>ALR Min ($)</th>
            <th>ALR Max ($)</th>
            <th>Cost ($)</th>
            <th>Benefit ($)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="risk in shownItem.risk" :key="risk.name">
            <td>{{ risk.name }}</td>
            <td>{{ risk.tef }}</td>
            <td>{{ risk.lef }}</td>
            <td>{{ risk.ale.toFixed(2) }}</td>
            <td>{{ risk.alr.min.toFixed(2) }}</td>
            <td>{{ risk.alr.max.toFixed(2) }}</td>
            <td>{{ risk.cost.toFixed(2) }}</td>
            <td>{{ risk.benefit.toFixed(2) }}</td>
          </tr>
          <tr v-if="shownItem.risk.length === 0">
            <td colspan="8" class="empty">No risk data.</td>
          </tr>
        </tbody>
      </table>
      <p v-if="shownItem.suggestion" class="suggestion">{{ shownItem.suggestion }}</p>
    </template>
  </main>
</template>

<style scoped>
.fair {
  padding: 4rem 2rem;
  font-family: "Noto Sans", Verdana, sans-serif;
  max-width: 900px;
  margin: 0 auto;
}

h1 {
  text-align: center;
}

.table-toolbar {
  margin: 1.5rem 0 0.75rem;
}

.fair-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.fair-table th,
.fair-table td {
  padding: 0.6rem 0.75rem;
  border: 1px solid #e5e5e5;
  text-align: left;
}

.fair-table th {
  background: #f5f5f5;
  font-weight: 600;
}

.fair-table tr.selected td {
  background: #eef4ff;
}

.col-select {
  width: 2.5rem;
  text-align: center;
}

.actions {
  display: flex;
  gap: 0.4rem;
}

.empty {
  text-align: center;
  color: #999;
  padding: 1.5rem;
}

.btn {
  padding: 0.45rem 0.9rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-primary {
  background: #111;
  color: white;
  border-color: #111;
  margin-right: 1rem;
}

.btn-sm {
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
}

.btn-danger {
  border-color: #e74c3c;
  color: #e74c3c;
}

.btn-danger:hover {
  background: #e74c3c;
  color: white;
}

.suggestion {
  margin-top: 1.5rem;
  padding: 0.75rem 1rem;
  background: #f9f9f9;
  border-left: 3px solid #ccc;
  font-size: 0.9rem;
  line-height: 1.5;
}

.edit-dialog {
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 360px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  font-family: "Noto Sans", Verdana, sans-serif;
}

.edit-dialog::backdrop {
  background: rgba(0,0,0,0.35);
}

.dialog-title {
  margin: 0 0 1.25rem;
  font-size: 1rem;
  font-weight: 600;
}

.edit-dialog fieldset {
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.edit-dialog legend {
  font-size: 0.8rem;
  font-weight: 600;
  color: #555;
  padding: 0 0.25rem;
}

.edit-dialog label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.edit-dialog input {
  flex: 1;
  padding: 0.35rem 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.875rem;
}

.optional {
  font-weight: 400;
  color: #999;
  font-size: 0.75rem;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.risk-title {
  margin-top: 2rem;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}
</style>
