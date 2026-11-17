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

import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { network } from "hardhat";

const { ethers } = await network.getOrCreate();
const require = createRequire(import.meta.url);

const E = (n: number | string) => ethers.parseEther(String(n));
const b32 = (s: string) => ethers.encodeBytes32String(s);
const LIVENESS = 60;
const REWARD = E(10);
const BOND = E(100);
const QUESTION = ethers.toUtf8Bytes("Will it rain tomorrow?");
const IDENTIFIER = b32("YES_OR_NO_QUERY");

/** Deploys UMA's oracle stack the way scripts/deploy.ts does: with no Timer, so on block time. */
async function deployUma() {
  const [deployer] = await ethers.getSigners();
  const uma = async (path: string, args: unknown[]) => {
    const { abi, bytecode } = require(`@uma/core/artifacts/contracts/${path}`);
    const contract = await new ethers.ContractFactory(abi, bytecode, deployer).deploy(...args);
    await contract.waitForDeployment();
    return contract as unknown as ReturnType<typeof ethers.Contract.from>;
  };
  const noTimer = ethers.ZeroAddress;

  const finder = await uma("data-verification-mechanism/implementation/Finder.sol/Finder.json", []);
  const finderAddr = await finder.getAddress();
  const identifiers = await uma("data-verification-mechanism/implementation/IdentifierWhitelist.sol/IdentifierWhitelist.json", []);
  const collaterals = await uma("common/implementation/AddressWhitelist.sol/AddressWhitelist.json", []);
  const store = await uma("data-verification-mechanism/implementation/Store.sol/Store.json", [[0], [0], noTimer]);
  const arct = await uma("common/implementation/TestnetERC20.sol/TestnetERC20.json", ["Arc Test Token", "ARCT", 18]);
  const dvm = await uma("data-verification-mechanism/test/MockOracleAncillary.sol/MockOracleAncillary.json", [finderAddr, noTimer]);
  const oo = await uma("optimistic-oracle-v2/implementation/OptimisticOracleV2.sol/OptimisticOracleV2.json", [7200, finderAddr, noTimer]);

  await finder.changeImplementationAddress(b32("IdentifierWhitelist"), await identifiers.getAddress());
  await finder.changeImplementationAddress(b32("CollateralWhitelist"), await collaterals.getAddress());
  await finder.changeImplementationAddress(b32("Store"), await store.getAddress());
  await finder.changeImplementationAddress(b32("Oracle"), await dvm.getAddress());
  await finder.changeImplementationAddress(b32("OptimisticOracleV2"), await oo.getAddress());
  await identifiers.addSupportedIdentifier(IDENTIFIER);
  await collaterals.addToWhitelist(await arct.getAddress());

  return { finder, arct, oo, dvm };
}

async function deploy() {
  const [deployer, alice, bob] = await ethers.getSigners();
  const { finder, arct, oo, dvm } = await deployUma();
  const market = await ethers.deployContract("EventBasedPredictionMarket", [
    "RAIN", await arct.getAddress(), QUESTION, await finder.getAddress(), ethers.ZeroAddress, REWARD, LIVENESS, BOND,
  ]);
  const marketAddr = await market.getAddress();
  const ooAddr = await oo.getAddress();

  for (const user of [deployer, alice, bob]) {
    await arct.allocateTo(user.address, E(10_000));
    await arct.connect(user).approve(marketAddr, ethers.MaxUint256);
    await arct.connect(user).approve(ooAddr, ethers.MaxUint256);
  }
  await market.initializeMarket();

  const long = await ethers.getContractAt("TestCollateral", await market.longToken());
  const short = await ethers.getContractAt("TestCollateral", await market.shortToken());
  for (const user of [deployer, alice, bob]) {
    await long.connect(user).approve(marketAddr, ethers.MaxUint256);
    await short.connect(user).approve(marketAddr, ethers.MaxUint256);
  }

  const request = async () => [marketAddr, IDENTIFIER, await market.requestTimestamp(), QUESTION] as const;
  return { deployer, alice, bob, arct, oo, dvm, market, long, short, request };
}

type Fixture = Awaited<ReturnType<typeof deploy>>;

const reverts = (promise: Promise<unknown>, reason: RegExp | string) =>
  assert.rejects(promise, (error: Error) => {
    assert.match(error.message, typeof reason === "string" ? new RegExp(reason) : reason);
    return true;
  });

async function advance(seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

// OptimisticOracleV2 states
const Proposed = 2n;
const Expired = 3n;

describe("EventBasedPredictionMarket on block time (no UMA Timer)", () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await deploy();
  });

  it("has no Timer anyone could move: the market and the oracle both use block.timestamp", async () => {
    assert.equal(await f.market.timerAddress(), ethers.ZeroAddress);
    assert.equal(await f.oo.timerAddress(), ethers.ZeroAddress);
    const block = await ethers.provider.getBlock("latest");
    assert.equal(await f.oo.getCurrentTime(), BigInt(block!.timestamp));
    await reverts(f.market.connect(f.bob).setCurrentTime(BigInt(block!.timestamp) + 3600n), /revert/);
  });

  it("keeps the dispute window open for the whole liveness period", async () => {
    await f.oo.connect(f.alice).proposePrice(...(await f.request()), E(1));
    assert.equal(await f.oo.getState(...(await f.request())), Proposed);
    await reverts(f.oo.settle(...(await f.request())), /revert/);

    await advance(LIVENESS - 5);
    assert.equal(await f.oo.getState(...(await f.request())), Proposed);

    await advance(10);
    assert.equal(await f.oo.getState(...(await f.request())), Expired);
  });

  it("settles YES after liveness, and pays Long holders 1 ARCT per token", async () => {
    await f.market.connect(f.bob).create(E(20));
    await f.oo.connect(f.alice).proposePrice(...(await f.request()), E(1));
    await advance(LIVENESS + 1);
    await f.oo.settle(...(await f.request()));

    assert.equal(await f.market.receivedSettlementPrice(), true);
    assert.equal(await f.market.settlementPrice(), E(1));
    const before = await f.arct.balanceOf(f.bob.address);
    await f.market.connect(f.bob).settle(E(20), E(20));
    assert.equal((await f.arct.balanceOf(f.bob.address)) - before, E(20));
  });

  it("settles Undetermined at 0.5 ARCT per token on both sides", async () => {
    await f.market.connect(f.bob).create(E(10));
    await f.oo.connect(f.alice).proposePrice(...(await f.request()), E("0.5"));
    await advance(LIVENESS + 1);
    await f.oo.settle(...(await f.request()));

    const before = await f.arct.balanceOf(f.bob.address);
    await f.market.connect(f.bob).settle(E(10), 0);
    assert.equal((await f.arct.balanceOf(f.bob.address)) - before, E(5));
  });

  it("re-requests a fresh price on dispute, which can then be proposed and settled", async () => {
    const first = await f.market.requestTimestamp();
    await f.oo.connect(f.alice).proposePrice(...(await f.request()), E(1));
    await advance(5);
    await f.oo.connect(f.bob).disputePrice(...(await f.request()));

    const second = await f.market.requestTimestamp();
    assert.ok(second > first, "the market should request a new price");

    await f.oo.connect(f.bob).proposePrice(...(await f.request()), 0);
    await advance(LIVENESS + 1);
    await f.oo.settle(...(await f.request()));
    assert.equal(await f.market.receivedSettlementPrice(), true);
    assert.equal(await f.market.settlementPrice(), 0n);
  });

  it("redeems Yes+No pairs 1:1 before resolution", async () => {
    await f.market.connect(f.bob).create(E(7));
    assert.equal(await f.long.balanceOf(f.bob.address), E(7));
    const before = await f.arct.balanceOf(f.bob.address);
    await f.market.connect(f.bob).redeem(E(7));
    assert.equal((await f.arct.balanceOf(f.bob.address)) - before, E(7));
    assert.equal(await f.short.balanceOf(f.bob.address), 0n);
  });
});
