<script setup lang="ts">
import * as d3 from 'd3'
import { dailyMeans, smoothedDailyMeans, type DailyMean } from '~/utils/dailyMeans'
import type { Entry } from '~/utils/parseHealthFile'

const props = defineProps<{ entries: Entry[] }>()

const svgEl = ref<SVGSVGElement | null>(null)
const tooltipVisible = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)
const tooltipDate = ref('')
const tooltipSystolic = ref(0)
const tooltipDiastolic = ref(0)

const WIDTH = 720
const HEIGHT = 420
const MARGIN = { top: 48, right: 24, bottom: 64, left: 56 }
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom

const bisectDate = d3.bisector<DailyMean, Date>(d => d.date).left

function draw() {
  const svg = d3.select(svgEl.value)
  svg.selectAll('*').remove()

  const data = dailyMeans(props.entries)
  if (data.length === 0) return

  const smoothed = smoothedDailyMeans(data)

  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.date) as [Date, Date])
    .range([0, INNER_WIDTH])

  const y = d3.scaleLinear()
    .domain([
      d3.min(data, d => Math.min(d.meanSystolic, d.meanDiastolic))! - 5,
      d3.max(data, d => Math.max(d.meanSystolic, d.meanDiastolic))! + 5
    ])
    .range([INNER_HEIGHT, 0])
    .nice()

  svg.attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)

  svg.append('text')
    .attr('class', 'chart-title')
    .attr('x', WIDTH / 2)
    .attr('y', 24)
    .attr('text-anchor', 'middle')
    .text('Daily Mean Systolic and Diastolic Pressure')

  const root = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  root.append('g')
    .attr('class', 'gridlines')
    .call(d3.axisLeft(y).ticks(6).tickSize(-INNER_WIDTH).tickFormat(() => ''))
    .call(g => g.select('.domain').remove())

  root.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0,${INNER_HEIGHT})`)
    .call(d3.axisBottom(x).ticks(d3.timeMonth.every(1)).tickFormat(d => d3.timeFormat('%Y-%m')(d as Date)))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')

  root.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(y).ticks(6))

  root.append('text')
    .attr('class', 'axis-label')
    .attr('transform', 'rotate(-90)')
    .attr('x', -INNER_HEIGHT / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .text('Mean Pressure (mmHg)')

  const trendLine = (accessor: (d: DailyMean) => number) =>
    d3.line<DailyMean>()
      .x(d => x(d.date))
      .y(d => y(accessor(d)))
      .curve(d3.curveMonotoneX)

  root.append('path')
    .datum(smoothed)
    .attr('class', 'trend series-systolic')
    .attr('d', trendLine(d => d.meanSystolic))

  root.append('path')
    .datum(smoothed)
    .attr('class', 'trend series-diastolic')
    .attr('d', trendLine(d => d.meanDiastolic))

  root.selectAll('.dot-systolic')
    .data(data)
    .join('circle')
    .attr('class', 'dot dot-systolic series-systolic')
    .attr('cx', d => x(d.date))
    .attr('cy', d => y(d.meanSystolic))
    .attr('r', 4)

  root.selectAll('.dot-diastolic')
    .data(data)
    .join('circle')
    .attr('class', 'dot dot-diastolic series-diastolic')
    .attr('cx', d => x(d.date))
    .attr('cy', d => y(d.meanDiastolic))
    .attr('r', 4)

  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${MARGIN.left},${HEIGHT - 16})`)

  const legendEntry = (i: number, cls: string, label: string) => {
    const g = legend.append('g').attr('transform', `translate(${i * 110},0)`)
    g.append('line').attr('class', `legend-key ${cls}`).attr('x1', 0).attr('x2', 20).attr('y1', 0).attr('y2', 0)
    g.append('text').attr('class', 'legend-label').attr('x', 26).attr('y', 4).text(label)
  }
  legendEntry(0, 'series-systolic', 'Systolic')
  legendEntry(1, 'series-diastolic', 'Diastolic')
}

onMounted(draw)
watch(() => props.entries, draw)
</script>

<template>
  <div class="chart-container">
    <svg ref="svgEl" class="chart-svg" role="img" aria-label="Daily mean systolic and diastolic pressure by month">
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

:deep(.trend) {
  fill: none;
  stroke-width: 2;
}

:deep(.trend.series-systolic) {
  stroke: var(--series-systolic);
}

:deep(.trend.series-diastolic) {
  stroke: var(--series-diastolic);
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

:deep(.legend-key.series-systolic) {
  stroke: var(--series-systolic);
  stroke-width: 2;
}

:deep(.legend-key.series-diastolic) {
  stroke: var(--series-diastolic);
  stroke-width: 2;
}

:deep(.legend-label) {
  fill: var(--text-secondary);
  font-size: 12px;
}

.key {
  display: inline-block;
  width: 10px;
  height: 2px;
}

.key.series-systolic {
  background: var(--series-systolic);
}

.key.series-diastolic {
  background: var(--series-diastolic);
}
</style>
