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
import { createPublicClient, http, isAddress, parseAbi, type Address } from "viem";
import { arcTestnet, ARC_TESTNET_RPC_URL } from "@/lib/chain";
import { AMM_ABI, MARKET_ABI, OO_V2_ABI } from "@/lib/contracts/abis";

// Checks the contracts that `npm run deploy` wrote to .env.local, on Arc Testnet.
const env = (name: string) => process.env[name] as Address | undefined;
const MARKET = env("NEXT_PUBLIC_MARKET_ADDRESS");
const AMM = env("NEXT_PUBLIC_AMM_ADDRESS");
const ARCT = env("NEXT_PUBLIC_ARCT_ADDRESS");
const OO = env("NEXT_PUBLIC_OO_V2_ADDRESS");
const FINDER = env("NEXT_PUBLIC_FINDER_ADDRESS");
const deployed = [MARKET, AMM, ARCT, OO, FINDER].every((a) => a !== undefined && isAddress(a));

// UMA's Testable base contract: address(0) means "use block.timestamp".
const TESTABLE_ABI = parseAbi([
  "function timerAddress() view returns (address)",
  "function getCurrentTime() view returns (uint256)",
]);
const AMM_LINKS_ABI = parseAbi([
  "function market() view returns (address)",
  "function collateralToken() view returns (address)",
]);
const MARKET_LINKS_ABI = parseAbi(["function finder() view returns (address)"]);

const client = createPublicClient({ chain: arcTestnet, transport: http(ARC_TESTNET_RPC_URL) });

describe.skipIf(!deployed)("deployed contracts on Arc Testnet", () => {
  it("are on Arc Testnet", async () => {
    expect(await client.getChainId()).toBe(5042002);
  });

  it("have no UMA Timer: the oracle and the market both run on block time", async () => {
    for (const address of [OO!, MARKET!]) {
      const timer = await client.readContract({ address, abi: TESTABLE_ABI, functionName: "timerAddress" });
      expect(timer, `${address} timerAddress`).toBe("0x0000000000000000000000000000000000000000");
    }
    const block = await client.getBlock();
    const ooTime = await client.readContract({ address: OO!, abi: TESTABLE_ABI, functionName: "getCurrentTime" });
    // Read one block apart at most, so within a few seconds of the latest block.
    expect(Number(ooTime - block.timestamp)).toBeGreaterThanOrEqual(-5);
    expect(Number(ooTime - block.timestamp)).toBeLessThanOrEqual(60);
  });

  it("wire the market, its AMM, ARCT and the Finder together", async () => {
    const [ammMarket, ammCollateral, marketCollateral, marketFinder] = await Promise.all([
      client.readContract({ address: AMM!, abi: AMM_LINKS_ABI, functionName: "market" }),
      client.readContract({ address: AMM!, abi: AMM_LINKS_ABI, functionName: "collateralToken" }),
      client.readContract({ address: MARKET!, abi: MARKET_ABI, functionName: "collateralToken" }),
      client.readContract({ address: MARKET!, abi: MARKET_LINKS_ABI, functionName: "finder" }),
    ]);
    expect(ammMarket.toLowerCase()).toBe(MARKET!.toLowerCase());
    expect(ammCollateral.toLowerCase()).toBe(ARCT!.toLowerCase());
    expect(marketCollateral.toLowerCase()).toBe(ARCT!.toLowerCase());
    expect(marketFinder.toLowerCase()).toBe(FINDER!.toLowerCase());
  });

  it("has an initialized market, its oracle request and an initialized pool", async () => {
    const [priceRequested, requestTimestamp, identifier, ancillaryData, initialized] = await Promise.all([
      client.readContract({ address: MARKET!, abi: MARKET_ABI, functionName: "priceRequested" }),
      client.readContract({ address: MARKET!, abi: MARKET_ABI, functionName: "requestTimestamp" }),
      client.readContract({ address: MARKET!, abi: MARKET_ABI, functionName: "priceIdentifier" }),
      client.readContract({ address: MARKET!, abi: MARKET_ABI, functionName: "customAncillaryData" }),
      client.readContract({ address: AMM!, abi: AMM_ABI, functionName: "initialized" }),
    ]);
    expect(priceRequested).toBe(true);
    expect(initialized).toBe(true);

    // OptimisticOracleV2.State: 0 Invalid, 1 Requested, ... The request the market made must exist.
    const state = await client.readContract({
      address: OO!,
      abi: OO_V2_ABI,
      functionName: "getState",
      args: [MARKET!, identifier, requestTimestamp, ancillaryData],
    });
    expect(state).toBeGreaterThan(0);
  });
});
