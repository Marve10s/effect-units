import assert from "node:assert/strict";
import { test } from "node:test";
import * as Equal from "effect/Equal";
import * as Schema from "effect/Schema";
import * as Area from "effect-units/Area";
import * as Dimensionless from "effect-units/Dimensionless";
import * as Duration from "effect-units/Duration";
import * as Length from "effect-units/Length";
import * as LengthExact from "effect-units/LengthExact";
import * as Quantity from "effect-units/Quantity";
import * as Rational from "effect-units/Rational";
import * as Speed from "effect-units/Speed";
import * as Unit from "effect-units/Unit";

test("converts units and composes rates through the installed public API", () => {
  const distance = Length.kilometers(1);
  const speed: Speed.Speed = Quantity.per(distance, Duration.seconds(200));
  assert.equal(Speed.inMetersPerSecond(speed), 5);
  assert.equal(Length.inMeters(Quantity.at(speed, Duration.seconds(10))), 50);
  assert.equal(Length.inMeters(Length.feet(1)), 0.3048);
});

test("round-trips nested quantities, rationals, and units through JSON", () => {
  const distance = Length.kilometers(1);
  const speed = Quantity.per(distance, Duration.seconds(200));
  const third = Rational.makeUnsafe(1n, 3n);
  const exact = LengthExact.meters(third);
  const trip = { distance, speed, exact, third, unit: Unit.custom("USD") };
  const Trip = Schema.Struct({
    distance: Length.Length,
    speed: Speed.Speed,
    exact: LengthExact.LengthExact,
    third: Rational.Rational,
    unit: Unit.Unit,
  });
  const codec = Schema.toCodecJson(Trip);
  const wire = Schema.encodeSync(codec)(trip);
  assert.deepEqual(wire, {
    distance: { unit: "Meters", value: 1000 },
    speed: { unit: "(Meters/Seconds)", value: 5 },
    exact: { unit: "Meters", value: "1/3" },
    third: "1/3",
    unit: "[USD]",
  });
  const decoded = Schema.decodeUnknownSync(codec)(
    JSON.parse(JSON.stringify(wire)),
  );
  (["distance", "speed", "exact", "third", "unit"] as const).forEach((key) => {
    assert.ok(Equal.equals(decoded[key], trip[key]));
  });
});

test("round-trips an exact quantity through its named codec", () => {
  const exact = LengthExact.meters(Rational.makeUnsafe(1n, 3n));
  assert.ok(
    Equal.equals(
      Schema.decodeSync(LengthExact.LengthExactFromStruct)(
        Schema.encodeSync(LengthExact.LengthExactFromStruct)(exact),
      ),
      exact,
    ),
  );
});

test("recovers and encodes a folded dimensionless factor", () => {
  const compose = <U1 extends Unit.Unit, U2 extends Unit.Unit>(
    a: Quantity.Quantity<U1>,
    b: Quantity.Quantity<U2>,
  ): Quantity.Quantity<Unit.Product<U1, U2>> => Quantity.times(a, b);
  const area = Area.squareMeters(6);
  const factor: Dimensionless.Dimensionless = Quantity.over_(
    compose(area, Dimensionless.percent(50)),
    area,
  );
  assert.ok(Equal.equals(factor, Dimensionless.percent(50)));
  assert.deepEqual(
    Schema.encodeSync(Dimensionless.DimensionlessFromStruct)(factor),
    { unit: "Unitless", value: 0.5 },
  );
});
