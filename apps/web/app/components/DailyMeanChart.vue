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
</script>

<template>
  <div class="chart-container">
    <svg ref="svgEl" class="chart-svg" role="img" aria-label="Daily mean systolic, diastolic, and pulse">
    </svg>
  </div>
</template>

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
}

:deep(.threshold.series-systolic) {
  stroke: var(--series-systolic);
}

:deep(.threshold.series-diastolic) {
  stroke: var(--series-diastolic);
}

:deep(.threshold.series-pulse) {
  stroke: var(--series-pulse);
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
