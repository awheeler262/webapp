<script setup lang="ts">
import * as d3 from 'd3'
import { monthlyBoxplotStats, type BoxplotStats, type Metric } from '~/utils/monthlyBoxplotStats'
import type { Entry } from '~/utils/parseHealthFile'

const props = defineProps<{ entries: Entry[]; metric: Metric }>()

const svgEl = ref<SVGSVGElement | null>(null)
const tooltipVisible = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)
const tooltipMonth = ref('')
const tooltipStats = ref<BoxplotStats | null>(null)

const WIDTH = 720
const HEIGHT = 420
const MARGIN = { top: 48, right: 24, bottom: 64, left: 56 }
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom

const THRESHOLDS: Record<Metric, { min: number; max: number }> = {
  systolic: { min: 90, max: 120 },
  diastolic: { min: 60, max: 80 }
}

function draw() {
  const svg = d3.select(svgEl.value)
  svg.selectAll('*').remove()

  const stats = monthlyBoxplotStats(props.entries, props.metric)
  if (stats.length === 0) return

  const threshold = THRESHOLDS[props.metric]
  const allValues = stats.flatMap(s => [s.min, s.max, ...s.outliers])
  const domainMin = Math.min(...allValues, threshold.min)
  const domainMax = Math.max(...allValues, threshold.max)
  const yMin = Math.floor(domainMin / 5) * 5
  const yMax = Math.ceil(domainMax / 5) * 5

  const x = d3.scaleBand()
    .domain(stats.map(s => s.yearMonth))
    .range([0, INNER_WIDTH])
    .padding(0.3)

  const y = d3.scaleLinear()
    .domain([yMin, yMax])
    .range([INNER_HEIGHT, 0])

  const boxWidth = Math.min(x.bandwidth(), 48)

  svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

  const title = props.metric === 'systolic' ? 'Systolic Pressure' : 'Diastolic Pressure'
  svg.append('text')
    .attr('class', 'chart-title')
    .attr('x', WIDTH / 2)
    .attr('y', 24)
    .attr('text-anchor', 'middle')
    .text(title)

  const root = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  root.append('g')
    .attr('class', 'gridlines')
    .call(d3.axisLeft(y).tickValues(d3.range(yMin, yMax + 1, 5)).tickSize(-INNER_WIDTH).tickFormat(() => ''))
    .call(g => g.select('.domain').remove())

  root.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${INNER_HEIGHT})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')

  root.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(y).tickValues(d3.range(yMin, yMax + 1, 5)))

  root.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -INNER_HEIGHT / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .text('Pressure (mmHg)')

  root.append('text')
    .attr('class', 'axis-label')
    .attr('x', INNER_WIDTH / 2)
    .attr('y', INNER_HEIGHT + 58)
    .attr('text-anchor', 'middle')
    .text('Year-Month')

  ;([threshold.min, threshold.max] as const).forEach(v => {
    root.append('line')
      .attr('class', 'threshold')
      .attr('x1', 0)
      .attr('x2', INNER_WIDTH)
      .attr('y1', y(v))
      .attr('y2', y(v))
  })

  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${MARGIN.left},${HEIGHT - 16})`)
  legend.append('line').attr('class', 'legend-key threshold').attr('x1', 0).attr('x2', 20).attr('y1', 0).attr('y2', 0)
  legend.append('text').attr('class', 'legend-label').attr('x', 26).attr('y', 4).text('Normal range')

  const groups = root.selectAll('.month-group')
    .data(stats)
    .join('g')
    .attr('class', 'month-group')
    .attr('transform', d => `translate(${x(d.yearMonth)},0)`)

  const cx = x.bandwidth() / 2

  groups.append('line')
    .attr('class', 'whisker')
    .attr('x1', cx)
    .attr('x2', cx)
    .attr('y1', d => y(d.min))
    .attr('y2', d => y(d.max))

  const cap = (accessor: (d: BoxplotStats) => number) => {
    groups.append('line')
      .attr('class', 'whisker-cap')
      .attr('x1', cx - boxWidth * 0.2)
      .attr('x2', cx + boxWidth * 0.2)
      .attr('y1', d => y(accessor(d)))
      .attr('y2', d => y(accessor(d)))
  }
  cap(d => d.min)
  cap(d => d.max)

  groups.append('rect')
    .attr('class', 'box')
    .attr('x', cx - boxWidth / 2)
    .attr('y', d => y(d.q3))
    .attr('width', boxWidth)
    .attr('height', d => Math.max(1, y(d.q1) - y(d.q3)))

  groups.append('line')
    .attr('class', 'median')
    .attr('x1', cx - boxWidth / 2)
    .attr('x2', cx + boxWidth / 2)
    .attr('y1', d => y(d.median))
    .attr('y2', d => y(d.median))

  groups.each(function (d) {
    d3.select(this).selectAll('.outlier')
      .data(d.outliers)
      .join('circle')
      .attr('class', 'outlier')
      .attr('cx', cx)
      .attr('cy', v => y(v))
      .attr('r', 4)
  })

  groups.append('rect')
    .attr('class', 'hit-area')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', x.bandwidth())
    .attr('height', INNER_HEIGHT)
    .style('fill', 'none')
    .style('pointer-events', 'all')
    .on('pointerenter', function (_event, d) {
      d3.select(this.parentNode as SVGGElement).select('.box').classed('hover', true)

      const rect = svgEl.value!.getBoundingClientRect()
      const scale = rect.width / WIDTH
      tooltipVisible.value = true
      tooltipX.value = (MARGIN.left + (x(d.yearMonth) ?? 0) + x.bandwidth() / 2) * scale
      tooltipY.value = (MARGIN.top + y(d.max)) * scale - 12
      tooltipMonth.value = d.yearMonth
      tooltipStats.value = d
    })
    .on('pointerleave', function () {
      d3.select(this.parentNode as SVGGElement).select('.box').classed('hover', false)
      tooltipVisible.value = false
    })
}

onMounted(draw)
watch(() => [props.entries, props.metric], draw)
</script>

<template>
  <div class="chart-container">
    <svg ref="svgEl" class="chart-svg" role="img" :aria-label="`Monthly ${metric} pressure distribution`">
    </svg>
    <div v-if="tooltipVisible && tooltipStats" class="tooltip" :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }">
      <div class="tooltip-date">{{ tooltipMonth }}</div>
      <div class="tooltip-row">Max <strong>{{ Math.round(tooltipStats.max) }}</strong></div>
      <div class="tooltip-row">Q3 <strong>{{ Math.round(tooltipStats.q3) }}</strong></div>
      <div class="tooltip-row">Median <strong>{{ Math.round(tooltipStats.median) }}</strong></div>
      <div class="tooltip-row">Q1 <strong>{{ Math.round(tooltipStats.q1) }}</strong></div>
      <div class="tooltip-row">Min <strong>{{ Math.round(tooltipStats.min) }}</strong></div>
      <div v-if="tooltipStats.outliers.length" class="tooltip-row">Outliers <strong>{{ tooltipStats.outliers.map(v => Math.round(v)).join(', ') }}</strong></div>
    </div>
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
  --box-color: #2a78d6;
  --threshold-color: #fab219;

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

:deep(.threshold) {
  stroke: var(--threshold-color);
  stroke-width: 2;
}

:deep(.whisker),
:deep(.whisker-cap) {
  stroke: var(--box-color);
  stroke-width: 1.5;
}

:deep(.box) {
  fill: var(--box-color);
  fill-opacity: 0.1;
  stroke: var(--box-color);
  stroke-width: 2;
}

:deep(.box.hover) {
  fill-opacity: 0.2;
  stroke-width: 3;
}

:deep(.median) {
  stroke: var(--box-color);
  stroke-width: 2;
}

:deep(.outlier) {
  fill: var(--box-color);
  stroke: var(--surface-1);
  stroke-width: 2;
}

:deep(.legend-key.threshold) {
  stroke: var(--threshold-color);
  stroke-width: 2;
}

:deep(.legend-label) {
  fill: var(--text-secondary);
  font-size: 12px;
}

.tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
  background: var(--surface-1);
  border: 1px solid var(--gridline);
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--text-secondary);
  box-shadow: 0 2px 6px rgba(11, 11, 11, 0.15);
  pointer-events: none;
  white-space: nowrap;
}

.tooltip-date {
  color: var(--text-primary);
  font-weight: 600;
  margin-bottom: 2px;
}

.tooltip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.tooltip-row strong {
  color: var(--text-primary);
}
</style>
