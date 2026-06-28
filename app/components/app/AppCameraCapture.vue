<script setup lang="ts">
import { X } from '@lucide/vue'

const emit = defineEmits<{ 'file-selected': [file: File] }>()

const cameraOpen  = ref(false)
const videoRef    = ref<HTMLVideoElement | null>(null)
const stream      = ref<MediaStream | null>(null)
const camError    = ref('')
const videoReady  = ref(false)
const capturing   = ref(false)
const previewUrl  = ref<string | null>(null)
const previewBlob = ref<Blob | null>(null)

async function open() {
  camError.value   = ''
  videoReady.value = false
  previewUrl.value  = null
  previewBlob.value = null
  cameraOpen.value = true
  await nextTick()

  if (!navigator?.mediaDevices?.getUserMedia) {
    camError.value = "Camera not available. Make sure you're on localhost or HTTPS."
    return
  }

  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
    const video = videoRef.value
    if (video) {
      video.srcObject = stream.value
      video.onloadedmetadata = () => { videoReady.value = true }
      if (video.readyState >= 1) videoReady.value = true
    }
  } catch (e: any) {
    camError.value = e?.message ?? 'Camera not available'
  }
}

function stopStream() {
  stream.value?.getTracks().forEach((t: MediaStreamTrack) => t.stop())
  stream.value    = null
  videoReady.value = false
}

function close() {
  stopStream()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  cameraOpen.value  = false
  camError.value    = ''
  previewUrl.value  = null
  previewBlob.value = null
}

function snap() {
  const video = videoRef.value
  if (!video) return
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return
  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  canvas.getContext('2d')?.drawImage(video, 0, 0, w, h)
  canvas.toBlob(blob => {
    if (!blob) return
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewBlob.value = blob
    previewUrl.value  = URL.createObjectURL(blob)
    stopStream()
  }, 'image/jpeg', 0.92)
}

function retake() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value  = null
  previewBlob.value = null
  open()
}

function usePhoto() {
  if (!previewBlob.value) return
  capturing.value = true
  const file = new File([previewBlob.value], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' })
  emit('file-selected', file)
  close()
  capturing.value = false
}

defineExpose({ open })
</script>

<template>
  <Dialog :open="cameraOpen" @update:open="v => !v && close()">
    <DialogContent class="p-0 overflow-hidden max-w-lg gap-0 border-border/60 [&>button]:hidden">
      <div class="relative bg-black w-full" style="aspect-ratio: 4/3">
        <video
          v-show="!previewUrl && !camError"
          ref="videoRef"
          autoplay
          playsinline
          muted
          class="w-full h-full object-cover"
        />
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt="Receipt preview"
          class="w-full h-full object-contain bg-black"
        />
        <div
          v-if="camError && !previewUrl"
          class="flex flex-col items-center justify-center h-full gap-3 text-white/50 text-sm p-8 text-center"
        >
          {{ camError }}
        </div>
        <button
          type="button"
          class="absolute top-3 right-3 size-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-10"
          @click="close"
        >
          <X class="size-4" />
        </button>
      </div>

      <div class="flex items-center justify-center gap-5 py-5 bg-[#0a0a0a] border-t border-border/40 min-h-[5rem]">
        <template v-if="!previewUrl">
          <button
            type="button"
            class="size-14 rounded-full border-4 border-white/70 bg-transparent hover:bg-white/10 transition-colors flex items-center justify-center disabled:opacity-30"
            :disabled="!videoReady || !!camError"
            aria-label="Take photo"
            @click="snap"
          >
            <span class="size-9 rounded-full bg-white block" />
          </button>
        </template>
        <template v-else>
          <Button variant="outline" size="sm" @click="retake">Retake</Button>
          <Button size="sm" :disabled="capturing" @click="usePhoto">
            {{ capturing ? 'Saving…' : 'Use photo' }}
          </Button>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
