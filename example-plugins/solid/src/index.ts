import { customElement } from "solid-element"
import type { Container, PluginExports } from "../../../app/src/services"
import { Nav } from "./nav"

function clozeTemplateRegex(c: Container): RegExp {
  return new RegExp(
    c.clozeTemplateRegex.source.replace("cloze:", "(?:edit:)?cloze:"),
    c.clozeTemplateRegex.flags
  )
}

const services = (c: Container): Partial<Container> => {
  return {
    clozeTemplateRegex: clozeTemplateRegex(c),
    standardReplacers: new Map(c.standardReplacers).set(
      "editFieldReplacer",
      ({ initialValue, isFront, card, note, template }) => {
        let r = initialValue
        note.fieldValues.forEach((value, fieldName) => {
          r = r.replace(new RegExp(`{{(?:edit:)?${fieldName}}}`), value)
        })
        return r
      }
    ),
    clozeReplacers: new Map(c.clozeReplacers).set(
      "editFieldReplacer",
      ({ initialValue, isFront, card, note, template }) => {
        let r = initialValue
        note.fieldValues.forEach((value, fieldName) => {
          r = r.replace(new RegExp(`{{(?:edit:)?${fieldName}}}`), value)
        })
        return r
      }
    ),
  }
}

const exports: PluginExports = {
  services,
  customElements: {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "pentive-nav": () => {
      customElement("pentive-nav", { navLinks: [] }, Nav)
    },
  },
}

export default exports