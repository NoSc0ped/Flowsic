import './style.css'
import { parseBlob } from 'music-metadata'

const fileInput = document.querySelector('#file')
const player = document.querySelector('#player')
const playToggle = document.querySelector('#play-toggle')
const playIcon = document.querySelector('#play-icon')
const seek = document.querySelector('#seek')
const currentTime = document.querySelector('#current-time')
const duration = document.querySelector('#duration')
const volume = document.querySelector('#volume')
let audioUrl
let audioContext
let analyser
let audioSamples
let pulseFrame = 0
let pulseLevel = 0
let coverRequest = 0

const clearCoverColors = () => {
	document.documentElement.style.removeProperty('--left-light')
	document.documentElement.style.removeProperty('--right-light')
}

const averageColor = (pixels, width, height, startX, endX) => {
	const vivid = [0, 0, 0]
	const fallback = [0, 0, 0]
	let vividCount = 0
	let fallbackCount = 0

	for (let y = 0; y < height; y++) {
		for (let x = startX; x < endX; x++) {
			const offset = (y * width + x) * 4
			if (pixels[offset + 3] < 180) continue

			const red = pixels[offset]
			const green = pixels[offset + 1]
			const blue = pixels[offset + 2]
			fallback[0] += red
			fallback[1] += green
			fallback[2] += blue
			fallbackCount++

			const brightest = Math.max(red, green, blue)
			const darkest = Math.min(red, green, blue)
			if (brightest > 36 && brightest - darkest > 18) {
				vivid[0] += red
				vivid[1] += green
				vivid[2] += blue
				vividCount++
			}
		}
	}

	const color = vividCount ? vivid : fallback
	const count = vividCount || fallbackCount || 1
	const average = color.map((channel) => channel / count)
	const midpoint = (Math.max(...average) + Math.min(...average)) / 2
	return average
		.map((channel) => Math.round(Math.max(0, Math.min(255, midpoint + (channel - midpoint) * 1.3))))
		.join(', ')
}

const updateCoverColors = async (file, requestId) => {
	try {
		const metadata = await parseBlob(file)
		const picture = metadata.common.picture?.[0]
		if (!picture || requestId !== coverRequest) return

		const image = await createImageBitmap(new Blob([picture.data], { type: picture.format }))
		const canvas = document.createElement('canvas')
		canvas.width = 48
		canvas.height = 48
		const context = canvas.getContext('2d', { willReadFrequently: true })
		if (!context) {
			image.close()
			return
		}

		context.drawImage(image, 0, 0, canvas.width, canvas.height)
		image.close()
		const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
		const root = document.documentElement
		if (requestId !== coverRequest) return

		root.style.setProperty('--left-light', averageColor(pixels, 48, 48, 0, 24))
		root.style.setProperty('--right-light', averageColor(pixels, 48, 48, 24, 48))
	} catch {
		if (requestId === coverRequest) clearCoverColors()
	}
}

const setupAudioAnalysis = () => {
	if (analyser) return

	const AudioContextClass = window.AudioContext || window.webkitAudioContext
	if (!AudioContextClass) return

	audioContext = new AudioContextClass()
	analyser = audioContext.createAnalyser()
	analyser.fftSize = 256
	const source = audioContext.createMediaElementSource(player)
	source.connect(analyser)
	analyser.connect(audioContext.destination)
	audioSamples = new Uint8Array(analyser.fftSize)
}

const startPlayback = async () => {
	setupAudioAnalysis()
	if (audioContext?.state === 'suspended') await audioContext.resume()
	await player.play()
}

const animatePulse = () => {
	if (!analyser || player.paused) return

	analyser.getByteTimeDomainData(audioSamples)
	let energy = 0
	let peak = 0
	for (const sample of audioSamples) {
		const amplitude = (sample - 128) / 128
		energy += amplitude * amplitude
		peak = Math.max(peak, Math.abs(amplitude))
	}

	const rms = Math.sqrt(energy / audioSamples.length)
	const response = Math.max(rms * 1.25, peak * 0.28)
	const target = Math.min(1, Math.max(0, (response - 0.008) * 3.2 * player.volume))
	pulseLevel += (target - pulseLevel) * (target > pulseLevel ? 0.58 : 0.1)
	document.documentElement.style.setProperty('--pulse', pulseLevel.toFixed(3))
	pulseFrame = requestAnimationFrame(animatePulse)
}

const stopPulse = () => {
	if (pulseFrame) cancelAnimationFrame(pulseFrame)
	pulseFrame = 0
	pulseLevel = 0
	document.documentElement.style.setProperty('--pulse', '0')
}

const formatTime = (time) => {
	if (!Number.isFinite(time)) return '0:00'
	const minutes = Math.floor(time / 60)
	const seconds = Math.floor(time % 60).toString().padStart(2, '0')
	return `${minutes}:${seconds}`
}

const updatePlayButton = () => {
	const isPlaying = !player.paused
	playToggle.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play')
	playIcon.innerHTML = isPlaying ? '&#10074;&#10074;' : '&#9654;'
}

fileInput.addEventListener('change', () => {
	const file = fileInput.files[0]
	if (!file) return

	if (audioUrl) URL.revokeObjectURL(audioUrl)
	audioUrl = URL.createObjectURL(file)
	player.src = audioUrl
	clearCoverColors()
	updateCoverColors(file, ++coverRequest)
	playToggle.disabled = false
	seek.disabled = false
	startPlayback().catch(updatePlayButton)
})

playToggle.addEventListener('click', () => {
	if (player.paused) startPlayback().catch(updatePlayButton)
	else player.pause()
})

player.addEventListener('play', () => {
	updatePlayButton()
	if (!pulseFrame) animatePulse()
})
player.addEventListener('pause', () => {
	updatePlayButton()
	stopPulse()
})
player.addEventListener('ended', () => {
	updatePlayButton()
	stopPulse()
})
player.addEventListener('loadedmetadata', () => {
	seek.max = player.duration
	duration.textContent = formatTime(player.duration)
})
player.addEventListener('timeupdate', () => {
	seek.value = player.currentTime
	currentTime.textContent = formatTime(player.currentTime)
	seek.style.setProperty('--fill', `${(player.currentTime / player.duration) * 100}%`)
})

seek.addEventListener('input', () => {
	player.currentTime = Number(seek.value)
})

volume.addEventListener('input', () => {
	player.volume = Number(volume.value)
	volume.style.setProperty('--fill', `${volume.value * 100}%`)
})

player.volume = Number(volume.value)
volume.style.setProperty('--fill', `${volume.value * 100}%`)
