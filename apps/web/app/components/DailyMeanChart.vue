<script setup lang="ts">
import * as d3 from 'd3'
import { dailyMeans } from '~/utils/dailyMeans'
import type { Entry } from '~/utils/parseHealthFile'

const props = defineProps<{ entries: Entry[] }>()

const svgEl = ref<SVGSVGElement | null>(null)

type PanelKey = 'meanSystolic' | 'meanDiastolic' | 'meanPulse'

// One row per variable, each with its own y-scale and threshold band --
// mirrors temp.R's facet_grid(rows = vars(variable), scales = "free_y").
const PANELS: { key: PanelKey; label: string; colorClass: string; thresholds: [number, number] }[] = [
  { key: 'meanSystolic', label: 'systolic', colorClass: 'series-systolic', thresholds: [120, 130] },
  { key: 'meanDiastolic', label: 'diastolic', colorClass: 'series-diastolic', thresholds: [80, 90] },
  { key: 'meanPulse', label: 'pulse', colorClass: 'series-pulse', thresholds: [55, 85] }
]

const WIDTH = 720
const MARGIN = { top: 48, right: 24, bottom: 64, left: 56 }
const PANEL_HEIGHT = 130
const PANEL_GAP = 20
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const PANELS_HEIGHT = PANELS.length * PANEL_HEIGHT + (PANELS.length - 1) * PANEL_GAP
const HEIGHT = MARGIN.top + PANELS_HEIGHT + MARGIN.bottom

function draw() {
  const svg = d3.select(svgEl.value)
  svg.selectAll('*').remove()

  const data = dailyMeans(props.entries)
  if (data.length === 0) return

  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.date) as [Date, Date])
    .range([0, INNER_WIDTH])

  svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

  svg.append('text')
    .attr('class', 'chart-title')
    .attr('x', WIDTH / 2)
    .attr('y', 24)
    .attr('text-anchor', 'middle')
    .text('Daily Mean Systolic, Diastolic, and Pulse')

  const root = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  PANELS.forEach((panel, i) => {
    const panelTop = i * (PANEL_HEIGHT + PANEL_GAP)
    const panelG = root.append('g').attr('class', 'panel').attr('transform', `translate(0,${panelTop})`)

    const values = data.map(d => d[panel.key])
    const [tMin, tMax] = panel.thresholds
    const domainMin = Math.min(...values, tMin)
    const domainMax = Math.max(...values, tMax)
    const pad = (domainMax - domainMin) * 0.1 || 1

    const y = d3.scaleLinear()
      .domain([domainMin - pad, domainMax + pad])
      .range([PANEL_HEIGHT, 0])
      .nice()

    panelG.append('g')
      .attr('class', 'gridlines')
      .call(d3.axisLeft(y).ticks(4).tickSize(-INNER_WIDTH).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())

    panelG.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).ticks(4))

    panelG.append('rect')
      .attr('class', 'panel-border')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', INNER_WIDTH)
      .attr('height', PANEL_HEIGHT)

    panel.thresholds.forEach(v => {
      panelG.append('line')
        .attr('class', `threshold ${panel.colorClass}`)
        .attr('x1', 0)
        .attr('x2', INNER_WIDTH)
        .attr('y1', y(v))
        .attr('y2', y(v))
    })

    panelG.selectAll(`.dot-${panel.key}`)
      .data(data)
      .join('circle')
      .attr('class', `dot ${panel.colorClass}`)
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d[panel.key]))
      .attr('r', 2)

    panelG.append('text')
      .attr('class', 'facet-label')
      .attr('x', INNER_WIDTH - 4)
      .attr('y', 14)
      .attr('text-anchor', 'end')
      .text(panel.label)

    if (i === PANELS.length - 1) {
      panelG.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${PANEL_HEIGHT})`)
        .call(d3.axisBottom(x).ticks(d3.timeMonth.every(1)).tickFormat(d => d3.timeFormat('%Y-%m')(d as Date)))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')

      panelG.append('text')
        .attr('class', 'axis-label')
        .attr('x', INNER_WIDTH / 2)
        .attr('y', PANEL_HEIGHT + 58)
        .attr('text-anchor', 'middle')
        .text('Date')
    }
  })
}

onMounted(draw)
watch(() => props.entries, draw)

function handleAfterPrint() {
  document.body.classList.remove('is-printing-chart')
}

onMounted(() => window.addEventListener('afterprint', handleAfterPrint))
onUnmounted(() => window.removeEventListener('afterprint', handleAfterPrint))

function printChart() {
  document.body.classList.add('is-printing-chart')
  window.print()
}

// The exported SVG is a standalone document with no access to this
// component's (scoped, page-resident) stylesheet, so the marks' appearance
// has to travel with the markup as an inlined <style> -- plain equivalents
// of the scoped rules below, literal colors instead of CSS custom properties
// (same constraint the Chart.js sibling components hit with canvas).
const EXPORT_STYLES = `
  .chart-title { fill: #0b0b0b; font-size: 15px; font-weight: 600; font-family: "Noto Sans", Verdana, sans-serif; }
  .gridlines line { stroke: #e1e0d9; stroke-width: 1; }
  .panel-border { fill: none; stroke: #c3c2b7; stroke-width: 1; }
  .x-axis .domain, .y-axis .domain { stroke: #c3c2b7; }
  .x-axis text, .y-axis text { fill: #898781; font-size: 11px; font-family: "Noto Sans", Verdana, sans-serif; }
  .axis-label { fill: #52514e; font-size: 12px; font-family: "Noto Sans", Verdana, sans-serif; }
  .facet-label { fill: #52514e; font-size: 11px; font-weight: 600; font-family: "Noto Sans", Verdana, sans-serif; }
  .threshold { stroke-width: 1.5; stroke-dasharray: 5 4; stroke: #000; }
  .dot { stroke: #fcfcfb; stroke-width: 2; }
  .dot.series-systolic { fill: #2a78d6; }
  .dot.series-diastolic { fill: #eb6834; }
  .dot.series-pulse { fill: #1baf7a; }
`

async function saveAsPng() {
  if (!svgEl.value) return

  const clone = svgEl.value.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(WIDTH))
  clone.setAttribute('height', String(HEIGHT))
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = EXPORT_STYLES
  clone.insertBefore(style, clone.firstChild)

  const svgString = new XMLSerializer().serializeToString(clone)
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`

  const img = new Image()
  img.src = svgUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to render chart image'))
  })

  const scale = 2
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * scale
  canvas.height = HEIGHT * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)
  ctx.fillStyle = '#fcfcfb'
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.drawImage(img, 0, 0, WIDTH, HEIGHT)

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daily-mean-chart-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}
</script>

<template>
  <div class="chart-container chart-print-target">
    <div class="chart-toolbar">
      <button type="button" @click="printChart">Print Chart</button>
      <button type="button" @click="saveAsPng">Save as PNG</button>
    </div>
    <svg ref="svgEl" class="chart-svg" role="img" aria-label="Daily mean systolic, diastolic, and pulse">
    </svg>
  </div>
</template>

<style>
@media print {
  body.is-printing-chart * {
    visibility: hidden;
  }

  body.is-printing-chart .chart-print-target,
  body.is-printing-chart .chart-print-target * {
    visibility: visible;
  }

  body.is-printing-chart .chart-print-target {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }

  body.is-printing-chart .chart-toolbar {
    display: none !important;
  }
}
</style>

<style scoped>
.chart-container {
  --surface-1: #fcfcfb;
  --text-primary: #0b0b0b;
  --text-secondary: #52514e;
  --text-muted: #898781;
  --gridline: #e1e0d9;
  --axis: #c3c2b7;
  --series-systolic: #2a78d6;
  --series-diastolic: #eb6834;
  --series-pulse: #1baf7a;

  position: relative;
  background: var(--surface-1);
}

.chart-toolbar {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 8px 8px 0;
}

.chart-svg {
  width: 100%;
  height: auto;
  font-family: "Noto Sans", Verdana, sans-serif;
}

:deep(.chart-title) {
  fill: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

:deep(.gridlines line) {
  stroke: var(--gridline);
  stroke-width: 1;
}

:deep(.panel-border) {
  fill: none;
  stroke: var(--axis);
  stroke-width: 1;
}

:deep(.x-axis .domain),
:deep(.y-axis .domain) {
  stroke: var(--axis);
}

:deep(.x-axis text),
:deep(.y-axis text) {
  fill: var(--text-muted);
  font-size: 11px;
}

:deep(.axis-label) {
  fill: var(--text-secondary);
  font-size: 12px;
}

:deep(.facet-label) {
  fill: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
}

:deep(.threshold) {
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  stroke: #000;
}

:deep(.dot) {
  stroke: var(--surface-1);
  stroke-width: 2;
}

:deep(.dot.series-systolic) {
  fill: var(--series-systolic);
}

:deep(.dot.series-diastolic) {
  fill: var(--series-diastolic);
}

:deep(.dot.series-pulse) {
  fill: var(--series-pulse);
}
</style>
