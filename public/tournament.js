const STORAGE_KEY = 'tournament'

export class Tournament {
  // Must match .t-match { min-height } and #t-bracket { gap } in tournament/index.css
  static matchHeight = 76
  static matchPitch = 100

  constructor () {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    this.entrants = saved.entrants || []
    this.rounds = saved.rounds || []
    this.heat = saved.heat || null // 'pending' | 'live' | null
    this.status = saved.status || 'Add at least 2 drivers'
    this.resolveByes()

    // Next button of the heat result box on the game page: only a match win
    // (best-of-3 decided) shows the bracket - a plain heat win goes straight
    // into the decider heat, staying on the game page.
    const resume = document.querySelector('#t-continue')
    if (resume) {
      resume.addEventListener('click', () => {
        if (this.matchDecided) {
          window.location.href = '/tournament/index.html'
        } else {
          this.next()
        }
      })
    }
  }

  save () {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this))
  }

  // Build the whole bracket up front: round 0 pairs the entrants, every later
  // round starts as empty (TBD) match slots that winners advance into.
  buildBracket () {
    const round0 = []
    for (let i = 0; i < this.entrants.length; i += 2) {
      round0.push({ a: this.entrants[i], b: this.entrants[i + 1] || null, wins: [0, 0], winner: null })
    }
    this.rounds = [round0]
    while (this.rounds[this.rounds.length - 1].length > 1) {
      const count = Math.ceil(this.rounds[this.rounds.length - 1].length / 2)
      this.rounds.push(Array.from({ length: count }, () => ({ a: null, b: null, wins: [0, 0], winner: null })))
    }

    this.resolveByes()
  }

  // A player whose opponent slot has no feeder can never be challenged:
  // advance them automatically. Also repairs saved brackets on load.
  resolveByes () {
    this.rounds.forEach((round, r) => {
      round.forEach((match, i) => {
        const noFeederForB = r === 0 ? !match.b : 2 * i + 1 >= this.rounds[r - 1].length
        if (match.a && !match.b && noFeederForB && !match.winner) {
          match.winner = match.a
          this.advance(r, i)
        }
      })
    })
  }

  // Feed a decided match's winner into its parent slot in the next round.
  advance (r, i) {
    const next = this.rounds[r + 1]
    if (!next) {
      return
    }
    const parent = next[Math.floor(i / 2)]
    parent[i % 2 === 0 ? 'a' : 'b'] = this.rounds[r][i].winner

    // No sibling feeder means the parent can never get an opponent: cascade
    if (i % 2 === 0 && i + 1 >= this.rounds[r].length) {
      parent.winner = parent.a
      this.advance(r + 1, Math.floor(i / 2))
    }
  }

  advanceWinner (match) {
    this.rounds.forEach((round, r) => {
      const i = round.indexOf(match)
      if (i >= 0) {
        this.advance(r, i)
      }
    })
  }

  currentMatch () {
    for (const round of this.rounds) {
      const match = round.find(m => m.a && m.b && !m.winner)
      if (match) {
        return match
      }
    }
    return null
  }

  // Game page: watch the running heat via websocket state updates

  update (state) {
    if (this.heat === 'pending' && !state.started) {
      // The engine may still be resetting after the drivers POST, retry running=1
      if (state.timeleft > 0 && state.players.every(player => player.score === 0)) {
        fetch('/api/admin?running=1', { method: 'POST' })
      }
      return
    }
    if (this.heat === 'pending' && state.started) {
      this.heat = 'live'
      const match = this.currentMatch()
      state.players.forEach(player => {
        const entrant = player.lane === 0 ? match.a : match.b
        entrant.name = player.name
      })
      this.save()
    }
    if (this.heat !== 'live' || state.started || state.timeleft > 0) {
      return
    }
    this.heat = null
    const match = this.currentMatch()
    this.finishHeat(match, state.players)
    this.matchDecided = !!match.winner
    this.save()

    document.querySelector('#t-text').textContent = this.status
    document.querySelector('#t-result').classList.remove('hidden')
  }

  finishHeat (match, players) {
    const scores = [0, 0]
    players.forEach(player => {
      scores[player.lane] = player.score
    })

    const tally = () => `Match ${match.wins[0]} : ${match.wins[1]}`

    if (scores[0] === scores[1]) {
      this.status = `Tie ${scores[0]}:${scores[1]} — Next replays the heat (${tally()})`
      return
    }

    const winnerIndex = scores[0] > scores[1] ? 0 : 1
    const winner = winnerIndex === 0 ? match.a : match.b
    match.wins[winnerIndex]++

    if (match.wins[winnerIndex] === 2) {
      match.winner = winner
      this.advanceWinner(match)
      this.status = `${winner.name} wins the match! (${tally()})`
    } else {
      this.status = `${winner.name} wins the heat ${scores[0]}:${scores[1]} — ${tally()}`
    }
  }

  // Tournament page

  bind () {
    document.querySelector('#t-add').addEventListener('click', () => this.addDriver())
    document.querySelector('#t-next').addEventListener('click', () => this.next())
    document.querySelector('#t-new').addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY)
      window.location.reload()
    })
    if (this.heat) {
      this.status = 'Race in progress — click Next to return to it'
    }
    this.render()
  }

  async addDriver () {
    const input = document.querySelector('#t-url')
    const url = input.value.trim()
    if (!url || this.rounds.length > 0) {
      return
    }
    input.value = ''

    let name = url
    try {
      name = (await (await fetch(url)).json()).info.name
    } catch (e) {
      this.status = `Cannot reach ${url}, added anyway`
    }

    this.entrants.push({ name, url })
    this.status = `${this.entrants.length} drivers added`
    this.save()
    this.render()
  }

  next () {
    if (this.heat) {
      // Left mid-heat: only the game page can watch it finish, so head back there
      if (document.querySelector('#t-bracket')) {
        window.location.href = '/index.html'
      }
      return
    }

    if (this.rounds.length === 0) {
      if (this.entrants.length < 2) {
        this.status = 'Need at least 2 drivers'
        this.render()
        return
      }
      this.buildBracket()
      this.status = 'Bracket ready — Next starts the first race'
    } else if (this.currentMatch()) {
      this.startHeat(this.currentMatch())
      return
    } else {
      // Tournament finished; render() shows the champion.
      this.render()
      return
    }
    this.save()
    this.render()
  }

  async startHeat (match) {
    this.heat = 'pending'
    this.status = `Racing: ${match.a.name} vs ${match.b.name}`
    this.save()
    // Sets reset=1 in the engine, running=1 is sent by update() on the game page
    await fetch(`/api/admin?drivers=${match.a.url},${match.b.url}`, { method: 'POST' })
    window.location.href = '/index.html'
  }

  render () {
    // The match in focus (being played, or up next), highlighted below.
    const upcoming = this.currentMatch()
    if (this.rounds.length && !upcoming) {
      const champion = this.rounds[this.rounds.length - 1][0].winner
      if (champion) {
        this.status = `🏆 Champion: ${champion.name}`
      }
    }

    document.querySelector('#t-status').textContent = this.status
    document.querySelector('#t-setup').classList.toggle('hidden', this.rounds.length > 0)

    const player = (match, entrant) => {
      if (!entrant) {
        return '<div class="t-player t-tbd"></div>' // slot a future winner fills
      }
      // Compare by URL, object identity does not survive the localStorage round trip
      const won = match.winner && match.winner.url === entrant.url ? ' t-winner' : ''
      return `<div class="t-player${won}">${entrant.name}</div>`
    }

    const score = match => {
      if (match.a && !match.b && match.winner) {
        return 'BYE'
      }
      return match.a || match.b ? `${match.wins[0]} : ${match.wins[1]}` : ''
    }

    const box = (match, style = '') =>
      `<div class="t-match${match === upcoming ? ' t-next' : ''}" style="${style}">` +
      `<div class="t-score">${score(match)}</div>` +
      `${player(match, match.a)}${player(match, match.b)}</div>`

    const column = (cls, label, inner) =>
      `<div class="t-round ${cls}"><h3>${label}</h3><div class="t-col">${inner}</div></div>`

    // Vertical rhythm: sibling matches feeding the same next-round match are
    // spaced (and connected, see CSS) so their midpoint lands on its center.
    const wired = (matches, round) => {
      const pitch = Tournament.matchPitch * 2 ** round
      return matches.map((match, i) => {
        const marginTop = i === 0 ? (pitch - Tournament.matchHeight) / 2 : pitch - Tournament.matchHeight
        let trunk = ''
        if (i % 2 === 0 && matches[i + 1]) {
          trunk = `--trunk:${pitch}px;` // join the pair
        } else if (i % 2 === 0 && round < this.rounds.length - 2) {
          trunk = `--trunk:${pitch / 2}px;` // lone match: drop to its next-round slot
        }
        return box(match, `margin-top:${marginTop}px;${trunk}`)
      }).join('')
    }

    if (this.rounds.length === 0) {
      if (!this.entrants.length) {
        document.querySelector('#t-bracket').innerHTML = ''
        return
      }
      const boxes = this.entrants.map(e => `<div class="t-match"><div class="t-player">${e.name}</div></div>`)
      document.querySelector('#t-bracket').innerHTML = column('t-simple', 'Drivers', boxes.join(''))
      return
    }

    // Mirror layout around the final: each side is one subtree, so a match
    // and its feeders always share a side. left[r] = feeders of left[r+1].
    const left = []
    left[this.rounds.length - 2] = 1
    for (let r = this.rounds.length - 3; r >= 0; r--) {
      left[r] = Math.min(this.rounds[r].length, 2 * left[r + 1])
    }
    const halves = this.rounds.slice(0, -1).map((matches, r) => [matches.slice(0, left[r]), matches.slice(left[r])])

    const final = this.rounds[this.rounds.length - 1][0]
    let inner = box(final)
    if (final.winner) {
      inner += `<div class="t-match t-champion">🏆 ${final.winner.name}</div>`
    }
    const middle = column(`t-final t-simple${halves.length ? '' : ' t-solo'}`, 'Final', inner)

    const side = (index, edge) => halves
      .map((matches, round) => ({ matches: matches[index], round }))
      .filter(c => c.matches.length)
      .map(c => column(`t-r${c.round} ${edge}`, `Round ${c.round + 1}`, wired(c.matches, c.round)))

    const columns = [...side(0, 't-l'), middle, ...side(1, 't-r').reverse()]
    document.querySelector('#t-bracket').innerHTML = columns.join('')

    if (halves.length) {
      this.centerFinal(halves.length - 1)
    }
  }

  // The wired columns center themselves against each other via margin math,
  // but the final match has no sibling to pair with in its own column - so
  // once laid out, nudge it to the midpoint of its two semifinals instead.
  centerFinal (deepestRound) {
    const leftSemi = document.querySelector(`.t-r${deepestRound}.t-l .t-match`)
    const rightSemi = document.querySelector(`.t-r${deepestRound}.t-r .t-match`)
    const finalMatch = document.querySelector('.t-final .t-match:not(.t-champion)')
    const centerY = el => el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2

    finalMatch.style.marginTop = `${(centerY(leftSemi) + centerY(rightSemi)) / 2 - centerY(finalMatch)}px`
  }
}
