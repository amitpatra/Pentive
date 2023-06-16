// https://basarat.gitbook.io/typescript/type-system/discriminated-unions#throw-in-exhaustive-checks
export function assertNever(x: never): never {
  throw new Error(
    `Expected 'never', but got an unexpected value:
${JSON.stringify(x)}`
  )
}

export function undefinedMap<T, R>(
  t: T | undefined,
  f: (_: T) => R
): R | undefined {
  if (t === undefined) {
    return t as undefined
  }
  return f(t)
}

export function nullMap<T, R>(t: T | null, f: (_: T) => R): R | null {
  if (t === null) {
    return t as null
  }
  return f(t)
}

// https://stackoverflow.com/a/65666402
export function throwExp(errorMessage: string): never {
  throw new Error(errorMessage)
}

// https://stackoverflow.com/a/46700791/
export function notEmpty<TValue>(
  value: TValue | null | undefined
): value is TValue {
  return value !== null && value !== undefined
}

// highTODO property test
export function stringifyMap(map: Map<unknown, unknown>) {
  return JSON.stringify(Object.fromEntries(map))
}

export function parseMap<T extends string, U>(rawMap: string) {
  const parsed = JSON.parse(rawMap) as Record<T, U>
  const entries = Object.entries(parsed) as Array<[T, U]>
  return new Map(entries)
}

// highTODO property test
export function stringifySet(set: Set<unknown> | ReadonlySet<unknown>) {
  return JSON.stringify([...set])
}

export function parseSet<T>(rawSet: string) {
  const parsed = JSON.parse(rawSet) as T[]
  return new Set(parsed)
}

// https://stackoverflow.com/questions/51599481/replacing-property-of-a-typescript-type#comment134810492_72983690
export type Override<T, U extends Partial<Record<keyof T, unknown>>> = Omit<
  T,
  keyof U
> &
  U
