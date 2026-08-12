import { useEffect, useState } from "react";
import { AppButton, Badge, SectionHeading, StatCard } from "../components/ui";
import { apiFetch } from "../lib/api";
import {
  connectPeraWallet,
  disconnectPeraWallet,
  getConnectedPeraAddress,
  getPeraNetwork,
  restorePeraWalletSession,
  setPeraNetwork,
} from "../lib/pera";
import { clearAuthSession, getStoredUser, setAuthSession, setStoredWalletAddress } from "../lib/session";
import { getStoredPeraNetwork } from "../lib/session";

export function WalletPage() {
  const [walletAddress, setWalletAddress] = useState("Not connected");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [network, setNetwork] = useState<"testnet" | "mainnet">(getStoredPeraNetwork());
  const [email, setEmail] = useState("developer@aihub.market");
  const [password, setPassword] = useState("ChangeMe123!");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState(getStoredUser()?.email ?? "Not signed in");

  useEffect(() => {
    const loadWallet = async () => {
      const savedAddress = getConnectedPeraAddress();
      if (savedAddress) {
        setWalletAddress(savedAddress);
        setStatus("connected");
        setNetwork(getPeraNetwork());
        return;
      }

      try {
        const restoredAddress = await restorePeraWalletSession();
        if (restoredAddress) {
          setWalletAddress(restoredAddress);
          setStatus("connected");
          setNetwork(getPeraNetwork());
        }
      } catch {
        // No active Pera session, stay disconnected.
      }
    };

    void loadWallet();
  }, []);

  function handleNetworkChange(next: "testnet" | "mainnet") {
    setPeraNetwork(next);
    setNetwork(next);
    setMessage(
      next === "mainnet"
        ? "Network switched to Mainnet. Ensure your wallet funds are on Mainnet and confirm the x402 network matches."
        : "Network switched to Testnet.",
    );
  }

  async function handleLogin() {
    try {
      setMessage("");
      const response = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; fullName: string; email: string; role: "user" | "developer" | "admin" };
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      setAuthSession(
        { accessToken: response.accessToken, refreshToken: response.refreshToken },
        {
          id: response.user.id,
          fullName: response.user.fullName,
          email: response.user.email,
          role: response.user.role,
        },
      );
      setUserEmail(response.user.email);
      setMessage("Signed in successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    }
  }

  async function handleConnect() {
    setStatus("connecting");
    setMessage("");
    try {
      const address = await connectPeraWallet();
      if (!address) {
        throw new Error("No wallet address was returned by Pera.");
      }

      await apiFetch("/auth/connect-wallet", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: address,
          provider: "pera",
        }),
      });

      setWalletAddress(address);
      setStoredWalletAddress(address);
      setStatus("connected");
      setMessage("Wallet connected and verified.");
    } catch (error) {
      setWalletAddress("Not connected");
      setStatus("idle");
      const errorMessage = error instanceof Error ? error.message : "Unable to connect Pera Wallet";
      setMessage(
        errorMessage.includes("CONNECT_MODAL_CLOSED")
          ? "Pera Wallet connection was closed before completing."
          : errorMessage,
      );
    }
  }

  async function handleDisconnect() {
    setStatus("idle");
    setWalletAddress("Not connected");
    try {
      await disconnectPeraWallet();
    } finally {
      clearAuthSession();
      setUserEmail("Not signed in");
      setMessage("Disconnected.");
    }
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Wallet"
        title="Connect Pera Wallet"
        description="Use Pera Wallet to link your address for identity, balance checks, and settlement visibility."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Wallet status" value={status === "connected" ? "Connected" : status === "connecting" ? "Connecting..." : "Disconnected"} detail="Linked account" />
        <StatCard label="Network" value={network === "mainnet" ? "Mainnet" : "Testnet"} detail="Matches x402 network config" />
        <StatCard label="Receipts" value="Stored" detail="Downloadable from transaction history" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="section-card p-6">
          <p className="text-sm text-slate-400">Demo sign in</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-white">Use a seeded account</h3>
          <p className="mt-2 text-sm text-slate-300">
            Start with the demo developer account from the seed script, then connect Pera so the payment flow can sign transactions.
          </p>
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">Email</span>
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm text-slate-400">Password</span>
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <AppButton onClick={handleLogin}>Sign in</AppButton>
              <AppButton
                variant="secondary"
                onClick={() => {
                  setEmail("developer@aihub.market");
                  setPassword("ChangeMe123!");
                }}
              >
                Load demo creds
              </AppButton>
            </div>
          </div>
          {message ? <p className="mt-4 text-sm text-mint-100">{message}</p> : null}
          <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-300">
            <p className="text-slate-400">Signed in user</p>
            <p className="mt-2 break-all font-medium text-white">{userEmail}</p>
          </div>
        </div>

        <div className="section-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-400">Current address</p>
              <p className="mt-2 break-all font-display text-2xl font-bold text-white">{walletAddress}</p>
            </div>
            <Badge tone={status === "connected" ? "mint" : "gold"}>{status === "connected" ? "Wallet linked" : "Connect to link"}</Badge>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <AppButton onClick={handleConnect} className={status === "connecting" ? "opacity-70" : ""}>
              {status === "connecting" ? "Connecting..." : "Connect Pera"}
            </AppButton>
            <AppButton onClick={handleDisconnect} variant="secondary">Disconnect</AppButton>
          </div>
          <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-300">
            <p className="text-slate-400">Network</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AppButton variant={network === "testnet" ? "primary" : "secondary"} onClick={() => handleNetworkChange("testnet")}>
                Testnet
              </AppButton>
              <AppButton variant={network === "mainnet" ? "primary" : "secondary"} onClick={() => handleNetworkChange("mainnet")}>
                Mainnet
              </AppButton>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-300">
            <p className="text-slate-400">What this does</p>
            <ul className="mt-3 space-y-2">
              <li>1. Signs in with a seeded AIHub account.</li>
              <li>2. Connects Pera Wallet and stores the address.</li>
              <li>3. Updates the backend wallet profile so payment runs can succeed.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
