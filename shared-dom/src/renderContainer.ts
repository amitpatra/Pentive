import {
	body,
	clozeRegex,
	clozeTemplateRegex,
	html,
	renderTemplate,
	strip,
	standardReplacers,
	clozeReplacers,
	noteOrds,
	templateIndexes,
} from './cardHtml.js'

export const defaultRenderContainer = {
	standardReplacers,
	clozeReplacers,
	clozeRegex,
	clozeTemplateRegex,
	body,
	renderTemplate,
	html,
	strip,
	noteOrds,
	templateIndexes,
}

export const noteOrdsRenderContainer = {
	...defaultRenderContainer,
	strip: (x: string) => x,
}

export type RenderContainer = typeof defaultRenderContainer

export interface RenderPluginExports {
	services?: (c: RenderContainer) => Partial<RenderContainer>
}
