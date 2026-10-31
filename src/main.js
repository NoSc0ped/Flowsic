import './style.css'

const fileInput = document.querySelector('#file')
const player = document.querySelector('#player')

fileInput.addEventListener('change', () => {
	const file = fileInput.files[0]
	if (!file) return

	player.src = URL.createObjectURL(file)
	player.play()
})
