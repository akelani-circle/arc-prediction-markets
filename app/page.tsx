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

import { useState } from "react";
import { MarketCard } from "@/components/MarketCard";
import { CreateMarketDialog } from "@/components/CreateMarketDialog";
import { MARKETS, MARKET_CATEGORIES, dynamicToCardData } from "@/lib/markets";
import { useDynamicMarkets } from "@/hooks/useDynamicMarkets";

const CATEGORIES = ["All", ...MARKET_CATEGORIES];

export default function Home() {
  const [activeCategory, setActiveCategory] = useState("All");
  // A failed fetch just shows the built-in markets.
  const { data: dynamicMarkets, refetch } = useDynamicMarkets();

  const allMarkets = [...(dynamicMarkets ?? []).map(dynamicToCardData), ...MARKETS];

  const filtered =
    activeCategory === "All"
      ? allMarkets
      : allMarkets.filter((m) => m.category === activeCategory);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Markets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trade on the outcome of future events
        </p>
      </div>

      <div className="flex items-center gap-2 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${activeCategory === cat
                  ? "bg-foreground text-background"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="shrink-0 ml-auto">
          <CreateMarketDialog onCreated={() => refetch()} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </div>
    </div>
  );
}
