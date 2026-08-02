<script setup lang="ts">
definePageMeta({ requiresAuth: false })

import { parseCsv, type Entry } from '~/utils/parseHealthCsv'

type Transaction = {
  timestamp: Date //'%Y-%m-%dT%H:%M:%S'
  count: number // > 0
  hash: string
}

const records = ref<Entry[]>([])
const transaction = ref<Transaction | null>(null)
const uploadError = ref('')
const selectedAction = ref('')
const resultOutput = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')

async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function triggerUpload() {
  fileInput.value?.click()
}

async function onFileChange(event: Event) {
  console.log('onFileChange')
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  fileName.value = file.name
  uploadError.value = ''
  selectedAction.value = ''
  resultOutput.value = ''

  try {
    const text = await file.text()
    const parsed = parseCsv(text)
    records.value = parsed
    transaction.value = {
      timestamp: new Date(),
      count: parsed.length,
      hash: await hashText(text)
    }
    console.log(records)
    console.log(transaction)
  } catch (err) {
    console.error(err)
    records.value = []
    transaction.value = null
    uploadError.value = err instanceof Error ? err.message : 'Failed to parse file'
  }
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function runAction(action: string) {
  selectedAction.value = action

  if (action === 'summary') {
    resultOutput.value = JSON.stringify({
      readings: records.value.length,
      avgSystolic: Math.round(average(records.value.map(r => r.systolic))),
      avgDiastolic: Math.round(average(records.value.map(r => r.diastolic))),
      avgPulse: Math.round(average(records.value.map(r => r.pulse)))
    }, null, 2)
  } else if (action === 'latest') {
    const latest = [...records.value].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)).at(-1)
    resultOutput.value = latest ? JSON.stringify(latest, null, 2) : 'No readings'
  } else if (action === 'abnormal') {
    const abnormal = records.value.filter(r => r.systolic >= 140 || r.diastolic >= 90)
    resultOutput.value = abnormal.length > 0 ? JSON.stringify(abnormal, null, 2) : 'No abnormal readings'
  } else if (action === 'transaction') {
    resultOutput.value = transaction.value ? JSON.stringify(transaction.value, null, 2) : 'No transaction'
  }
}
</script>

<template>
  <main class="health">
    <h1>Health Visualization</h1>
    <p>
      Blood pressure visualization tools.
    </p>

    <section class="upload">
      <input
        ref="fileInput"
        type="file"
        accept=".csv"
        class="file-input"
        @change="onFileChange"
      >
      <button type="button" @click="triggerUpload">{{ fileName || 'Upload CSV' }}</button>
      <p v-if="uploadError" class="error" role="alert">{{ uploadError }}</p>
      <p v-if="transaction" class="success">
        Loaded {{ transaction.count }} reading(s) &mdash; transaction {{ transaction.hash.slice(0, 8) }}
      </p>
    </section>

    <section v-if="transaction" class="actions">
      <button type="button" @click="runAction('summary')">Summary</button>
      <button type="button" @click="runAction('latest')">Latest Reading</button>
      <button type="button" @click="runAction('abnormal')">Flag Abnormal</button>
      <button type="button" @click="runAction('transaction')">Show Transaction</button>
    </section>

    <section v-if="transaction" class="results">
      <h2>Results</h2>
      <pre v-if="resultOutput">{{ resultOutput }}</pre>
      <p v-else>Select an action above.</p>
    </section>
  </main>
</template>

<style scoped>
.health {
  padding: 4rem 2rem;
  font-family: "Noto Sans", Verdana, sans-serif;
  max-width: 900px;
  margin: 0 auto;
  background-color: #F5F7FA;
}

h1 {
  text-align: center;
}

.file-input {
  display: none;
}
</style>
