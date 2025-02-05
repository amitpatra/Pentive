import contentWindowJs from 'iframe-resizer/js/iframeResizer.contentWindow.js?raw' // https://vitejs.dev/guide/assets.html#importing-asset-as-string https://github.com/davidjbradshaw/iframe-resizer/issues/513
import { appMessenger, setAppMessengerPort } from './appMessenger'
import {
	type ComlinkInit,
	type RenderBodyInput,
} from 'app/src/components/resizingIframe'
import { assertNever } from 'shared'
import { resizeIframe } from './registerServiceWorker'
import diff from 'micromorph'

self.addEventListener('message', async (event) => {
	const data = event.data as unknown
	if (typeof data === 'object' && data != null && 'type' in data) {
		if (data.type === 'pleaseRerender') {
			// @ts-expect-error i exists; grep pleaseRerender
			const i = data.i as RenderBodyInput
			await setBody(i)
			await resizeIframe()
		} else if (data?.type === 'ComlinkInit') {
			setAppMessengerPort((data as ComlinkInit).port)
		}
	}
})

const domParser = new DOMParser()

export async function setBody(i: RenderBodyInput) {
	const { body, css } = await buildHtml(i)

	await diff(document, domParser.parseFromString(body, 'text/html'))
	const resizeScript = document.createElement('script')
	resizeScript.type = 'text/javascript'
	resizeScript.text = contentWindowJs
	document.head.appendChild(resizeScript)
	if (css != null) {
		const style = document.createElement('style')
		style.textContent = css
		document.head.appendChild(style)
	}
}

async function buildHtml(i: RenderBodyInput) {
	switch (i.tag) {
		case 'template': {
			const template = i.template
			const result = (await appMessenger.renderTemplate(template))[i.index]
			if (result == null) {
				return {
					body: `Error rendering Template #${i.index}".`,
					css: template.css,
				}
			} else {
				return {
					body: i.side === 'front' ? result[0] : result[1],
					css: template.css,
				}
			}
		}
		case 'card': {
			const frontBack = await appMessenger.html(i.card, i.note, i.template)
			if (frontBack == null) {
				return { body: 'Card is invalid!' }
			}
			const body = i.side === 'front' ? frontBack[0] : frontBack[1]
			return { body }
		}
		case 'raw': {
			return { body: i.html, css: i.css }
		}
		default:
			return assertNever(i)
	}
}
