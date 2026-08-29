<script setup lang="ts">
import { parseCsv, parseXlsx, type Entry } from '~/utils/parseHealthFile'

async function parseHeartFile(file: File): Promise<Entry[]> {
  const isXlsx = file.name.toLowerCase().endsWith('.xlsx')
  return isXlsx ? await parseXlsx(file) : parseCsv(await file.text())
}

// Reuses the same parseCsv() a local .csv upload goes through, so
// API-sourced and file-sourced data are parsed identically.
async function fetchHeartExample(): Promise<Entry[]> {
  const $api = useApi()
  const { content } = await $api<{ content: string }>('/api/health/heart/example')
  return parseCsv(content)
}

const {
  records, transaction, submitted, uploadError, fileName, fileInput,
  triggerUpload, onFileChange, loadExample
} = useHealthUpload<Entry>({ service: 'heart', parseFile: parseHeartFile, fetchExample: fetchHeartExample })

const selectedAction = ref('')
const resultOutput = ref('')

// A new file load resets whichever visualization was showing for the
// previous one -- useHealthUpload() doesn't know about this panel's own
// action/result state, so react to its fileName changing instead.
watch(fileName, () => {
  selectedAction.value = ''
  resultOutput.value = ''
})

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

function downloadTemplate() {
  const template = 'date,time,systolic,diastolic,pulse,notes'
  const blob = new Blob([template], { type: 'text/csv; charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = 'heart.csv'

  document.body.appendChild(a)
  a.click()

  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="heart-panel">
    <section class="upload">
      <button type="button" @click="downloadTemplate">File Template</button>
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
      <button type="button" @click="loadExample">Load Example Data</button>
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
  </div>
</template>

<style scoped>
.file-input {
  display: none;
}
</style>
