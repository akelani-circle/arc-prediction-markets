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

import { beforeAll, describe, expect, it, vi } from "vitest";
import { createClient } from "viem";

// Circle's bundler for Arc Testnet, through the same transport the passkey wallet uses.
const configured = [process.env.NEXT_PUBLIC_CIRCLE_CLIENT_KEY, process.env.NEXT_PUBLIC_CIRCLE_CLIENT_URL].every(
  (v) => v && !v.startsWith("your_"),
);

describe.skipIf(!configured)("Circle bundler on Arc Testnet", () => {
  let circle: typeof import("@/lib/circle");

  beforeAll(async () => {
    // The SDK sends the page's hostname with each request, and the client key only allows
    // `localhost`: stand in for the browser tab the app runs in.
    vi.stubGlobal("window", { location: { hostname: "localhost", protocol: "http:" } });
    circle = await import("@/lib/circle");
  });

  it("prices UserOperations with circle_getUserOperationGasPrice", async () => {
    const bundler = createClient({ transport: circle.getModularTransport() });
    const fees = await circle.estimateUserOpFees({ bundlerClient: bundler });

    expect(fees.maxPriorityFeePerGas).toBeGreaterThan(0n);
    expect(fees.maxFeePerGas).toBeGreaterThanOrEqual(fees.maxPriorityFeePerGas);
    // Above the network's own base fee, or the bundler would hold the UserOp forever.
    const block = await circle.getCirclePublicClient().getBlock();
    expect(fees.maxFeePerGas).toBeGreaterThan(block.baseFeePerGas ?? 0n);
  });

  it("does not support the Pimlico method the app used to call", async () => {
    const bundler = createClient({ transport: circle.getModularTransport() });
    await expect(
      bundler.request({ method: "pimlico_getUserOperationGasPrice" } as never),
    ).rejects.toThrow();
  });
});
