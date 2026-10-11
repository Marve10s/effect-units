import { describe, it } from "@effect/vitest";
import { assertTrue, deepStrictEqual, throws } from "@effect/vitest/utils";
import * as Equal from "effect/Equal";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as Dimensionless from "../src/Dimensionless.ts";
import * as DimensionlessExact from "../src/DimensionlessExact.ts";
import * as Quantity from "../src/Quantity.ts";
import * as QuantityExact from "../src/QuantityExact.ts";
import * as Rational from "../src/Rational.ts";
import * as Unit from "../src/Unit.ts";
import { nonZeroRational, rational } from "./testUtilsExact.ts";

const compose = <U1 extends Unit.Unit, U2 extends Unit.Unit>(
  a: Quantity.Quantity<U1>,
  b: Quantity.Quantity<U2>,
): Quantity.Quantity<Unit.Product<U1, U2>> => Quantity.times(a, b);

const composeExact = <U1 extends Unit.Unit, U2 extends Unit.Unit>(
  a: QuantityExact.QuantityExact<U1>,
  b: QuantityExact.QuantityExact<U2>,
): QuantityExact.QuantityExact<Unit.Product<U1, U2>> =>
  QuantityExact.times(a, b);

const units: ReadonlyArray<Unit.Unit> = [
  "Unitless",
  "Meters",
  Unit.squared("Meters"),
  Unit.cubed("Meters"),
  Unit.product("Kilograms", Unit.rate("Meters", "Seconds")),
  Unit.rate("Meters", "Seconds"),
  Unit.product(Unit.custom("USD"), Unit.custom("Unitless")),
  Unit.custom("Unitless"),
];

for (const unit of units) {
  describe(`generic dimensionless algebra with ${Unit.encode(unit)}`, () => {
    it.prop(
      "recovers a folded factor on either side, including its schema",
      [
        Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 1000 })),
        Schema.Int.check(Schema.isBetween({ minimum: -1000, maximum: 1000 })),
      ],
      ([value, factorValue]) => {
        const quantity = Quantity.make(unit, value);
        const divisor = Quantity.make(
          Option.getOrThrow(Unit.decode(Unit.encode(unit))),
          value,
        );
        const factor = Dimensionless.fraction(factorValue / 4);
        const left = compose(factor, quantity);
        const right = compose(quantity, factor);
        const recovered: ReadonlyArray<Dimensionless.Dimensionless> = [
          Quantity.over(left, divisor),
          left.pipe(Quantity.over(divisor)),
          Quantity.over_(right, divisor),
          right.pipe(Quantity.over_(divisor)),
        ];

        for (const result of recovered) {
          assertTrue(Equal.equals(result, factor));
          deepStrictEqual(
            Schema.encodeSync(Dimensionless.DimensionlessFromStruct)(result),
            { unit: "Unitless", value: factor.value },
          );
        }
      },
    );

    it.prop(
      "recovers exact folded factors in safe, unsafe, and curried forms",
      [nonZeroRational, rational],
      ([value, factorValue]) => {
        const quantity = QuantityExact.make(unit, value);
        const factor = DimensionlessExact.fraction(factorValue);
        const left = composeExact(factor, quantity);
        const right = composeExact(quantity, factor);
        const recovered: ReadonlyArray<DimensionlessExact.DimensionlessExact> =
          [
            Option.getOrThrow(QuantityExact.over(left, quantity)),
            Option.getOrThrow(left.pipe(QuantityExact.over(quantity))),
            QuantityExact.overUnsafe(left, quantity),
            left.pipe(QuantityExact.overUnsafe(quantity)),
            Option.getOrThrow(QuantityExact.over_(right, quantity)),
            Option.getOrThrow(right.pipe(QuantityExact.over_(quantity))),
            QuantityExact.over_Unsafe(right, quantity),
            right.pipe(QuantityExact.over_Unsafe(quantity)),
          ];

        for (const result of recovered) {
          assertTrue(Equal.equals(result, factor));
          deepStrictEqual(
            Schema.encodeSync(DimensionlessExact.DimensionlessExactFromStruct)(
              result,
            ),
            Schema.encodeSync(DimensionlessExact.DimensionlessExactFromStruct)(
              factor,
            ),
          );
        }
      },
    );

    it("keeps exact division by zero partial after folding", () => {
      const zero = QuantityExact.make(unit, Rational.zero);
      const left = composeExact(DimensionlessExact.one, zero);
      const right = composeExact(zero, DimensionlessExact.one);

      assertTrue(Option.isNone(QuantityExact.over(left, zero)));
      assertTrue(Option.isNone(QuantityExact.over_(right, zero)));
      throws(() => QuantityExact.overUnsafe(left, zero));
      throws(() => QuantityExact.over_Unsafe(right, zero));
    });
  });
}
