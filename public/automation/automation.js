const POLL_INTERVAL_MS = 1000

function escapeHtml (value) {
  const div = document.createElement('div')
  div.textContent = String(value)
  return div.innerHTML
}

function setStatus (text) {
  const statusEl = document.getElementById('status-message')
  if (!text) {
    statusEl.classList.add('hidden')
    statusEl.textContent = ''
    return
  }
  statusEl.classList.remove('hidden')
  statusEl.textContent = text
}

function displayError (message) {
  document.getElementById('error-message').textContent = message
}

function renderResults (stats) {
  const resultsBody = document.getElementById('results-body')
  resultsBody.innerHTML = Object.entries(stats.results).map(([name, r]) => `
    <tr>
      <td>${escapeHtml(name)}</td>
      <td>${r.wins}</td>
      <td>${r.losses}</td>
      <td>${r.ties}</td>
      <td>${r.avg_score}</td>
    </tr>
  `).join('')

  const perGameBody = document.getElementById('per-game-body')
  perGameBody.innerHTML = stats.per_game.map((game, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(game.winner ?? 'Tie')}</td>
      <td>${Object.entries(game.scores).map(([name, score]) => `${escapeHtml(name)}: ${score}`).join(', ')}</td>
    </tr>
  `).join('')

  document.getElementById('results-section').classList.remove('hidden')
}

async function pollJob (jobId) {
  let job = null

  do {
    const response = await fetch(`/api/simulate/${jobId}`)
    if (!response.ok) {
      throw new Error(`Job status request failed: ${response.status}`)
    }
    job = await response.json()

    if (job.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  } while (job.status === 'running')

  if (job.status === 'error') {
    throw new Error(job.error || 'Simulation failed')
  }

  return job.result
}

async function runBatch (event) {
  event.preventDefault()
  displayError('')
  setStatus('')
  document.getElementById('results-section').classList.add('hidden')

  const driver1 = document.getElementById('driver1').value.trim()
  const driver2 = document.getElementById('driver2').value.trim()
  const games = parseInt(document.getElementById('games').value, 10)
  const track = document.getElementById('track').value

  if (!driver1 || !driver2) {
    displayError('Both driver URLs are required.')
    return
  }

  if (!Number.isInteger(games) || games < 1) {
    displayError('Games must be a positive number.')
    return
  }

  const runButton = document.getElementById('run-button')
  runButton.setAttribute('disabled', 'disabled')
  setStatus('Starting batch simulation...')

  try {
    const startResponse = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drivers: [driver1, driver2], games, track })
    })

    if (!startResponse.ok) {
      throw new Error(await startResponse.text())
    }

    const { job_id: jobId } = await startResponse.json()

    setStatus(`Running ${games} games...`)
    const result = await pollJob(jobId)

    setStatus(`Done: ${games} games simulated.`)
    renderResults(result)
  } catch (error) {
    displayError('Error running batch simulation: ' + error.toString())
    setStatus('')
  } finally {
    runButton.removeAttribute('disabled')
  }
}

document.getElementById('automation-form').addEventListener('submit', runBatch)
