import { defaultRenderContainer } from "./renderContainer"
import { expect, test } from "vitest"
import { type TemplateId, type Ord } from "./brand"
import { throwExp } from "./utility"
import { noteOrds, strip } from "./cardHtml"
import { type Template } from "./domain/template"

function testBody(
  fieldValues: Array<readonly [string, string]>,
  frontTemplate: string,
  backTemplate: string,
  ord: number,
  type: "standard" | "cloze",
  expectedFront: string,
  expectedBack: string
): void {
  const [front, back] =
    defaultRenderContainer.body(
      fieldValues,
      frontTemplate,
      backTemplate,
      ord as Ord,
      type
    ) ?? throwExp("should never happen")
  expect(front).toBe(expectedFront)
  expect(back).toBe(expectedBack)
}

function testStrippedBody(
  fieldValues: Array<readonly [string, string]>,
  frontTemplate: string,
  backTemplate: string,
  ord: number,
  type: "standard" | "cloze",
  expectedFront: string,
  expectedBack: string
): void {
  const [front, back] =
    defaultRenderContainer.body(
      fieldValues,
      frontTemplate,
      backTemplate,
      ord as Ord,
      type
    ) ?? throwExp("should never happen")
  expectStrippedToBe(front, expectedFront)
  expectStrippedToBe(back, expectedBack)
}

function expectStrippedToBe(html: string, expected: string): void {
  const newline = /[\r\n]/g
  expect(strip(html).replace(newline, "").trim()).toBe(expected)
}

function testBodyIsNull(
  fieldValues: Array<readonly [string, string]>,
  frontTemplate: string,
  backTemplate: string,
  ord: number,
  type: "standard" | "cloze"
): void {
  const result = defaultRenderContainer.body(
    fieldValues,
    frontTemplate,
    backTemplate,
    ord as Ord,
    type
  )
  expect(result).toBeNull()
}

test("CardHtml generates proper basic card template", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
    ],
    "{{Front}}",
    `{{FrontSide}}
  <hr id=answer>
  {{Back}}`,
    0,
    "standard",
    "What is the capital of Canada?",
    `What is the capital of Canada?
  <hr id=answer>
  Ottawa`
  )
})

test("CardHtml generates empty string when Front field is missing", () => {
  testBodyIsNull(
    [
      ["Back", "Ottawa"],
      ["FrontX", "What is the capital of Canada?"],
    ],
    "{{Front}}",
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}`,
    0,
    "standard"
  )
})

test("CardHtml generates proper basic with optional reversed custom card template", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
      ["Back2", "Canada"],
      ["Front2", "What is Ottawa the capital of?"],
    ],
    "{{#Front2}}{{Front2}}{{/Front2}}",
    `{{FrontSide}}
    <hr id=answer>
    {{Back2}}`,
    0,
    "standard",
    "What is Ottawa the capital of?",
    `What is Ottawa the capital of?
    <hr id=answer>
    Canada`
  )
})

test("CardHtml generates proper basic with optional reversed custom card template, but for {{Front}}", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
      ["Back2", "Canada"],
      ["Front2", "What is Ottawa the capital of?"],
    ],
    "{{Front}}",
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}`,
    0,
    "standard",
    "What is the capital of Canada?",
    `What is the capital of Canada?
    <hr id=answer>
    Ottawa`
  )
})

test("CardHtml generates proper basic card template, but with (empty) conditional Category", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
      ["Category", ""],
    ],
    "{{#Category}}Category: {{Category}}<br/>{{/Category}}{{Front}}",
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}`,
    0,
    "standard",
    "What is the capital of Canada?",
    `What is the capital of Canada?
    <hr id=answer>
    Ottawa`
  )
})

test("CardHtml generates proper basic card template, but with conditional Category that's shown", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
      ["Category", "Nations and Capitals"],
    ],
    "{{#Category}}Category: {{Category}}<br/>{{/Category}}{{Front}}",
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}`,
    0,
    "standard",
    "Category: Nations and Capitals<br/>What is the capital of Canada?",
    `Category: Nations and Capitals<br/>What is the capital of Canada?
    <hr id=answer>
    Ottawa`
  )
})

test("CardHtml generates proper basic card template, but with conditional Category that's shown, with newlines", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
      ["Category", "Nations and Capitals"],
    ],
    `{{#Category}}
Category: {{Category}}<br/>
{{/Category}}
{{Front}}`,
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}`,
    0,
    "standard",
    `
Category: Nations and Capitals<br/>

What is the capital of Canada?`,
    `
Category: Nations and Capitals<br/>

What is the capital of Canada?
    <hr id=answer>
    Ottawa`
  )
})

test("CardHtml generates proper basic card template, with conditional Category (inverted and empty)", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
      ["Category", ""],
    ],
    "{{^Category}}Category: {{Category}}No category was given<br/>{{/Category}}{{Front}}",
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}`,
    0,
    "standard",
    "Category: No category was given<br/>What is the capital of Canada?",
    `Category: No category was given<br/>What is the capital of Canada?
    <hr id=answer>
    Ottawa`
  )
})

test("CardHtml generates proper basic card template, with conditional Category (inverted and empty and with newlines)", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
      ["Category", ""],
    ],
    `{{^Category}}
Category: {{Category}}No category was given<br/>
{{/Category}}
{{Front}}`,
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}`,
    0,
    "standard",
    `
Category: No category was given<br/>

What is the capital of Canada?`,
    `
Category: No category was given<br/>

What is the capital of Canada?
    <hr id=answer>
    Ottawa`
  )
})

test("CardHtml generates proper basic card template, with conditional Category (inverted and populated)", () => {
  testBody(
    [
      ["Back", "Ottawa"],
      ["Front", "What is the capital of Canada?"],
      ["Category", "Nations and Capitals"],
    ],
    "{{^Category}}Category: {{Category}}No category was given<br/>{{/Category}}{{Front}}",
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}`,
    0,
    "standard",
    "What is the capital of Canada?",
    `What is the capital of Canada?
    <hr id=answer>
    Ottawa`
  )
})

test("CardHtml renders {{text:FieldName}} properly", () => {
  testBody(
    [
      ["Back", "<b>Ottawa</b>"],
      ["Front", "What is the capital of Canada?"],
    ],
    "{{Front}}",
    `{{FrontSide}}
    <hr id=answer>
    {{Back}}<br/><a href="http://example.com/search?q={{text:Back}}">check in dictionary</a>`,
    0,
    "standard",
    "What is the capital of Canada?",
    `What is the capital of Canada?
    <hr id=answer>
    <b>Ottawa</b><br/><a href="http://example.com/search?q=Ottawa">check in dictionary</a>`
  )
})

test("CardHtml renders {{cloze:FieldName}} properly", () => {
  testBody(
    [
      ["Text", "Canberra was founded in {{c1::1913}}."],
      ["Extra", "Some extra stuff."],
    ],
    "{{cloze:Text}}",
    `{{cloze:Text}}<br>{{Extra}}`,
    0,
    "cloze",
    `Canberra was founded in 
<span class="cloze-brackets-front">[</span>
<span class="cloze-filler-front">...</span>
<span class="cloze-brackets-front">]</span>
.`,
    `Canberra was founded in 
<span class="cloze-brackets-back">[</span>
1913
<span class="cloze-brackets-back">]</span>
.<br>Some extra stuff.`
  )
})

function ordsOfClozeNote(
  fieldsAndValues: ReadonlyArray<readonly [string, string]>,
  front: string,
  back: string
) {
  return noteOrds.bind(defaultRenderContainer)(fieldsAndValues, {
    id: "" as TemplateId,
    name: "",
    created: new Date(),
    updated: new Date(),
    remotes: new Map(),
    css: "",
    templateType: {
      tag: "cloze",
      template: {
        name: "",
        front,
        back,
        id: 0 as Ord,
        shortFront: "",
        shortBack: "",
      },
    },
  })
}

test("maxOrdNote of {{cloze:FieldName}} yields 1", () => {
  const ords = ordsOfClozeNote(
    [
      ["Text", "Canberra was founded in {{c1::1913}}."],
      ["Extra", "Some extra stuff."],
    ],
    "{{cloze:Text}}",
    `{{cloze:Text}}<br>{{Extra}}`
  )
  expect(ords).toStrictEqual([0])
})

test("CardHtml renders multiple cloze templates properly 1", () => {
  testStrippedBody(
    [
      ["Field1", "Columbus first crossed the Atlantic in {{c1::1492}}"],
      ["Field2", "In {{c2::1492}}, Columbus sailed the ocean {{c3::blue}}."],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    `{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}`,
    0,
    "cloze",
    "Columbus first crossed the Atlantic in [...]",
    `Columbus first crossed the Atlantic in [1492]Some extra info`
  )
})

test("CardHtml renders multiple cloze templates properly 2", () => {
  testStrippedBody(
    [
      ["Field1", "Columbus first crossed the Atlantic in {{c1::1492}}"],
      ["Field2", "In {{c2::1492}}, Columbus sailed the ocean {{c3::blue}}."],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    `{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}`,
    1,
    "cloze",
    "In [...], Columbus sailed the ocean blue.",
    "In [1492], Columbus sailed the ocean blue.Some extra info"
  )
})

test("CardHtml renders multiple cloze templates properly 3", () => {
  testStrippedBody(
    [
      ["Field1", "Columbus first crossed the Atlantic in {{c1::1492}}"],
      ["Field2", "In {{c2::1492}}, Columbus sailed the ocean {{c3::blue}}."],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    "{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}",
    2,
    "cloze",
    "In 1492, Columbus sailed the ocean [...].",
    "In 1492, Columbus sailed the ocean [blue].Some extra info"
  )
})

test("maxOrdNote of multiple cloze fields works", () => {
  const ords = ordsOfClozeNote(
    [
      ["Field1", "Columbus first crossed the Atlantic in {{c1::1492}}"],
      ["Field2", "In {{c2::1492}}, Columbus sailed the ocean {{c3::blue}}."],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    "{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}"
  )
  expect(ords).toStrictEqual([0, 1, 2])
})

test("CardHtml renders multiple cloze templates properly 4", () => {
  testStrippedBody(
    [
      ["Field1", "{{c1::Columbus}} first crossed the Atlantic in {{c1::1492}}"],
      ["Field2", "In 1492, Columbus sailed the ocean blue."],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    "{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}",
    0,
    "cloze",
    "[...] first crossed the Atlantic in [...]",
    "[Columbus] first crossed the Atlantic in [1492]Some extra info"
  )
})

test("maxOrdNote of multiple cloze fields with the same index works", () => {
  const ords = ordsOfClozeNote(
    [
      ["Field1", "{{c1::Columbus}} first crossed the Atlantic in {{c1::1492}}"],
      ["Field2", "In 1492, Columbus sailed the ocean blue."],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    "{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}"
  )
  expect(ords).toStrictEqual([0])
})

test("CardHtml renders {{cloze:FieldName}} properly with hint", () => {
  testStrippedBody(
    [
      ["Text", "Canberra was founded in {{c1::1913::year}}."],
      ["Extra", "Some extra stuff."],
    ],
    "{{cloze:Text}}",
    "{{cloze:Text}}<br>{{Extra}}",
    0,
    "cloze",
    "Canberra was founded in [year].",
    "Canberra was founded in [1913].Some extra stuff."
  )
})

test("CardHtml renders multiple cloze templates properly 1 with hint", () => {
  testStrippedBody(
    [
      ["Field1", "Columbus first crossed the Atlantic in {{c1::1492::year}}"],
      [
        "Field2",
        "In {{c2::1492::year}}, Columbus sailed the ocean {{c3::blue::color}}.",
      ],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    "{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}",
    0,
    "cloze",
    "Columbus first crossed the Atlantic in [year]",
    "Columbus first crossed the Atlantic in [1492]Some extra info"
  )
})

test("CardHtml renders multiple cloze templates properly 2 with hint", () => {
  testStrippedBody(
    [
      ["Field1", "Columbus first crossed the Atlantic in {{c1::1492::year}}"],
      [
        "Field2",
        "In {{c2::1492::year}}, Columbus sailed the ocean {{c3::blue::color}}.",
      ],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    "{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}",
    1,
    "cloze",
    "In [year], Columbus sailed the ocean blue.",
    "In [1492], Columbus sailed the ocean blue.Some extra info"
  )
})

test("CardHtml renders multiple cloze templates properly 3 with hint", () => {
  testStrippedBody(
    [
      ["Field1", "Columbus first crossed the Atlantic in {{c1::1492::year}}"],
      [
        "Field2",
        "In {{c2::1492::year}}, Columbus sailed the ocean {{c3::blue::color}}.",
      ],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    "{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}",
    2,
    "cloze",
    "In 1492, Columbus sailed the ocean [color].",
    "In 1492, Columbus sailed the ocean [blue].Some extra info"
  )
})

test("CardHtml renders multiple cloze templates properly 4 with hint", () => {
  testStrippedBody(
    [
      [
        "Field1",
        "{{c1::Columbus::person}} first crossed the Atlantic in {{c1::1492::year}}",
      ],
      ["Field2", "In 1492, Columbus sailed the ocean blue."],
      ["Extra", "Some extra info"],
    ],
    "{{cloze:Field1}}{{cloze:Field2}}",
    "{{cloze:Field1}}{{cloze:Field2}}<br>{{Extra}}",
    0,
    "cloze",
    "[person] first crossed the Atlantic in [year]",
    "[Columbus] first crossed the Atlantic in [1492]Some extra info"
  )
})

function expectTemplate(
  template: readonly [string, string] | null,
  expectedFront: string,
  expectedBack: string
): void {
  expect(template).not.toBeNull()
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const [front, back] = template!
  expectStrippedToBe(front, expectedFront)
  expectStrippedToBe(back, expectedBack)
}

test("renderTemplate works for 1 cloze", () => {
  const cloze: Template = {
    id: "" as TemplateId,
    name: "",
    created: new Date(),
    updated: new Date(),
    remotes: new Map(),
    css: "",
    fields: [{ name: "Text" }, { name: "Extra" }],
    templateType: {
      tag: "cloze" as const,
      template: {
        id: 0 as Ord,
        name: "Cloze",
        front: "{{cloze:Text}}",
        back: "{{cloze:Text}}{{Extra}}",
      },
    },
  }
  const templates = defaultRenderContainer.renderTemplate(cloze)
  expect(templates.length).toBe(1)
  const [template] = templates
  expectTemplate(
    template,
    "This is a cloze deletion for [...].",
    "This is a cloze deletion for [Text].(Extra)"
  )
})

test("renderTemplate works for 2 cloze deletions", () => {
  const cloze: Template = {
    id: "" as TemplateId,
    name: "",
    created: new Date(),
    updated: new Date(),
    remotes: new Map(),
    css: "",
    fields: [{ name: "Text1" }, { name: "Text2" }, { name: "Extra" }],
    templateType: {
      tag: "cloze" as const,
      template: {
        id: 0 as Ord,
        name: "Cloze",
        front: "{{cloze:Text1}}{{cloze:Text2}}",
        back: "{{cloze:Text1}}{{cloze:Text2}}{{Extra}}",
      },
    },
  }
  const templates = defaultRenderContainer.renderTemplate(cloze)
  expect(templates.length).toBe(2)
  const [template1, template2] = templates
  expectTemplate(
    template1,
    "This is a cloze deletion for [...].",
    "This is a cloze deletion for [Text1].(Extra)"
  )
  expectTemplate(
    template2,
    "This is a cloze deletion for [...].",
    "This is a cloze deletion for [Text2].(Extra)"
  )
})

test("renderTemplate works for standard with 1 child template", () => {
  const standard: Template = {
    id: "" as TemplateId,
    name: "",
    created: new Date(),
    updated: new Date(),
    remotes: new Map(),
    css: "",
    fields: [{ name: "English" }, { name: "Spanish" }],
    templateType: {
      tag: "standard" as const,
      templates: [
        {
          id: 0 as Ord,
          name: "e2s",
          front: "{{English}}",
          back: "{{English}}-{{Spanish}}",
        },
      ],
    },
  }
  const templates = defaultRenderContainer.renderTemplate(standard)
  expect(templates.length).toBe(1)
  const [template] = templates
  expectTemplate(template, "(English)", "(English)-(Spanish)")
})

test("renderTemplate works for standard with 2 child templates", () => {
  const standard = {
    id: "" as TemplateId,
    name: "",
    created: new Date(),
    updated: new Date(),
    remotes: new Map(),
    css: "",
    fields: [{ name: "English" }, { name: "Spanish" }],
    templateType: {
      tag: "standard" as const,
      templates: [
        {
          id: 0 as Ord,
          name: "e2s",
          front: "{{English}}",
          back: "{{English}}-{{Spanish}}",
        },
        {
          id: 1 as Ord,
          name: "s2e",
          front: "{{Spanish}}",
          back: "{{Spanish}}-{{English}}",
        },
      ],
    },
  }
  const templates = defaultRenderContainer.renderTemplate(standard)
  expect(templates.length).toBe(2)
  const [template1, template2] = templates
  expectTemplate(template1, "(English)", "(English)-(Spanish)")
  expectTemplate(template2, "(Spanish)", "(Spanish)-(English)")
})
