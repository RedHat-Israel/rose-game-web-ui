const POLL_INTERVAL_MS = 1000

function escapeHtml (value) {
  const div = document.createElement('div')
  div.textContent = String(value)
  return div.innerHTML
}

// Two-name assignment stays stable across polls: once a driver name is seen
// in slot A or B, it keeps that slot for the rest of the session (until
// "Clear history" resets everything), so tables don't swap columns mid-poll.
let driverNames = [null, null]

function assignSlots (names) {
  for (const name of names) {
    if (driverNames.includes(name)) continue
    const emptySlot = driverNames.indexOf(null)
    if (emptySlot !== -1) driverNames[emptySlot] = name
  }
}

function resetSlots () {
  driverNames = [null, null]
}

function formatRatio (success, total) {
  if (total === 0) return '0/0 (—)'
  const pct = Math.round((success / total) * 100)
  return `${success}/${total} (${pct}%)`
}

function formatTime (durationSeconds) {
  return durationSeconds === undefined ? '—' : `${durationSeconds.toFixed(1)}s`
}

/**
 * Turn one player's cumulative counters into the obstacle-by-obstacle
 * breakdown shown in the live log: each row is either a success/total ratio
 * (penguins, water, crack) or a plain count with no ratio (walls can never be
 * avoided once your car is on that cell, so there's no "success" outcome to
 * compare against; collisions are car-vs-car, not obstacle-vs-car). Coins are
 * shown as a simple total in the Recent Games summary table instead, not
 * broken out as an obstacle-outcome row here.
 */
function obstacleRows (player) {
  const penguinSuccess = player.pickups - player.coins
  const penguinTotal = penguinSuccess + player.misses
  const waterTotal = player.breaks + player.water_hits
  const crackTotal = player.jumps + player.crack_hits

  return [
    { category: 'Success / Miss', obstacle: 'Penguins', success: penguinSuccess, total: penguinTotal },
    { category: 'Success / Fail', obstacle: 'Water (braked)', success: player.breaks, total: waterTotal },
    { category: 'Success / Fail', obstacle: 'Crack (jumped)', success: player.jumps, total: crackTotal },
    { category: 'Fail', obstacle: 'Walls hit', count: player.wall_hits },
    { category: '—', obstacle: 'Collisions', count: player.collisions }
  ]
}

function renderStatRows (rows) {
  return rows.map(row => `
    <tr>
      <td>${escapeHtml(row.category)}</td>
      <td>${escapeHtml(row.obstacle)}</td>
      <td>${row.total !== undefined ? formatRatio(row.success, row.total) : row.count}</td>
    </tr>
  `).join('')
}

function renderLog (history, running) {
  const heading = document.getElementById('log-heading')
  const empty = document.getElementById('log-empty')
  const tables = document.getElementById('log-tables')

  if (history.length === 0) {
    heading.textContent = 'Live Log'
    empty.classList.remove('hidden')
    tables.classList.add('hidden')
    return
  }

  heading.textContent = running ? 'Live Log — Current Game' : 'Live Log — Last Game'
  empty.classList.add('hidden')
  tables.classList.remove('hidden')

  const latestPlayers = history[history.length - 1].players
  assignSlots(latestPlayers.map(p => p.name))

  ;['a', 'b'].forEach((slot, i) => {
    const name = driverNames[i]
    const nameEl = document.getElementById(`log-name-${slot}`)
    const tableBody = document.querySelector(`#log-table-${slot} tbody`)

    const player = latestPlayers.find(p => p.name === name)
    if (!player) {
      nameEl.textContent = name ?? '—'
      tableBody.innerHTML = ''
      return
    }

    nameEl.textContent = name
    tableBody.innerHTML = `
      ${renderStatRows(obstacleRows(player))}
      <tr class="score-row"><td colspan="2">Score</td><td>${player.score}</td></tr>
    `
  })
}

function renderResults (recentResults, totalFinished) {
  const empty = document.getElementById('results-empty')
  const content = document.getElementById('results-content')

  if (recentResults.length === 0) {
    empty.classList.remove('hidden')
    content.classList.add('hidden')
    return
  }

  empty.classList.add('hidden')
  content.classList.remove('hidden')

  const firstRoundNumber = totalFinished - recentResults.length + 1
  const newestFirst = recentResults.map((result, i) => ({
    result,
    round: firstRoundNumber + i
  })).reverse()

  document.getElementById('results-name-a').textContent = driverNames[0] ?? '—'
  document.getElementById('results-name-b').textContent = driverNames[1] ?? '—'
  document.getElementById('summary-name-a').textContent = driverNames[0] ? `${driverNames[0]} Coins` : '—'
  document.getElementById('summary-name-b').textContent = driverNames[1] ? `${driverNames[1]} Coins` : '—'

  document.getElementById('summary-body').innerHTML = newestFirst.map(({ result, round }) => `
    <tr>
      <td>${round}</td>
      <td title="${escapeHtml(result.winner ?? 'Tie')}">${escapeHtml(result.winner ?? 'Tie')}</td>
      <td>${formatTime(result.duration_seconds)}</td>
      <td>${result.players?.[driverNames[0]]?.coins ?? '—'}</td>
      <td>${result.players?.[driverNames[1]]?.coins ?? '—'}</td>
    </tr>
  `).join('')

  ;['a', 'b'].forEach((slot, i) => {
    const name = driverNames[i]
    const body = document.getElementById(`results-body-${slot}`)
    body.innerHTML = newestFirst.map(({ result, round }) => {
      const player = result.players?.[name]
      if (!player) {
        return `<tr><td>${round}</td><td colspan="6">—</td></tr>`
      }
      const penguinSuccess = player.pickups - player.coins
      const waterTotal = player.breaks + player.water_hits
      const crackTotal = player.jumps + player.crack_hits
      return `
        <tr>
          <td>${round}</td>
          <td>${player.score}</td>
          <td>${formatRatio(penguinSuccess, penguinSuccess + player.misses)}</td>
          <td>${formatRatio(player.breaks, waterTotal)}</td>
          <td>${formatRatio(player.jumps, crackTotal)}</td>
          <td>${player.wall_hits}</td>
          <td>${player.collisions}</td>
        </tr>
      `
    }).join('')
  })
}

async function poll () {
  try {
    const response = await fetch('/api/telemetry')
    const data = await response.json()
    renderLog(data.history, data.running)
    renderResults(data.recent_results, data.total_finished)
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
    resetSlots()
    renderLog(data.history, data.running)
    renderResults(data.recent_results, data.total_finished ?? 0)
  } catch (error) {
    console.log('Error clearing telemetry: ' + error.toString())
  } finally {
    button.removeAttribute('disabled')
  }
}

document.getElementById('clear-button').addEventListener('click', clearHistory)

poll()
setInterval(poll, POLL_INTERVAL_MS)
