import * as Unit from "../src/Unit.ts";

export const unitCases: ReadonlyArray<{
  readonly label: string;
  readonly unit: Unit.Unit;
}> = (
  [
    "Unitless",
    "Meters",
    Unit.squared("Meters"),
    Unit.cubed("Meters"),
    Unit.product("Kilograms", Unit.rate("Meters", "Seconds")),
    Unit.rate("Meters", "Seconds"),
    Unit.product(Unit.custom("USD"), Unit.custom("Unitless")),
    Unit.custom("Unitless"),
  ] as const
).map((unit) => ({ label: Unit.encode(unit), unit }));
