<script setup lang="ts">
definePageMeta({ requiresAuth: false })

import { parseCsv, parseXlsx, type Entry } from '~/utils/parseHealthFile'
import type { HealthRequestDto, HealthResponseDto } from '@my-app/validation'

const records = ref<Entry[]>([])
const transaction = ref<HealthRequestDto | null>(null)
const submitted = ref(false)
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
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  fileName.value = file.name
  uploadError.value = ''
  selectedAction.value = ''
  resultOutput.value = ''
  submitted.value = false
  records.value = []
  transaction.value = null

  let parsed: Entry[]
  try {
    const isXlsx = file.name.toLowerCase().endsWith('.xlsx')
    parsed = isXlsx ? await parseXlsx(file) : parseCsv(await file.text())
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Failed to parse file'
    return
  }

  records.value = parsed
  const payload: HealthRequestDto = {
    service: 'heart',
    timestamp: new Date().toISOString(),
    count: parsed.length,
    hash: await hashFile(parsed)
  }
  transaction.value = payload

  try {
    const $api = useApi()
    const response = await $api<HealthResponseDto>('/api/health', {
      method: 'POST',
      body: payload
    })
    submitted.value = response.status === 'submitted'
    if (!submitted.value) {
      uploadError.value = `Submission was not accepted (status: "${response.status}")`
    }
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : 'Failed to submit transaction'
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
  } else if (action === 'chart' || action === 'monthly') {
    resultOutput.value = ''
  }
}

function downloadTemplate(templateType: string) {
  let template = "";
  let filename = "";
  switch (templateType) {
    case 'heart':
      template = "date,time,systolic,diastolic,pulse,notes";
      filename = "heart.csv"
      break;
    default:
      console.error(`Unhandled template type: ${templateType}`)
      return;
  }

  const blob = new Blob([template], { type: "text/csv; charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <main class="health">
    <h1>Visualize Wellness</h1>
    <p>
      Load a file with medical or wellness data and see various statistics and graphics.
      No sensitive data leaves the browser.
      Limited information about the file (service, timestamp, record count, file hash)
      gets sent to a server for billing in a future release.
    </p>
    <hr>
    <section class="upload">
      <button type="button" @click="downloadTemplate('heart')">File Template</button>
      Add blood pressure data to the template.
    </section>
    <section class="upload">
      <input
        ref="fileInput"
        type="file"
        accept=".csv,.xlsx"
        class="file-input"
        @change="onFileChange"
      >
      <button type="button" @click="triggerUpload">{{ fileName || 'Load File' }}</button>
      Load blood pressure data into the browser to see various statistics and graphics.
      <p v-if="uploadError" class="error" role="alert">{{ uploadError }}</p>
      <p v-if="submitted && transaction" class="success">
        Loaded {{ transaction.count }} reading(s) &mdash; transaction {{ transaction.hash.slice(0, 8) }}
      </p>
    </section>

    <section v-if="submitted" class="actions">
      <!-- Pending review
      <button type="button" @click="runAction('summary')">Summary</button>
      <button type="button" @click="runAction('latest')">Latest Reading</button>
      <button type="button" @click="runAction('abnormal')">Flag Abnormal</button> -->
      <button type="button" @click="runAction('transaction')">Show Transaction</button>
      <button type="button" @click="runAction('chart')">Daily Mean Chart</button>
      <button type="button" @click="runAction('monthly')">Monthly Boxplot</button>
    </section>

    <section v-if="submitted" class="results">
      <h2>Results</h2>
      <DailyMeanChart v-if="selectedAction === 'chart'" :entries="records" />
      <MonthlyBoxplotChart v-else-if="selectedAction === 'monthly'" :entries="records" />
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
