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

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MarketDetail } from "@/components/MarketDetail";
import { TradingPanel } from "@/components/TradingPanel";
import { MarketActions } from "@/components/MarketActions";
import { MARKETS } from "@/lib/markets";
import { useDynamicMarkets } from "@/hooks/useDynamicMarkets";
import { MarketAddressProvider } from "@/contexts/MarketAddressContext";
import { type Address } from "viem";

function useResolveMarket(address: string) {
  const sameAddress = (other: string) => other.toLowerCase() === address.toLowerCase();

  // Built-in markets resolve straight away; only user-created ones need the API.
  const staticMatch = MARKETS.find((m) => m.isReal && m.ammAddress && sameAddress(m.address));
  const { data: dynamicMarkets, isPending } = useDynamicMarkets({ enabled: !staticMatch });
  const match = staticMatch ?? dynamicMarkets?.find((m) => sameAddress(m.address));

  const resolved = match?.ammAddress
    ? { marketAddress: match.address as Address, ammAddress: match.ammAddress as Address }
    : null;

  // A failed fetch ends loading and shows "Market not found", as before.
  return { resolved, loading: !staticMatch && isPending };
}

export default function MarketPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  const { resolved, loading } = useResolveMarket(address);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Markets
      </Link>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-secondary rounded" />
            <div className="h-4 w-full bg-secondary rounded" />
          </div>
        </div>
      ) : !resolved ? (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center space-y-2">
          <p className="font-medium">Market not found</p>
          <p className="text-sm text-muted-foreground">
            This market address does not match any configured contract.
          </p>
        </div>
      ) : (
        <MarketAddressProvider
          marketAddress={resolved.marketAddress}
          ammAddress={resolved.ammAddress}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
            <div className="space-y-4">
              <MarketDetail />
              <MarketActions />
            </div>
            <TradingPanel />
          </div>
        </MarketAddressProvider>
      )}
    </div>
  );
}
