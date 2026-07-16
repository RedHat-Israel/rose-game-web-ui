class App {
  client = null
  controller = null
  rate = null
  context = null
  dashboard = null
  track = null
  obstacles = null
  cars = null
  finish_line = null
  infoUpdater = null

  ready () {
    // Start loading game images.
    document.querySelector('#left.player .name').textContent = 'Loading ...'

    this.controller = new Controller()
    this.rate = new Rate([0.5, 1.0, 2.0, 5.0, 10.0])
    const imageLoader = new ImageLoader(() => {
      this.client = new Client(this.onmessage.bind(this), 2000)

      // Finish loading game images.
      document.querySelector('#left.player .name').textContent = ''
    })

    this.context = document.querySelector('#game').getContext('2d')
    this.dashboard = new Dashboard()
    this.track = new Track(imageLoader)
    this.obstacles = new Obstacles(imageLoader)
    this.cars = new Cars(imageLoader)
    this.finish_line = new FinishLine(imageLoader)
    this.infoUpdater = new Information()
    this.sound = new Sound('assets/soundtrack/Nyan_Cat.ogg')
  }

  onmessage (m) {
    const msg = JSON.parse(m.data)
    if (msg.action !== 'update') {
      console.log(`Ignoring unknown message: ${m.data}`)
      return
    }

    const state = msg.payload

    // Update
    this.controller.update(state)
    this.rate.update(state)
    this.dashboard.update(state)
    this.track.update(state)
    this.obstacles.update(state)
    this.cars.update(state)
    this.finish_line.update(state)
    this.infoUpdater.update(state)

    // Draw
    this.dashboard.draw(this.context)
    this.track.draw(this.context)
    this.obstacles.draw(this.context)
    this.cars.draw(this.context)
    this.finish_line.draw(this.context)
  }
}

class Client {
  constructor (onmessage, reconnectMSec) {
    this.onmessage = onmessage
    this.reconnect_msec = reconnectMSec
    this.socket = null
    this.connect()
  }

  connect () {
    const wsuri = `ws://${window.location.host}/ws`
    console.log('Connecting to ' + wsuri)
    this.socket = new WebSocket(wsuri)
    this.socket.onopen = (e) => {
      console.log('Connected')
    }
    this.socket.onmessage = this.onmessage
    this.socket.onclose = this.onclose.bind(this)
  }

  onclose (e) {
    console.log(`Disconnected wasClean=${e.wasClean}, code=${e.code}, reason='${e.reason}')`)
    this.socket = null
    console.log(`Reconnecting in ${this.reconnect_msec} milliseconds`)
    setTimeout(this.connect.bind(this), this.reconnect_msec)
  }
}

class Controller {
  constructor () {
    this.initializeEvents()
  }

  initializeEvents () {
    document.querySelector('#run').addEventListener('click', event => {
      event.preventDefault()
      this.run()
    })

    document.querySelector('#stop').addEventListener('click', event => {
      event.preventDefault()
      this.stop()
    })

    document.querySelector('#reset').addEventListener('click', event => {
      event.preventDefault()
      this.reset()
    })

    document.getElementById('info-btn').addEventListener('click', function (e) {
      e.preventDefault() // Prevent default behavior of the anchor

      const infoPanel = document.getElementById('info-panel')

      if (infoPanel.classList.contains('hidden')) {
        infoPanel.classList.remove('hidden')
      } else {
        infoPanel.classList.add('hidden')
      }
    })
  }

  run () {
    this.disable()

    fetch('api/admin?running=1', { method: 'POST' })
      .then(() => {
        console.log('starting')
      })
      .catch((e) => {
        console.log(`Error starting: ${e.toString()}`)
      })
  }

  stop () {
    this.disable()

    fetch('api/admin?running=0', { method: 'POST' })
      .then(() => {
        console.log('stopping')
      })
      .catch((e) => {
        console.log(`Error stopping: ${e.toString()}`)
      })
  }

  reset () {
    this.disable()

    fetch('api/admin?reset=1', { method: 'POST' })
      .then(() => {
        console.log('reset')
      })
      .catch((e) => {
        console.log(`Error reset: ${e.toString()}`)
      })
  }

  update (state) {
    if (state.players.length === 0) {
      document.querySelector('#run').setAttribute('disabled', 'disabled')
      document.querySelector('#stop').setAttribute('disabled', 'disabled')
    } else if (state.started) {
      document.querySelector('#info').textContent = ('')
      document.querySelector('#run').setAttribute('disabled', 'disabled')
      document.querySelector('#stop').removeAttribute('disabled')
      document.querySelector('#reset').setAttribute('disabled', 'disabled')
    } else {
      document.querySelector('#info').textContent = ('')
      document.querySelector('#run').removeAttribute('disabled')
      document.querySelector('#stop').setAttribute('disabled', 'disabled')
      document.querySelector('#reset').removeAttribute('disabled')
    }

    if (state.timeleft === 0) {
      document.querySelector('#run').setAttribute('disabled', 'disabled')
    }
  }

  disable () {
    document.querySelector('#run').setAttribute('disabled', 'disabled')
    document.querySelector('#stop').setAttribute('disabled', 'disabled')
  }
}

class Rate {
  constructor (values) {
    this.values = values
    this.rate = null
    this.initializeEvents()
  }

  initializeEvents () {
    document.querySelector('#dec_rate').addEventListener('click', event => {
      event.preventDefault()
      this.decrease()
    })

    document.querySelector('#cur_rate').addEventListener('click', event => {
      event.preventDefault()
      this.post(1)
    })

    document.querySelector('#inc_rate').addEventListener('click', event => {
      event.preventDefault()
      this.increase()
    })
  }

  update (state) {
    this.rate = state.rate
    document.querySelector('#cur_rate').textContent = (state.rate + ' FPS')
    this.validate()
  }

  validate () {
    if (this.rate === this.values[0]) {
      document.querySelector('#dec_rate').setAttribute('disabled', 'disabled')
    } else {
      document.querySelector('#dec_rate').removeAttribute('disabled')
    }
    document.querySelector('#cur_rate').removeAttribute('disabled')
    if (this.rate === this.values[this.values.length - 1]) {
      document.querySelector('#inc_rate').setAttribute('disabled', 'disabled')
    } else {
      document.querySelector('#inc_rate').removeAttribute('disabled')
    }
  }

  disable () {
    document.querySelector('#rate_ctl button').setAttribute('disabled', 'disabled')
  }

  decrease () {
    for (let i = this.values.length - 1; i >= 0; i--) {
      if (this.values[i] < this.rate) {
        this.post(this.values[i])
        break
      }
    }
  }

  increase () {
    for (let i = 0; i < this.values.length; i++) {
      if (this.values[i] > this.rate) {
        this.post(this.values[i])
        break
      }
    }
  }

  post (value) {
    this.disable()

    fetch(`api/admin?rate=${value}`, { method: 'POST' })
      .then(() => {
        this.update({ rate: value })
      })
      .catch((e) => {
        this.validate()
        console.log('Error changing rate: ' + e.toString())
      })
  }
}

class Dashboard {
  players = null
  timeleft = null

  update (state) {
    this.players = state.players
    this.timeleft = state.timeleft
  }

  draw () {
    const text = this.timeleft < 10 ? `0${this.timeleft}` : this.timeleft.toString()
    document.querySelector('#time_left').textContent = text

    for (const player of this.players) {
      if (player.lane === 0) {
        document.querySelector('#left.player .name').textContent = player.name
        document.querySelector('#left.player .score').textContent = player.score
      }
      if (player.lane === 1) {
        document.querySelector('#right.player .name').textContent = player.name
        document.querySelector('#right.player .score').textContent = player.score
      }
    }
  }
}

class Obstacles {
  constructor (loader) {
    this.track = null
    this.textures = {}

    const obstacleNames = ['barrier', 'bike', 'crack', 'penguin', 'trash', 'water', 'fuel']

    obstacleNames.forEach(name => {
      loader.load(`assets/obstacles/${name}.png`, (img) => {
        this.textures[name] = img
      })
    })
  }

  update (state) {
    this.track = state.track
  }

  draw (ctx) {
    for (const obstacle of this.track) {
      const img = this.textures[obstacle.name]
      const x = Config.left_margin + obstacle.x * Config.cell_width
      const y = Config.top_margin + obstacle.y * Config.row_height
      ctx.drawImage(img, x, y)
    }
  }
}

class Cars {
  constructor (loader) {
    this.players = null
    this.textures = [null, null, null, null]

    for (let i = 0; i < 4; i++) {
      loader.load(`assets/cars/car${i + 1}.png`, (img) => {
        this.textures[i] = img
      })
    }
  }

  update (state) {
    this.players = state.players
  }

  draw (ctx) {
    ctx.fillStyle = 'rgb(0, 0, 0)'
    ctx.textBaseline = 'top'
    ctx.font = 'bold 15px sans-serif'
    ctx.textAlign = 'center'

    for (const player of this.players) {
      const img = this.textures[player.car]
      const x = Config.left_margin + player.x * Config.cell_width
      const y = player.y * Config.row_height

      ctx.drawImage(img, x, y)

      const carCenter = x + (img.width / 2)
      const carBottom = y + img.height

      ctx.fillText(player.name, carCenter, carBottom + 5)
    }
  }
}

class FinishLine {
  constructor (loader) {
    this.texture = null
    this.timeleft = null

    loader.load('assets/end/final_flag.png', (img) => {
      this.texture = img
    })
  }

  update (state) {
    this.timeleft = Math.max(state.timeleft, 0)
  }

  draw (ctx) {
    if (this.timeleft > Config.finish_line_duration) {
      return
    }

    // Start at row 0, then move down until row finish_line_duration
    const row = Config.finish_line_duration - this.timeleft
    const y = Config.row_height * row

    ctx.drawImage(this.texture, 0, y)
  }
}

class Track {
  constructor (loader) {
    this.track = null
    this.textures = [null, null, null]

    loader.load('assets/bg/bg_1.png', (img) => {
      this.textures[0] = img
    })
    loader.load('assets/bg/bg_2.png', (img) => {
      this.textures[1] = img
    })
    loader.load('assets/bg/bg_3.png', (img) => {
      this.textures[2] = img
    })
  }

  update (state) {
    this.track = state.track
    if (state.started) {
      // Simulate track movement
      const last = this.textures.pop()
      this.textures.unshift(last)
    }
  }

  draw (ctx) {
    for (let i = 0; i < Config.track_length; i++) {
      const img = this.textures[i % this.textures.length]
      ctx.drawImage(img, 0, i * img.height)
    }
  }
}

class Information {
  constructor () {
    this.infoElement = document.getElementById('info-text')
  }

  update (state) {
    if (!state.players) {
      return
    }

    let infoText = ''

    if (state.players.length === 0) {
      infoText += 'No players connected.<br/>'
    }

    state.players.forEach(player => {
      const formattedResponseTime = (player.response_time * 1000.0).toFixed(2)

      infoText += `Name: ${player.name}<br/>`
      infoText += `Response time: ${formattedResponseTime}ms<br/>`

      // Check if error is not empty and conditionally apply the CSS class
      if (player.error && player.error.trim() !== '') {
        infoText += `Response err: <span class="error-text">${player.error}</span><br/>`
      } else {
        infoText += `Response err: ${player.error}<br/>`
      }

      infoText += '<br/>'
      infoText += `Pinguins: ${player.pickups}<br/>`
      infoText += `Breaks: ${player.breaks}<br/>`
      infoText += `Jumps: ${player.jumps}<br/>`
      infoText += '<br/>'
      infoText += `Missed: ${player.misses}<br/>`
      infoText += `Crashes: ${player.hits}<br/>`
      infoText += `Collisions: ${player.collisions}<br/>`

      infoText += '<br/><br/>'
    })

    this.infoElement.innerHTML = infoText
  }
}

class ImageLoader {
  constructor (done) {
    this.loading = 0
    this.done = done
  }

  load (url, done) {
    const img = new Image()
    this.loading++
    img.onload = () => {
      done(img)
      this.loading--
      if (this.loading === 0) {
        this.done()
      }
    }
    img.src = url
  }
}

class Sound {
  constructor (filePath) {
    this.audio = new Audio()
    this.audio.src = filePath
    this.playing = false

    document.querySelector('#music_ctl').addEventListener('click', event => {
      event.preventDefault()
      if (this.playing) {
        this.pause()
        event.target.textContent = 'Music'
      } else {
        this.play()
        event.target.textContent = 'Mute'
      }
      this.playing = !this.playing
    })
  }

  play () {
    this.audio.play()
  }

  pause () {
    this.audio.pause()
  }
}

const Config = {
  left_margin: 95,
  cell_width: 130,
  top_margin: 10,
  row_height: 65,
  track_length: 9,
  finish_line_duration: 5
}

export const ROSE = new App()

;/* === Fuel side gauges v3 (thick, both sides) === */
(function () {
  if (typeof Dashboard === 'undefined') return
  const MAX = 60

  function gauge (side) {
    let el = document.getElementById('fuel-' + side)
    if (!el) {
      el = document.createElement('div')
      el.id = 'fuel-' + side
      el.className = 'fuel-side ' + side
      el.innerHTML = '<div>⛽</div><div class="track"><div class="fill"></div></div><div class="num">–</div>'
      document.body.appendChild(el)
    }
    return el
  }
  function setGauge (side, fuel) {
    const el = gauge(side)
    const has = (fuel !== null && fuel !== undefined)
    const pct = has ? Math.max(0, Math.min(100, fuel / MAX * 100)) : 0
    const fill = el.querySelector('.fill')
    fill.style.height = pct + '%'
    fill.className = 'fill ' + (pct > 50 ? 'ok' : (pct > 20 ? 'warn' : 'low'))
    el.querySelector('.num').textContent = has ? String(fuel) : '–'
  }

  const orig = Dashboard.prototype.draw
  Dashboard.prototype.draw = function () {
    orig.call(this)
    let left = null; let right = null
    if (this.players) {
      for (let i = 0; i < this.players.length; i++) {
        const p = this.players[i]
        if (p.lane === 0) left = p.fuel
        if (p.lane === 1) right = p.fuel
      }
    }
    setGauge('left', left)
    setGauge('right', right)
  }
})()
;/* === Fuel-out OUT overlay + Game Over score countup === */
(function () {
  if (typeof App === 'undefined') return
  if (App.prototype.__gameoverPatched) return
  App.prototype.__gameoverPatched = true

  const COUNTUP_MS = 3500
  const HOLD_MS = 1500

  let go = null
  let wasGameover = false

  function carRect (app, player) {
    const img = app.cars && app.cars.textures ? app.cars.textures[player.car] : null
    const w = (img && img.width) ? img.width : 90
    const h = (img && img.height) ? img.height : 130
    const x = Config.left_margin + player.x * Config.cell_width
    const y = player.y * Config.row_height
    return { x, y, w, h: h + 24 }
  }

  function drawOutOverlay (ctx, app, players) {
    if (!ctx) return
    players.forEach(function (p) {
      if (p.fuel === null || p.fuel === undefined || p.fuel > 0) return
      const r = carRect(app, p)
      ctx.save()
      ctx.fillStyle = 'rgba(10,10,10,0.88)'
      ctx.fillRect(r.x, r.y, r.w, r.h)
      ctx.strokeStyle = '#ff3b30'
      ctx.lineWidth = 3
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ff3b30'
      ctx.font = 'bold ' + Math.max(16, Math.round(r.w * 0.28)) + 'px sans-serif'
      ctx.fillText('OUT', r.x + r.w / 2, r.y + r.h / 2)
      ctx.restore()
    })
  }

  function drawGameOverAnim (ctx, elapsed) {
    if (!ctx || !go) return
    const w = ctx.canvas.width
    const h = ctx.canvas.height
    const t = Math.min(1, elapsed / COUNTUP_MS)
    const eased = 1 - Math.pow(1 - t, 3)

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.80)'
    ctx.fillRect(0, 0, w, h)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold ' + Math.round(h * 0.09) + 'px sans-serif'
    ctx.fillText('GAME OVER', w / 2, h * 0.2)

    const players = go.players
    const maxScore = Math.max.apply(null, players.map(function (p) { return p.score })) || 1
    const cols = players.length

    players.forEach(function (p, i) {
      const cx = w * (i + 1) / (cols + 1)
      const barW = Math.min(90, w * 0.12)
      const barH = h * 0.32
      const bx = cx - barW / 2
      const by = h * 0.42

      ctx.strokeStyle = 'rgba(255,255,255,0.55)'
      ctx.lineWidth = 2
      ctx.strokeRect(bx, by, barW, barH)

      const fillH = barH * Math.max(0, Math.min(1, (p.score * eased) / maxScore))
      ctx.fillStyle = '#3ac06a'
      ctx.fillRect(bx, by + (barH - fillH), barW, fillH)

      ctx.fillStyle = '#9fd3ff'
      ctx.font = 'bold ' + Math.round(h * 0.04) + 'px sans-serif'
      ctx.fillText(p.name || ('Player ' + (i + 1)), cx, by - h * 0.05)

      ctx.fillStyle = '#ffcc33'
      ctx.font = 'bold ' + Math.round(h * 0.055) + 'px sans-serif'
      ctx.fillText(String(Math.round(p.score * eased)), cx, by + barH + h * 0.06)
    })

    if (elapsed >= COUNTUP_MS) {
      const winner = players.slice().sort(function (a, b) { return b.score - a.score })[0]
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold ' + Math.round(h * 0.06) + 'px sans-serif'
      ctx.fillText((winner ? winner.name : '') + ' won', w / 2, h * 0.88)
    }

    ctx.restore()
  }

  function rafStep (ts) {
    if (!go) return
    if (go.startTs === null) go.startTs = ts
    if (go.app && go.app.context) {
      drawGameOverAnim(go.app.context, ts - go.startTs)
    }
    if (ts - go.startTs < COUNTUP_MS + HOLD_MS) {
      requestAnimationFrame(rafStep)
    }
  }

  const orig = App.prototype.onmessage
  App.prototype.onmessage = function (m) {
    orig.call(this, m)

    let msg
    try { msg = JSON.parse(m.data) } catch (e) { return }
    if (msg.action !== 'update') return
    const state = msg.payload
    if (!state) return

    if (state.gameover) {
      if (!wasGameover) {
        go = {
          startTs: null,
          app: this,
          players: (state.players || []).map(function (p) {
            return { name: p.name, lane: p.lane, score: p.score }
          })
        }
        requestAnimationFrame(rafStep)
      }
      wasGameover = true
      if (go && go.startTs !== null) {
        drawGameOverAnim(this.context, performance.now() - go.startTs)
      }
    } else {
      wasGameover = false
      go = null
      drawOutOverlay(this.context, this, state.players || [])
    }
  }
})()
