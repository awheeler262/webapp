<script setup lang="ts">
import * as d3 from 'd3'
import { monthlyBoxplotStats, type BoxplotStats, type Metric } from '~/utils/monthlyBoxplotStats'
import type { Entry } from '~/utils/parseHealthFile'

const props = defineProps<{ entries: Entry[] }>()

const svgEl = ref<SVGSVGElement | null>(null)

// One row per variable, each with its own y-scale and threshold band --
// mirrors temp.R's facet_grid(rows = vars(variable), scales = "free_y").
const PANELS: { metric: Metric; label: string; colorClass: string; thresholds: [number, number] }[] = [
  { metric: 'systolic', label: 'systolic', colorClass: 'series-systolic', thresholds: [120, 130] },
  { metric: 'diastolic', label: 'diastolic', colorClass: 'series-diastolic', thresholds: [80, 90] },
  { metric: 'pulse', label: 'pulse', colorClass: 'series-pulse', thresholds: [55, 85] }
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

  const months = monthlyBoxplotStats(props.entries, 'systolic').map(s => s.yearMonth)
  if (months.length === 0) return

  const x = d3.scaleBand()
    .domain(months)
    .range([0, INNER_WIDTH])
    .padding(0.3)

  const boxWidth = Math.min(x.bandwidth(), 48)
  const cx = x.bandwidth() / 2

  svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

  svg.append('text')
    .attr('class', 'chart-title')
    .attr('x', WIDTH / 2)
    .attr('y', 24)
    .attr('text-anchor', 'middle')
    .text('Monthly Systolic, Diastolic, and Pulse')

  const root = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  PANELS.forEach((panel, i) => {
    const panelTop = i * (PANEL_HEIGHT + PANEL_GAP)
    const panelG = root.append('g').attr('class', 'panel').attr('transform', `translate(0,${panelTop})`)

    const stats = monthlyBoxplotStats(props.entries, panel.metric)
    const [tMin, tMax] = panel.thresholds
    const allValues = stats.flatMap(s => [s.min, s.max, ...s.outliers])
    const domainMin = Math.min(...allValues, tMin)
    const domainMax = Math.max(...allValues, tMax)
    const yMin = Math.floor(domainMin / 5) * 5
    const yMax = Math.ceil(domainMax / 5) * 5

    const y = d3.scaleLinear()
      .domain([yMin, yMax])
      .range([PANEL_HEIGHT, 0])

    panelG.append('g')
      .attr('class', 'gridlines')
      .call(d3.axisLeft(y).tickValues(d3.range(yMin, yMax + 1, 5)).tickSize(-INNER_WIDTH).tickFormat(() => ''))
      .call(g => g.select('.domain').remove())

    panelG.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(y).tickValues(d3.range(yMin, yMax + 1, 5)))

    panelG.append('rect')
      .attr('class', 'panel-border')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', INNER_WIDTH)
      .attr('height', PANEL_HEIGHT)

    panel.thresholds.forEach(v => {
      panelG.append('line')
        .attr('class', 'threshold')
        .attr('x1', 0)
        .attr('x2', INNER_WIDTH)
        .attr('y1', y(v))
        .attr('y2', y(v))
    })

    panelG.append('text')
      .attr('class', 'facet-label')
      .attr('x', INNER_WIDTH - 4)
      .attr('y', 14)
      .attr('text-anchor', 'end')
      .text(panel.label)

    const groups = panelG.selectAll('.month-group')
      .data(stats)
      .join('g')
      .attr('class', 'month-group')
      .attr('transform', d => `translate(${x(d.yearMonth)},0)`)

    groups.append('line')
      .attr('class', `whisker ${panel.colorClass}`)
      .attr('x1', cx)
      .attr('x2', cx)
      .attr('y1', d => y(d.min))
      .attr('y2', d => y(d.max))

    const cap = (accessor: (d: BoxplotStats) => number) => {
      groups.append('line')
        .attr('class', `whisker-cap ${panel.colorClass}`)
        .attr('x1', cx - boxWidth * 0.2)
        .attr('x2', cx + boxWidth * 0.2)
        .attr('y1', d => y(accessor(d)))
        .attr('y2', d => y(accessor(d)))
    }
    cap(d => d.min)
    cap(d => d.max)

    groups.append('rect')
      .attr('class', `box ${panel.colorClass}`)
      .attr('x', cx - boxWidth / 2)
      .attr('y', d => y(d.q3))
      .attr('width', boxWidth)
      .attr('height', d => Math.max(1, y(d.q1) - y(d.q3)))

    groups.append('line')
      .attr('class', `median ${panel.colorClass}`)
      .attr('x1', cx - boxWidth / 2)
      .attr('x2', cx + boxWidth / 2)
      .attr('y1', d => y(d.median))
      .attr('y2', d => y(d.median))

    groups.each(function (d) {
      d3.select(this).selectAll('.outlier')
        .data(d.outliers)
        .join('circle')
        .attr('class', `outlier ${panel.colorClass}`)
        .attr('cx', cx)
        .attr('cy', v => y(v))
        .attr('r', 2)
    })

    if (i === PANELS.length - 1) {
      panelG.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${PANEL_HEIGHT})`)
        .call(d3.axisBottom(x))
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
  .threshold { stroke: #0b0b0b; stroke-width: 1; stroke-dasharray: 5 4; }
  .whisker, .whisker-cap { stroke-width: 1; }
  .whisker.series-systolic, .whisker-cap.series-systolic { stroke: #2a78d6; }
  .whisker.series-diastolic, .whisker-cap.series-diastolic { stroke: #eb6834; }
  .whisker.series-pulse, .whisker-cap.series-pulse { stroke: #1baf7a; }
  .box { fill-opacity: 0.1; stroke-width: 1; }
  .box.series-systolic { fill: #2a78d6; stroke: #2a78d6; }
  .box.series-diastolic { fill: #eb6834; stroke: #eb6834; }
  .box.series-pulse { fill: #1baf7a; stroke: #1baf7a; }
  .median { stroke-width: 1; }
  .median.series-systolic { stroke: #2a78d6; }
  .median.series-diastolic { stroke: #eb6834; }
  .median.series-pulse { stroke: #1baf7a; }
  .outlier { stroke: #fcfcfb; stroke-width: 1; }
  .outlier.series-systolic { fill: #2a78d6; }
  .outlier.series-diastolic { fill: #eb6834; }
  .outlier.series-pulse { fill: #1baf7a; }
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
    a.download = `monthly-boxplot-chart-${new Date().toISOString().slice(0, 10)}.png`
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
    <svg ref="svgEl" class="chart-svg" role="img" aria-label="Monthly systolic, diastolic, and pulse distribution">
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
  stroke: var(--text-primary);
  stroke-width: 1;
  stroke-dasharray: 5 4;
}

:deep(.whisker),
:deep(.whisker-cap) {
  stroke-width: 1;
}

:deep(.whisker.series-systolic),
:deep(.whisker-cap.series-systolic) {
  stroke: var(--series-systolic);
}

:deep(.whisker.series-diastolic),
:deep(.whisker-cap.series-diastolic) {
  stroke: var(--series-diastolic);
}

:deep(.whisker.series-pulse),
:deep(.whisker-cap.series-pulse) {
  stroke: var(--series-pulse);
}

:deep(.box) {
  fill-opacity: 0.1;
  stroke-width: 1;
}

:deep(.box.series-systolic) {
  fill: var(--series-systolic);
  stroke: var(--series-systolic);
}

:deep(.box.series-diastolic) {
  fill: var(--series-diastolic);
  stroke: var(--series-diastolic);
}

:deep(.box.series-pulse) {
  fill: var(--series-pulse);
  stroke: var(--series-pulse);
}

:deep(.median) {
  stroke-width: 1;
}

:deep(.median.series-systolic) {
  stroke: var(--series-systolic);
}

:deep(.median.series-diastolic) {
  stroke: var(--series-diastolic);
}

:deep(.median.series-pulse) {
  stroke: var(--series-pulse);
}

:deep(.outlier) {
  stroke: var(--surface-1);
  stroke-width: 1;
}

:deep(.outlier.series-systolic) {
  fill: var(--series-systolic);
}

:deep(.outlier.series-diastolic) {
  fill: var(--series-diastolic);
}

:deep(.outlier.series-pulse) {
  fill: var(--series-pulse);
}
</style>
