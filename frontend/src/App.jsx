import React, { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import abi from "./abi/AuctionHouse.json";
import { short, timeLeft } from "./utils/format";

const CHAIN_ID_HEX = "0x1F90"; // 8080
const EXPLORER = "https://explorer-unstable.shardeum.org";

export default function App() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [status, setStatus] = useState("");
  const [contractAddr, setContractAddr] = useState(import.meta.env.VITE_CONTRACT_ADDRESS || "");
  const [count, setCount] = useState(0);
  const [auctions, setAuctions] = useState([]);

  const [title, setTitle] = useState("");
  const [uri, setUri] = useState("");
  const [duration, setDuration] = useState(5);
  const [reserve, setReserve] = useState("0.01");

  const [bidAmount, setBidAmount] = useState("0.02");
  const [lastTx, setLastTx] = useState(null);

  const ready = useMemo(() => typeof window !== "undefined" && !!window.ethereum, []);

  useEffect(() => {
    if (!ready) return;
    const handler = (chainIdHex) => setChainId(parseInt(chainIdHex, 16));
    window.ethereum?.on?.("chainChanged", handler);
    return () => window.ethereum?.removeListener?.("chainChanged", handler);
  }, [ready]);

  async function connect() {
    if (!ready) return alert("MetaMask not found");
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    setAddress(accounts[0]);
    const provider = new BrowserProvider(window.ethereum);
    const network = await provider.getNetwork();
    setChainId(Number(network.chainId));
    if (Number(network.chainId) !== 8080) await addOrSwitch();
  }

  async function addOrSwitch() {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
    } catch {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: "Shardeum Unstablenet",
          nativeCurrency: { name: "SHM", symbol: "SHM", decimals: 18 },
          rpcUrls: ["https://api-unstable.shardeum.org"],
          blockExplorerUrls: [EXPLORER + "/"]
        }]
      });
    }
  }

  async function getSignerAndContract() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(contractAddr, abi, signer);
  }

  async function refreshCount() {
    const c = await getSignerAndContract();
    const n = await c.auctionCount();
    setCount(Number(n));
    return Number(n);
  }

  async function fetchAuction(id) {
    const c = await getSignerAndContract();
    const a = await c.getAuction(id);
    return {
      id,
      seller: a[0],
      title: a[1],
      uri: a[2],
      endTime: Number(a[3]),
      reservePrice: a[4].toString(),
      highestBidder: a[5],
      highestBid: a[6].toString(),
      settled: a[7],
      canceled: a[8],
    };
  }

  async function refreshLatest(limit = 10) {
    const n = await refreshCount();
    const start = Math.max(1, n - limit + 1);
    const ids = [];
    for (let i = start; i <= n; i++) ids.push(i);
    const list = await Promise.all(ids.map(fetchAuction));
    setAuctions(list.reverse());
  }

  async function createAuction() {
    if (!title) return alert("Enter title");
    setStatus("Creating auction...");
    const c = await getSignerAndContract();
    const tx = await c.createAuction(Number(duration) * 60, parseEther(reserve || "0.01"), title, uri || "");
    setLastTx(tx.hash);
    await tx.wait();
    setStatus("Auction created ✅");
    setTitle(""); setUri("");
    await refreshLatest();
  }

  async function placeBid(id) {
    setStatus("Placing bid...");
    const c = await getSignerAndContract();
    const tx = await c.bid(id, { value: parseEther(bidAmount || "0.02") });
    setLastTx(tx.hash);
    await tx.wait();
    setStatus("Bid placed ✅");
    await refreshLatest();
  }

  async function finalize(id) {
    setStatus("Finalizing auction...");
    const c = await getSignerAndContract();
    const tx = await c.endAuction(id);
    setLastTx(tx.hash);
    await tx.wait();
    setStatus("Auction finalized ✅");
    await refreshLatest();
  }

  async function withdraw(id) {
    setStatus("Withdrawing refunds...");
    const c = await getSignerAndContract();
    const tx = await c.withdraw(id);
    setLastTx(tx.hash);
    await tx.wait();
    setStatus("Withdrawn ✅");
    await refreshLatest();
  }

  useEffect(() => { if (address && contractAddr) refreshLatest(); }, [address, contractAddr]);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Auction dApp — Shardeum</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={contractAddr} onChange={e=>setContractAddr(e.target.value)} placeholder="Contract address" style={{ padding: 8, borderRadius: 10, border: "1px solid #e5e7eb", width: 300 }}/>
          <button onClick={connect} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", cursor: "pointer" }}>{address ? short(address) : "Connect"}</button>
        </div>
      </header>

      <div style={{ marginBottom: 10, color: "#4b5563" }}>
        {chainId && chainId !== 8080 && <div>⚠️ Switch to Shardeum Unstablenet (8080)</div>}
        {status && <div>• {status}</div>}
        {lastTx && <div>• Last tx: <a href={`${EXPLORER}/tx/${lastTx}`} target="_blank" rel="noreferrer">{lastTx.slice(0, 10)}...</a></div>}
      </div>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Create Auction</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label>Title</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="MacBook Pro 13”" style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}/>
          </div>
          <div>
            <label>URI (image/IPFS)</label>
            <input value={uri} onChange={e=>setUri(e.target.value)} placeholder="ipfs://..." style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}/>
          </div>
          <div>
            <label>Duration (minutes)</label>
            <input type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}/>
          </div>
          <div>
            <label>Reserve Price (SHM)</label>
            <input value={reserve} onChange={e=>setReserve(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}/>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button onClick={createAuction} style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", cursor: "pointer" }}>Create</button>
        </div>
      </section>

      <section style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Latest Auctions</h2>
          <button onClick={()=>refreshLatest()} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #e5e7eb", cursor: "pointer" }}>Refresh</button>
        </div>

        {auctions.length === 0 && <div>No auctions yet</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {auctions.map(a => (
            <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{a.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{a.uri ? <a href={a.uri} target="_blank" rel="noreferrer">{a.uri}</a> : "No URI"}</div>
              <div style={{ display: "flex", gap: 12, fontSize: 14, marginBottom: 8 }}>
                <span>Seller: {short(a.seller)}</span>
                <span>Ends: {timeLeft(a.endTime)}</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 14, marginBottom: 8 }}>
                <span>Highest: {formatEther(a.highestBid)} SHM</span>
                <span>Reserve: {formatEther(a.reservePrice)} SHM</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input value={bidAmount} onChange={e=>setBidAmount(e.target.value)} style={{ width: "35%", padding: 8, borderRadius: 10, border: "1px solid #e5e7eb" }} />
                <button onClick={()=>placeBid(a.id)} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", cursor: "pointer" }} disabled={a.settled || a.canceled || (a.endTime * 1000) <= Date.now()}>Bid</button>
                <button onClick={()=>finalize(a.id)} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", cursor: "pointer" }} disabled={(a.endTime * 1000) > Date.now() || a.settled || a.canceled}>End</button>
                <button onClick={()=>withdraw(a.id)} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #e5e7eb", cursor: "pointer" }}>Withdraw</button>
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                {a.canceled ? "Canceled" : a.settled ? "Settled" : ""}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: 16, fontSize: 12, color: "#6b7280" }}>
        Explorer: <a href={EXPLORER} target="_blank" rel="noreferrer">{EXPLORER}</a> • Chain ID: 8080
      </footer>
    </div>
  );
}
