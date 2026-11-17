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

import { describe, expect, it, vi } from "vitest";
import { estimateUserOpFees, MIN_PRIORITY_FEE_PER_GAS } from "@/lib/circle";

// The response shape of Circle's bundler (decimal strings), as returned on Arc Testnet.
const gasPrice = {
  low: { maxPriorityFeePerGas: "7496731548", maxFeePerGas: "31496731548" },
  medium: { maxPriorityFeePerGas: "7871568125", maxFeePerGas: "33071568125" },
  high: { maxPriorityFeePerGas: "8246404702", maxFeePerGas: "34646404702" },
  deployed: "600000",
  notDeployed: "1700000",
};

const bundlerWith = (request: ReturnType<typeof vi.fn>) =>
  ({ request }) as unknown as Parameters<typeof estimateUserOpFees>[0]["bundlerClient"];

describe("estimateUserOpFees", () => {
  it("prices the UserOp with Circle's own gas price method, not Pimlico's", async () => {
    const request = vi.fn().mockResolvedValue(gasPrice);
    const fees = await estimateUserOpFees({ bundlerClient: bundlerWith(request) });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toMatchObject({ method: "circle_getUserOperationGasPrice" });
    expect(fees).toEqual({ maxFeePerGas: BigInt("33071568125"), maxPriorityFeePerGas: BigInt("7871568125") });
  });

  it("never tips below the floor when Circle's tier dips, and keeps the base fee headroom", async () => {
    // A dip seen on Arc Testnet: the bundler never mined a UserOp with this 1.17 gwei tip.
    const dip = { ...gasPrice, medium: { maxPriorityFeePerGas: "1170000000", maxFeePerGas: "26370000000" } };
    const fees = await estimateUserOpFees({ bundlerClient: bundlerWith(vi.fn().mockResolvedValue(dip)) });

    expect(MIN_PRIORITY_FEE_PER_GAS).toBe(BigInt("5000000000"));
    expect(fees.maxPriorityFeePerGas).toBe(MIN_PRIORITY_FEE_PER_GAS);
    // 26.37 gwei was a 25.2 gwei base fee estimate plus the 1.17 gwei tip: same base, 5 gwei tip.
    expect(fees.maxFeePerGas).toBe(BigInt("30200000000"));
    expect(fees.maxFeePerGas).toBeGreaterThanOrEqual(fees.maxPriorityFeePerGas);
  });

  it("uses the tier's tip unchanged when it is at or above the floor", async () => {
    const atFloor = { ...gasPrice, medium: { maxPriorityFeePerGas: "5000000000", maxFeePerGas: "30200000000" } };
    const fees = await estimateUserOpFees({ bundlerClient: bundlerWith(vi.fn().mockResolvedValue(atFloor)) });
    expect(fees).toEqual({ maxFeePerGas: BigInt("30200000000"), maxPriorityFeePerGas: BigInt("5000000000") });
  });

  it("fails loudly instead of falling back to a tip the bundler would never mine", async () => {
    const request = vi.fn().mockRejectedValue(new Error("Method not found"));
    await expect(estimateUserOpFees({ bundlerClient: bundlerWith(request) })).rejects.toThrow("Method not found");
  });
});
