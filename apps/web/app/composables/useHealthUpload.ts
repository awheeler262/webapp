import type { HealthRequestDto, HealthResponseDto, HealthService } from '@my-app/validation'

export function useHealthUpload<T>(options: { service: HealthService; parseFile: (file: File) => Promise<T[]> }) {
  const records = ref<T[]>([])
  const transaction = ref<HealthRequestDto | null>(null)
  const submitted = ref(false)
  const uploadError = ref('')
  const fileName = ref('')
  const fileInput = ref<HTMLInputElement | null>(null)

  async function hashFile(entries: T[]): Promise<string> {
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
    submitted.value = false
    records.value = []
    transaction.value = null

    let parsed: T[]
    try {
      parsed = await options.parseFile(file)
    } catch (err) {
      uploadError.value = err instanceof Error ? err.message : 'Failed to parse file'
      return
    }

    records.value = parsed
    const payload: HealthRequestDto = {
      service: options.service,
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

  return { records, transaction, submitted, uploadError, fileName, fileInput, triggerUpload, onFileChange }
}
