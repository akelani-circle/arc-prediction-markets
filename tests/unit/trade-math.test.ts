/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "vitest";
import { priceImpactPercent } from "@/lib/slippage";
import { positionValues } from "@/hooks/market/helpers";

const tokens = (n: number) => BigInt(n) * BigInt("1000000000000000000");
const WAD = BigInt("1000000000000000000");

describe("priceImpactPercent", () => {
  it("shows a small sell at an even pool as about the 2% fee, not 50%", () => {
    // Selling 10 Yes into a 1000/1000 pool returns about 4.888 ARCT (see PredictionMarketAMM._sellQuote).
    const impact = priceImpactPercent(4.888 / 10, 0.5);
    expect(impact).toBeCloseTo(2.24, 1);
  });

  it("measures a buy against the token's spot price", () => {
    expect(priceImpactPercent(0.55, 0.5)).toBeCloseTo(10);
  });

  it("is undefined without a usable spot price", () => {
    expect(priceImpactPercent(0.5, undefined)).toBeUndefined();
    expect(priceImpactPercent(0.5, 0)).toBeUndefined();
    expect(priceImpactPercent(Infinity, 0.5)).toBeUndefined();
  });
});

describe("positionValues", () => {
  const balances = { longBalance: tokens(10), shortBalance: tokens(4), yesPrice: 70, noPrice: 30 };

  it("uses the AMM price while the market is open", () => {
    const { yes, no } = positionValues({ ...balances, settlementPrice: undefined });
    expect(yes).toBeCloseTo(7);
    expect(no).toBeCloseTo(1.2);
  });

  it.each([
    ["YES", WAD, 10, 0],
    ["NO", BigInt(0), 0, 4],
    ["Undetermined", WAD / BigInt(2), 5, 2],
  ])("uses the payout once the market resolved %s, ignoring the last AMM price", (_name, price, yes, no) => {
    expect(positionValues({ ...balances, settlementPrice: price })).toEqual({ yes, no });
  });
});
