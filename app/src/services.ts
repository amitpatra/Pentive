import { defaultRenderContainer } from "shared-dom"
import type { PentiveElement } from "./customElements/registry"

// the dependency injection container
export const defaultContainer = {
  ...defaultRenderContainer,
  // todo - add other (non-render) services
}

export type Container = typeof defaultContainer

export interface PluginExports {
  services?: (c: Container) => Partial<Container>
  customElements?: Record<PentiveElement, () => void> // highTODO is this really the best name you can come up with
}
