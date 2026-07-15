const POLL_INTERVAL_MS = 1000
const MAX_LOG_TICKS = 50

function escapeHtml (value) {
  const div = document.createElement('div')
  div.textContent = String(value)
  return div.innerHTML
}

function formatScores (scores) {
  return Object.entries(scores)
    .map(([name, score]) => `${escapeHtml(name)}: ${score}`)
    .join(', ')
}

function formatResponseTime (responseTime) {
  if (responseTime === null || responseTime === undefined) {
    return '-'
  }
  return (responseTime * 1000.0).toFixed(1)
}

function renderResults (results) {
  const body = document.getElementById('results-body')
  const empty = document.getElementById('results-empty')

  if (results.length === 0) {
    body.innerHTML = ''
    empty.classList.remove('hidden')
    return
  }

  empty.classList.add('hidden')
  body.innerHTML = [...results].reverse().map(result => `
    <tr>
      <td>${escapeHtml(result.winner ?? 'Tie')}</td>
      <td>${formatScores(result.scores)}</td>
    </tr>
  `).join('')
}

function renderLog (history) {
  const body = document.getElementById('log-body')
  const empty = document.getElementById('log-empty')

  if (history.length === 0) {
    body.innerHTML = ''
    empty.classList.remove('hidden')
    return
  }

  empty.classList.add('hidden')

  const recentTicks = [...history].reverse().slice(0, MAX_LOG_TICKS)
  const rows = recentTicks.flatMap(tick => tick.players.map(player => `
    <tr>
      <td>${tick.step + 1}</td>
      <td>${escapeHtml(player.name)}</td>
      <td>${player.score}</td>
      <td>${player.pickups}</td>
      <td>${player.hits}</td>
      <td>${player.misses}</td>
      <td>${player.breaks}</td>
      <td>${player.jumps}</td>
      <td>${player.collisions}</td>
      <td>${formatResponseTime(player.response_time)}</td>
    </tr>
  `))

  body.innerHTML = rows.join('')
}

async function poll () {
  try {
    const response = await fetch('/api/telemetry')
    const data = await response.json()
    renderResults(data.recent_results)
    renderLog(data.history)
  } catch (error) {
    console.log('Error fetching telemetry: ' + error.toString())
  }
}

async function clearHistory () {
  const button = document.getElementById('clear-button')
  button.setAttribute('disabled', 'disabled')
  try {
    const response = await fetch('/api/telemetry/clear', { method: 'POST' })
    const data = await response.json()
    renderResults(data.recent_results)
    renderLog(data.history)
  } catch (error) {
    console.log('Error clearing telemetry: ' + error.toString())
  } finally {
    button.removeAttribute('disabled')
  }
}

document.getElementById('clear-button').addEventListener('click', clearHistory)

poll()
setInterval(poll, POLL_INTERVAL_MS)
