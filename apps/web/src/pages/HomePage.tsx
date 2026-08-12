import { useQuery } from "@tanstack/react-query";
import { Badge, AppButton, AgentCard, SectionHeading, StatCard } from "../components/ui";
import { apiFetch } from "../lib/api";
import { mockAgents, revenueSeries as fallbackRevenueSeries } from "../data/mock";

interface AgentSummary {
  _id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  averageRating: number;
  totalRuns: number;
  featured: boolean;
  trending: boolean;
  status: string;
  tags: string[];
}

interface AgentsResponse {
  items: AgentSummary[];
}

interface AnalyticsResponse {
  revenue?: number;
  totalTransactions?: number;
  usageByDay?: Array<{ date: string; runs: number; revenue: number }>;
}

export function HomePage() {
  const { data: featured = mockAgents.filter(agent => agent.featured).slice(0, 4) } = useQuery({
    queryKey: ["home-featured-agents"],
    queryFn: async () => {
      try {
        const result = await apiFetch<AgentsResponse>("/agents?limit=4&page=1&sort=trending&featured=true");
        return (result.items ?? []).map(agent => ({
          id: agent._id,
          slug: agent.slug,
          name: agent.name,
          category: agent.category,
          description: agent.description,
          tags: agent.tags ?? [agent.category, "algorand", "x402"],
          averageRating: agent.averageRating,
          reviewCount: 0,
          totalRuns: agent.totalRuns,
          pricing: {
            currency: "USDC" as const,
            amount: agent.price,
            commissionRate: 0.1,
            developerShare: 0.9,
            marketplaceShare: 0.1,
          },
          ownerName: "AIHub Developer",
          ownerId: agent._id,
          status: agent.status === "approved" ? "approved" : "pending",
          featured: agent.featured,
          trending: agent.trending,
          createdAt: "",
          updatedAt: "",
        }));
      } catch {
        return mockAgents.filter(agent => agent.featured).slice(0, 4);
      }
    },
  });

  const { data: analytics } = useQuery({
    queryKey: ["home-analytics"],
    queryFn: async () => {
      try {
        return await apiFetch<AnalyticsResponse>("/analytics");
      } catch {
        return null;
      }
    },
  });

  const revenuePoints = analytics?.usageByDay?.length
    ? analytics.usageByDay.map((point, index) => ({
        month: point.date.slice(5, 10),
        revenue: point.revenue,
        transactions: point.runs,
      }))
    : fallbackRevenueSeries;

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="space-y-6">
          <Badge tone="mint">Algorand x402 Marketplace</Badge>
          <h1 className="font-display max-w-3xl text-5xl font-bold leading-tight text-white sm:text-6xl">
            Pay only when AI agents work. No subscriptions. No dead seats.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            AIHub is a decentralized, pay-per-use marketplace for AI services on Algorand. The web app now uses a
            backend-owned wallet to pay x402 challenges automatically and returns an on-chain receipt for each
            successful execution.
          </p>
          <div className="flex flex-wrap gap-3">
            <AppButton href="/marketplace">Browse Agents</AppButton>
            <AppButton href="/developer" variant="secondary">Publish as Developer</AppButton>
            <AppButton href="/wallet" variant="secondary">Wallet settings</AppButton>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Average payment" value="$0.02" detail="USDC per invocation" trend="x402 exact" />
            <StatCard label="Marketplace fee" value="10%" detail="Developers keep 90%" trend="Algorand" />
            <StatCard label="Sample agents" value={String(featured.length || 0)} detail="Ready-to-publish AI services" trend="Live" />
          </div>
        </div>

        <div className="section-card relative overflow-hidden p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(49,212,170,0.15),transparent_36%),radial-gradient(circle_at_bottom_left,rgba(227,155,25,0.12),transparent_28%)]" />
          <div className="relative space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Live flow</p>
                <h2 className="font-display text-2xl font-bold text-white">402 -&gt; sign -&gt; settle -&gt; receipt</h2>
              </div>
              <Badge tone="gold">Algorand USDC</Badge>
            </div>
            <div className="space-y-3 text-sm text-slate-300">
              {[
                "Request hits a protected AI endpoint",
                "Server returns 402 Payment Required",
                "Backend signs via x402 and retries",
                "Facilitator verifies and settles USDC ASA",
                "AI response returns with Algorand transaction ID",
                "Receipt is stored for download and history",
              ].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint-300/15 text-xs font-semibold text-mint-100">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Trending now"
          title="Featured AI agents"
          description="Live agents are loaded from the API when available. Each route is backed by x402 payment control and Algorand settlement."
          action={<AppButton href="/marketplace" variant="secondary">Open marketplace</AppButton>}
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featured.map(agent => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="section-card p-6">
          <SectionHeading
            eyebrow="Business model"
            title="Revenue split and platform economics"
            description="Developers define pricing in USDC, the marketplace collects a 10% commission, and developers keep the remaining 90%."
          />
          <div className="space-y-4 text-sm text-slate-300">
            {[
              ["Resume analysis", "$0.02", "Fast scoring and structured feedback"],
              ["Translation", "$0.01", "Low-cost one-off language conversion"],
              ["Image generation", "$0.05", "Premium media generation on demand"],
            ].map(([name, price, note]) => (
              <div key={name} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                <div>
                  <p className="font-medium text-white">{name}</p>
                  <p className="text-xs text-slate-400">{note}</p>
                </div>
                <span className="font-display text-lg text-mint-100">{price}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="section-card p-6">
          <SectionHeading
            eyebrow="Performance"
            title="Marketplace momentum"
            description="These metrics feed the developer and admin dashboards, making analytics and trending ranking easy to explain."
          />
          <div className="space-y-4">
            {revenuePoints.map(point => (
              <div key={point.month} className="grid grid-cols-[64px_1fr_88px] items-center gap-4">
                <p className="text-sm text-slate-400">{point.month}</p>
                <div className="h-3 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full bg-gradient-to-r from-mint-300 to-gold-300" style={{ width: `${Math.min(point.revenue / 60, 100)}%` }} />
                </div>
                <p className="text-right text-sm text-slate-300">${point.revenue}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
