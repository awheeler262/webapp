<script setup lang="ts">
definePageMeta({ requiresAuth: false })

import HeartPanel from '~/components/HeartPanel.vue'

// Each entry is a self-contained category panel (its own template, upload
// flow, actions, and charts). Adding a category is: build its panel
// component, register it here -- nothing else on this page changes.
const CATEGORIES = [
  { id: 'heart', label: 'Heart', component: HeartPanel }
]

const activeCategory = ref(CATEGORIES[0]!.id)
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

    <div class="tabs" role="tablist" aria-label="Wellness categories">
      <button
        v-for="category in CATEGORIES"
        :key="category.id"
        type="button"
        role="tab"
        :id="`tab-${category.id}`"
        :aria-selected="activeCategory === category.id"
        :aria-controls="`panel-${category.id}`"
        :class="{ active: activeCategory === category.id }"
        @click="activeCategory = category.id"
      >
        {{ category.label }}
      </button>
    </div>

    <!-- v-show (not v-if) so switching tabs never loses a category's loaded
         file/results -- every panel stays mounted once its tab is visited. -->
    <div
      v-for="category in CATEGORIES"
      :key="category.id"
      v-show="activeCategory === category.id"
      :id="`panel-${category.id}`"
      role="tabpanel"
      :aria-labelledby="`tab-${category.id}`"
    >
      <component :is="category.component" />
    </div>
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

.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  border-bottom: 1px solid #c3c2b7;
  margin-bottom: 1.5rem;
}

.tabs button {
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: none;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.tabs button.active {
  border-color: #c3c2b7;
  background: #fff;
  font-weight: 600;
}
</style>
