import _ from "lodash"
import { ChildTemplateId, ClozeIndex } from "./ids"
import { Field, Template } from "./template"
import { strip, throwExp } from "./utility"

// These have hidden state - don't use `match` or `exec`!
// https://www.tsmean.com/articles/regex/javascript-regex-match-vs-exec-vs-matchall/
const clozeRegex =
  /{{c(?<clozeIndex>\d+)::(?<answer>.*?)(?:::(?<hint>.*?))?}}/gi
const clozeTemplateRegex = /{{cloze:(?<fieldName>.+?)}}/gi
function clozeTemplateFor(fieldName: string): RegExp {
  const escapedFieldName = escapeRegExp(fieldName)
  const r = clozeTemplateRegex.source.replace(
    "(?<fieldName>.+?)",
    escapedFieldName
  )
  return new RegExp(r, clozeTemplateRegex.flags)
}

// https://stackoverflow.com/a/6969486
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
}

// https://stackoverflow.com/a/32800728
function isNullOrWhitespace(input: string | undefined): boolean {
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  return !input || !input.trim()
}

export function body(
  fieldsAndValues: ReadonlyArray<readonly [string, string]>,
  frontTemplate: string,
  backTemplate: string,
  pointer: ChildTemplateId | ClozeIndex
): readonly [string, string] | null {
  const [fieldsAndValues2, frontTemplate2, backTemplate2] =
    getFieldsValuesFrontTemplateBackTemplate(
      fieldsAndValues,
      frontTemplate,
      backTemplate,
      pointer
    )
  const frontSide = replaceFields(fieldsAndValues2, true, frontTemplate2)
  if (frontSide === frontTemplate2) {
    return null
  } else {
    const backSide = replaceFields(
      fieldsAndValues2,
      false,
      backTemplate2
    ).replace(
      "{{FrontSide}}",
      replaceFields(fieldsAndValues2, false, frontTemplate2)
    )
    return [frontSide, backSide]
  }
}

function getClozeFields(frontTemplate: string): string[] {
  return Array.from(
    frontTemplate.matchAll(clozeTemplateRegex),
    (x) =>
      x.groups?.fieldName ??
      throwExp(
        "This error should never occur - is `clozeTemplateRegex` broken?"
      )
  )
}

function getFieldsValuesFrontTemplateBackTemplate(
  fieldsAndValues: ReadonlyArray<readonly [string, string]>,
  frontTemplate: string,
  backTemplate: string,
  pointer: ChildTemplateId | ClozeIndex
): readonly [ReadonlyArray<readonly [string, string]>, string, string] {
  if (pointer.brand === "childTemplateId") {
    return [fieldsAndValues, frontTemplate, backTemplate]
  } else {
    const i = (pointer.valueOf() + 1).toString()
    const clozeFields = getClozeFields(frontTemplate)
    const [fieldsAndValues2, unusedFields] = _.partition(
      fieldsAndValues,
      ([fieldName, value]) => {
        const indexMatch = Array.from(
          value.matchAll(clozeRegex),
          (x) =>
            x.groups?.clozeIndex ??
            throwExp("This error should never occur - is `clozeRegex` broken?")
        ).includes(i)
        return indexMatch || !clozeFields.includes(fieldName)
      }
    )
    const fieldsAndValues3 = fieldsAndValues2.map(([fieldName, value]) => {
      const value2 = Array.from(value.matchAll(clozeRegex))
        .filter(
          (x) =>
            (x.groups?.clozeIndex ??
              throwExp(
                "This error should never occur - is `clozeRegex` broken?"
              )) !== i
        )
        .map((x) => ({
          completeMatch: x[0],
          answer:
            x.groups?.answer ??
            throwExp("This error should never occur - is `clozeRegex` broken?"),
        }))
        .reduce(
          (state, { completeMatch, answer }) =>
            state.replace(completeMatch, answer),
          value
        )
      return [fieldName, value2] as const
    })
    const [qt, at] = unusedFields
      .map(([k]) => k)
      .reduce(
        ([ft, bt], fieldName) => {
          const irrelevantCloze = clozeTemplateFor(fieldName)
          return [
            ft.replace(irrelevantCloze, ""),
            bt.replace(irrelevantCloze, ""),
          ]
        },
        [frontTemplate, backTemplate]
      )
    return [fieldsAndValues3, qt, at]
  }
}

function replaceFields(
  fieldsAndValues: ReadonlyArray<readonly [string, string]>,
  isFront: boolean,
  template: string
): string {
  return fieldsAndValues.reduce((previous, [fieldName, value]) => {
    const simple = previous.replace(`{{${fieldName}}}`, value)

    const showIfHasText = (() => {
      const fieldName2 = escapeRegExp(fieldName)
      const regex = new RegExp(`{{#${fieldName2}}}(.*?){{/${fieldName2}}}`)
      return isNullOrWhitespace(value)
        ? simple.replace(regex, "")
        : simple.replace(regex, "$1")
    })()

    const showIfEmpty: string = (() => {
      const fieldName2 = escapeRegExp(fieldName)
      const regex = new RegExp(`{{\\^${fieldName2}}}(.*?){{/${fieldName2}}}`)
      return isNullOrWhitespace(value)
        ? showIfHasText.replace(regex, "$1")
        : showIfHasText.replace(regex, "")
    })()

    const stripHtml = showIfEmpty.replace(`{{text:${fieldName}}}`, strip(value))

    const cloze = (() => {
      if (isFront) {
        const regexMatches: ReadonlyArray<
          readonly [string | undefined, string]
        > = Array.from(value.matchAll(clozeRegex), (x) => [
          x.groups?.hint,
          x[0],
        ])
        const bracketed = regexMatches.reduce((current, [hint, rawCloze]) => {
          const brackets = `
<span class="cloze-brackets-front">[</span>
<span class="cloze-filler-front">${hint ?? "..."}</span>
<span class="cloze-brackets-front">]</span>
`
          return current.replace(rawCloze, brackets)
        }, value)
        return stripHtml.replace(clozeTemplateFor(fieldName), bracketed)
      } else {
        const answer = value.replace(
          clozeRegex,
          `
<span class="cloze-brackets-back">[</span>
$<answer>
<span class="cloze-brackets-back">]</span>
`
        )
        return stripHtml.replace(clozeTemplateFor(fieldName), answer)
      }
    })()
    return cloze
  }, template)
}

function buildHtml(body: string, css: string): string {
  return `
<!DOCTYPE html>
    <head>
        <style>
            .cloze-brackets-front {
                font-size: 150%%;
                font-family: monospace;
                font-weight: bolder;
                color: dodgerblue;
            }
            .cloze-filler-front {
                font-size: 150%%;
                font-family: monospace;
                font-weight: bolder;
                color: dodgerblue;
            }
            .cloze-brackets-back {
                font-size: 150%%;
                font-family: monospace;
                font-weight: bolder;
                color: red;
            }
        </style>
        <style>
            ${css}
        </style>
    </head>
    <body>
        ${body}
    </body>
</html>
`
}

export function html(
  fieldsAndValues: ReadonlyArray<readonly [string, string]>,
  frontTemplate: string,
  backTemplate: string,
  pointer: ChildTemplateId | ClozeIndex,
  css: string
): readonly [string, string] | null {
  const body2 = body(fieldsAndValues, frontTemplate, backTemplate, pointer)
  if (body2 === null) {
    return null
  } else {
    return [buildHtml(body2[0], css), buildHtml(body2[1], css)] as const
  }
}

export function renderTemplate(
  template: Pick<Template, "fields" | "templateType" | "css">
): ReadonlyArray<readonly [string, string] | null> {
  const getStandardFieldAndValue = (
    field: Field
  ): readonly [string, string] => {
    return [field.name, `(${field.name})`] as const
  }
  const fieldsAndValues = template.fields.map(getStandardFieldAndValue) // medTODO consider adding escape characters so you can do e.g. {{Front}}. Apparently Anki doesn't have escape characters - now would be a good time to introduce this feature.
  if (template.templateType.tag === "standard") {
    return template.templateType.templates.map(({ front, back, id }) =>
      html(fieldsAndValues, front, back, id, template.css)
    )
  } else if (template.templateType.tag === "cloze") {
    const getFieldsAndValues = (
      clozeField: string,
      i: number
    ): Array<readonly [string, string]> =>
      template.fields.map((f) => {
        return f.name === clozeField
          ? ([
              f.name,
              `This is a cloze deletion for {{c${i + 1}::${f.name}}}.`,
            ] as const)
          : getStandardFieldAndValue(f)
      })
    const { front, back } = template.templateType.template
    return getClozeFields(front).map((clozeField, i) =>
      html(
        getFieldsAndValues(clozeField, i),
        front,
        back,
        i as ClozeIndex,
        template.css
      )
    )
  }
  throw new Error(
    `No renderer found for Template: ${JSON.stringify(template.templateType)}`
  )
}
