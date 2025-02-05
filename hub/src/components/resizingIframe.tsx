import { iframeResizer, type IFrameComponent } from 'iframe-resizer'
import { createEffect, onCleanup, type VoidComponent } from 'solid-js'
import * as Comlink from 'comlink'
import { type Side, type Template, type Card, type Note } from 'shared'
import { unwrap } from 'solid-js/store'

const targetOrigin = '*' // highTODO make more limiting. Also implement https://stackoverflow.com/q/8169582

// this intentionally takes the client's Card/Note/Template - hub previews should be the same as the client's
export type RenderBodyInput =
	| {
			readonly tag: 'template'
			readonly side: Side
			readonly template: Template
			readonly index: number
	  }
	| {
			readonly tag: 'card'
			readonly side: Side
			readonly card: Card
			readonly note: Note
			readonly template: Template
	  }

export interface HubExpose {
	renderBodyInput: RenderBodyInput
	resize: () => void
}

const ResizingIframe: VoidComponent<{
	readonly i: RenderBodyInput
}> = (props) => {
	createEffect(() => {
		try {
			iframeReference.contentWindow!.postMessage(
				{ type: 'pleaseRerender', i: unwrap(props.i) },
				targetOrigin,
			)
		} catch (error) {
			console.error(error)
		}
	})
	let iframeReference: HTMLIFrameElement
	onCleanup(() => {
		;(iframeReference as IFrameComponent)?.iFrameResizer?.close()
	})
	return (
		<iframe
			class='w-full'
			ref={(x) => (iframeReference = x)}
			onLoad={(e) => {
				Comlink.expose(
					{
						renderBodyInput: unwrap(props.i),
						resize: () => {
							;(iframeReference as IFrameComponent)?.iFrameResizer?.resize()
						},
					},
					Comlink.windowEndpoint(
						e.currentTarget.contentWindow!,
						self,
						targetOrigin,
					),
				)
				iframeResizer(
					{
						// log: true,

						// If perf becomes an issue consider debouncing https://github.com/davidjbradshaw/iframe-resizer/issues/816

						checkOrigin: [import.meta.env.VITE_HUB_UGC_ORIGIN],
						heightCalculationMethod: 'max',
					},
					e.currentTarget,
				)
			}}
			sandbox='allow-scripts allow-same-origin' // Changing this has security ramifications! https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox
			// "When the embedded document has the same origin as the embedding page, it is strongly discouraged to use both allow-scripts and allow-same-origin"
			// Since this iframe is hosted on `hub-user-generated-content` and this component is hosted on `hub`, resulting in different origins, we should be safe. https://web.dev/sandboxed-iframes/ https://stackoverflow.com/q/35208161
			src={import.meta.env.VITE_HUB_UGC_ORIGIN}
		/>
	)
}

export default ResizingIframe
