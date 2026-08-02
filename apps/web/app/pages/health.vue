<script setup lang="ts">
definePageMeta({ requiresAuth: false })

import { parseCsv, parseXlsx, type Entry } from '~/utils/parseHealthFile'

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

async function hashFile(entries: Entry[]): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(entries)))
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
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx')
    const parsed = isXlsx ? await parseXlsx(file) : parseCsv(await file.text())
    records.value = parsed
    transaction.value = {
      timestamp: new Date(),
      count: parsed.length,
      hash: await hashFile(parsed)
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
  } else if (action === 'chart' || action === 'monthly-systolic' || action === 'monthly-diastolic') {
    resultOutput.value = ''
  }
}
</script>

<template>
  <main class="health">
    <h1>Blood Pressure Visualization</h1>
    <p>
      Upload a file with blood pressure data and see various statistics and graphics.
    </p>
    <p>
      Supported file formats: CSV (pipe delimited), XLSX (first sheet).
      Below shows the CSV file format. The XLSX file should have the same headers on the first row.
    </p>
    <pre>
date|time|systolic|diastolic|pulse|notes
2026-08-01|03:00|121|81|56|meds; multiple
2026-08-01|13:00|122|82|57|
2026-08-02|21:35|120|80|55|
    </pre>
    <p>
      No medical data leaves the browser.
    </p>
    <p>
      The transaction shows the information about the file that will get sent
      to a server for billing in a future version.
    </p>
    <hr>
    <section class="upload">
      <input
        ref="fileInput"
        type="file"
        accept=".csv,.xlsx"
        class="file-input"
        @change="onFileChange"
      >
      <button type="button" @click="triggerUpload">{{ fileName || 'Upload File' }}</button>
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
      <button type="button" @click="runAction('chart')">Daily Mean Chart</button>
      <button type="button" @click="runAction('monthly-systolic')">Monthly Systolic</button>
      <button type="button" @click="runAction('monthly-diastolic')">Monthly Diastolic</button>
    </section>

    <section v-if="transaction" class="results">
      <h2>Results</h2>
      <DailyMeanChart v-if="selectedAction === 'chart'" :entries="records" />
      <MonthlyBoxplotChart v-else-if="selectedAction === 'monthly-systolic'" :entries="records" metric="systolic" />
      <MonthlyBoxplotChart v-else-if="selectedAction === 'monthly-diastolic'" :entries="records" metric="diastolic" />
      <pre v-else-if="resultOutput">{{ resultOutput }}</pre>
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
