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

"use client";

import { OO_V2_ABI } from "@/lib/contracts/abis/oracle";
import { OO_V2_ADDRESS } from "@/lib/contracts/addresses";
import { useContractWrite } from "@/hooks/useContractWrite";
import { useMarketAddress } from "@/contexts/MarketAddressContext";

// The oracle and markets read time from the chain (block.timestamp): they are deployed
// without a UMA Timer. A shared Timer that anyone can set would let anyone skip a
// market's dispute window, so there is nothing for the UI to "advance" before acting.

export function useProposePrice(
  priceIdentifier: `0x${string}` | undefined,
  requestTimestamp: bigint | undefined,
  ancillaryDataHex: `0x${string}` | undefined
) {
  const { write, isPending, isConfirming, isSuccess, error, hash } = useContractWrite();
  const { marketAddress } = useMarketAddress();

  const propose = (proposedPrice: bigint) => {
    if (!priceIdentifier || requestTimestamp === undefined || !ancillaryDataHex) return;
    write({
      address: OO_V2_ADDRESS,
      abi: OO_V2_ABI,
      functionName: "proposePrice",
      args: [marketAddress, priceIdentifier, requestTimestamp, ancillaryDataHex, proposedPrice],
    });
  };

  return { propose, isPending, isConfirming, isSuccess, error, hash };
}

export function useDisputePrice(
  priceIdentifier: `0x${string}` | undefined,
  requestTimestamp: bigint | undefined,
  ancillaryDataHex: `0x${string}` | undefined
) {
  const { write, isPending, isConfirming, isSuccess, error, hash } = useContractWrite();
  const { marketAddress } = useMarketAddress();

  const dispute = () => {
    if (!priceIdentifier || requestTimestamp === undefined || !ancillaryDataHex) return;
    write({
      address: OO_V2_ADDRESS,
      abi: OO_V2_ABI,
      functionName: "disputePrice",
      args: [marketAddress, priceIdentifier, requestTimestamp, ancillaryDataHex],
    });
  };

  return { dispute, isPending, isConfirming, isSuccess, error, hash };
}

export function useSettleOracleRequest(
  priceIdentifier: `0x${string}` | undefined,
  requestTimestamp: bigint | undefined,
  ancillaryDataHex: `0x${string}` | undefined
) {
  const { write, isPending, isConfirming, isSuccess, error, hash } = useContractWrite();
  const { marketAddress } = useMarketAddress();

  const settleOracle = () => {
    if (!priceIdentifier || requestTimestamp === undefined || !ancillaryDataHex) return;
    write({
      address: OO_V2_ADDRESS,
      abi: OO_V2_ABI,
      functionName: "settle",
      args: [marketAddress, priceIdentifier, requestTimestamp, ancillaryDataHex],
    });
  };

  return { settleOracle, isPending, isConfirming, isSuccess, error, hash };
}
