import './style.css'

const fileInput = document.querySelector('#file')
const player = document.querySelector('#player')
const trackName = document.querySelector('#track-name')
let currentObjectUrl

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (!file) return

  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl)

  currentObjectUrl = URL.createObjectURL(file)
  trackName.textContent = file.name
  player.src = currentObjectUrl
  player.hidden = false
  player.load()
})

window.addEventListener('pagehide', () => {
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl)
})
